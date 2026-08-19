import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getAdapter } from "../_shared/social-adapters.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VERIFY_TOKEN = Deno.env.get("META_WEBHOOK_VERIFY_TOKEN") || "";
const APP_SECRET = Deno.env.get("META_APP_SECRET") || "";

const enc = new TextEncoder();
async function validSignature(raw: string, header: string | null) {
  if (!APP_SECRET) return false;
  if (!header?.startsWith("sha256=")) return false;
  const key = await crypto.subtle.importKey("raw", enc.encode(APP_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(raw));
  const hex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return hex === header.slice(7);
}

serve(async (req) => {
  const url = new URL(req.url);

  // Verificação oficial do webhook da Meta
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && VERIFY_TOKEN && token === VERIFY_TOKEN) {
      return new Response(challenge ?? "", { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

  const raw = await req.text();
  if (!(await validSignature(raw, req.headers.get("x-hub-signature-256")))) {
    return new Response("Invalid signature", { status: 401 });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    const payload = JSON.parse(raw);
    const object = payload.object as string; // "instagram" | "page"
    const provider = object === "instagram" ? "instagram" : "facebook";
    const adapter = getAdapter(provider);

    for (const entry of payload.entry || []) {
      const accountId = String(entry.id);
      const { data: conn } = await admin
        .from("social_connections")
        .select("id, tenant_id, provider, status")
        .eq("provider", provider)
        .eq("status", "connected")
        .or(`provider_account_id.eq.${accountId},page_id.eq.${accountId}`)
        .limit(1)
        .maybeSingle();
      if (!conn) continue;

      const { data: settings } = await admin
        .from("tenant_social_settings")
        .select("*")
        .eq("tenant_id", conn.tenant_id)
        .maybeSingle();
      if (settings && settings.auto_detect_products === false) continue;
      if (settings && provider === "instagram" && settings.instagram_enabled === false) continue;
      if (settings && provider === "facebook" && settings.facebook_enabled === false) continue;

      for (const change of entry.changes || []) {
        const post = adapter.normalizeWebhookChange(change);
        if (!post) continue;

        // idempotência: tenant + provider + external_post_id
        const { data: inserted } = await admin
          .from("social_media_posts")
          .upsert(
            { tenant_id: conn.tenant_id, connection_id: conn.id, provider, ...post, processing_status: "NEW" },
            { onConflict: "tenant_id,provider,external_post_id", ignoreDuplicates: true },
          )
          .select("id")
          .maybeSingle();
        if (!inserted?.id) continue;

        await admin.rpc("bump_social_analytics", {
          p_tenant_id: conn.tenant_id, p_provider: provider, p_field: "posts_detected", p_amount: 1,
        });

        // enfileira análise (não bloqueia a resposta do webhook)
        fetch(`${SUPABASE_URL}/functions/v1/social-analyze-post`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
          body: JSON.stringify({ post_id: inserted.id }),
        }).catch(() => {});
      }
    }
  } catch (e) {
    console.error("social-webhook error", e);
  }

  // Meta exige 200 rápido
  return new Response("EVENT_RECEIVED", { status: 200 });
});
