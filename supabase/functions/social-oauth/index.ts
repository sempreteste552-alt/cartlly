import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { GRAPH, getAdapter } from "../_shared/social-adapters.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const APP_ID = Deno.env.get("META_APP_ID") || "";
const APP_SECRET = Deno.env.get("META_APP_SECRET") || "";
const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/social-oauth`;

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// ---------- signed state ----------
const enc = new TextEncoder();
async function hmac(data: string) {
  const key = await crypto.subtle.importKey("raw", enc.encode(APP_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function packState(payload: Record<string, unknown>) {
  const raw = btoa(JSON.stringify(payload));
  return `${raw}.${await hmac(raw)}`;
}
async function unpackState(state: string) {
  const [raw, sig] = (state || "").split(".");
  if (!raw || !sig || (await hmac(raw)) !== sig) throw new Error("state inválido");
  return JSON.parse(atob(raw));
}

async function isPremium(admin: any, tenantId: string) {
  const { data } = await admin
    .from("tenant_subscriptions")
    .select("plan_id, feature_overrides, tenant_plans(slug)")
    .eq("user_id", tenantId)
    .maybeSingle();
  const slug = (data as any)?.tenant_plans?.slug?.toUpperCase?.();
  const overrides = (data as any)?.feature_overrides || {};
  return slug === "PREMIUM" || overrides?.social_product_import === true;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const url = new URL(req.url);

  try {
    if (!APP_ID || !APP_SECRET) {
      // callback não pode continuar sem credenciais
      if (url.searchParams.get("code")) return new Response("Integração Meta não configurada.", { status: 500 });
    }

    // ---------- OAuth callback (GET público, vindo da Meta) ----------
    if (req.method === "GET" && (url.searchParams.get("code") || url.searchParams.get("error"))) {
      const state = await unpackState(url.searchParams.get("state") || "");
      const back = new URL(state.r);
      if (url.searchParams.get("error")) {
        back.searchParams.set("social_error", url.searchParams.get("error_description") || "Autorização cancelada");
        return Response.redirect(back.toString(), 302);
      }

      const code = url.searchParams.get("code")!;
      // 1) short-lived token
      const tokRes = await fetch(
        `${GRAPH}/oauth/access_token?client_id=${APP_ID}&client_secret=${APP_SECRET}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&code=${code}`,
      );
      const tok = await tokRes.json();
      if (!tokRes.ok) throw new Error(tok?.error?.message || "Falha ao obter token");

      // 2) long-lived token
      const llRes = await fetch(
        `${GRAPH}/oauth/access_token?grant_type=fb_exchange_token&client_id=${APP_ID}&client_secret=${APP_SECRET}&fb_exchange_token=${tok.access_token}`,
      );
      const ll = await llRes.json();
      const userToken = ll.access_token || tok.access_token;
      const expiresAt = ll.expires_in ? new Date(Date.now() + ll.expires_in * 1000).toISOString() : null;

      // 3) páginas + conta instagram business
      const pagesRes = await fetch(
        `${GRAPH}/me/accounts?fields=id,name,access_token,instagram_business_account{id,username,name}&access_token=${userToken}`,
      );
      const pages = await pagesRes.json();
      const page = (pages.data || [])[0];
      if (!page) throw new Error("Nenhuma página do Facebook encontrada nesta conta.");

      const provider = state.p as string;
      const ig = page.instagram_business_account;
      if (provider === "instagram" && !ig) throw new Error("Nenhuma conta Instagram Profissional vinculada à página.");

      const accountId = provider === "instagram" ? String(ig.id) : String(page.id);
      const accountName = provider === "instagram" ? (ig.name || ig.username) : page.name;
      const username = provider === "instagram" ? ig.username : null;

      const { data: conn, error: connErr } = await admin
        .from("social_connections")
        .upsert(
          {
            tenant_id: state.t,
            provider,
            provider_account_id: accountId,
            account_name: accountName,
            account_username: username,
            page_id: String(page.id),
            status: "connected",
            token_expires_at: expiresAt,
            scopes: getAdapter(provider).scopes,
            metadata: { page_name: page.name },
            last_error: null,
          },
          { onConflict: "tenant_id,provider,provider_account_id" },
        )
        .select("id")
        .single();
      if (connErr) throw connErr;

      // token do page é o usado nas chamadas do Graph — guardado só no backend
      await admin.from("social_connection_secrets").upsert({
        connection_id: conn.id,
        access_token: page.access_token || userToken,
        refresh_token: null,
        updated_at: new Date().toISOString(),
      });

      // inscrever webhooks oficiais da página (eventos, sem polling)
      try {
        await fetch(`${GRAPH}/${page.id}/subscribed_apps`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subscribed_fields: "feed,mention", access_token: page.access_token }),
        });
      } catch (_) { /* não bloqueia a conexão */ }

      await admin.from("admin_notifications").insert({
        title: `🟢 ${provider === "instagram" ? "Instagram" : "Facebook"} conectado`,
        message: `Conta ${accountName} conectada com sucesso. Novas publicações serão analisadas automaticamente.`,
        type: "SOCIAL_CONNECTION",
        sender_user_id: state.t,
        target_user_id: state.t,
      });
      await admin.from("audit_logs").insert({
        actor_user_id: state.t,
        action: "social.connect",
        target_type: "social_connection",
        target_id: conn.id,
        target_name: accountName,
        details: { provider, account_id: accountId },
      });

      back.searchParams.set("social_connected", provider);
      return Response.redirect(back.toString(), 302);
    }

    // ---------- Ações autenticadas ----------
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);
    const caller = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await caller.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const action = body.action;

    if (action === "config_status") {
      return json({ configured: Boolean(APP_ID && APP_SECRET), redirect_uri: REDIRECT_URI });
    }

    if (action === "authorize_url") {
      if (!APP_ID || !APP_SECRET) return json({ error: "META_NOT_CONFIGURED" }, 400);
      if (!(await isPremium(admin, user.id))) return json({ error: "PLAN_REQUIRED" }, 403);
      const provider = body.provider === "facebook" ? "facebook" : "instagram";
      const state = await packState({ t: user.id, p: provider, r: body.return_url, n: crypto.randomUUID() });
      return json({ url: getAdapter(provider).authorizeUrl(APP_ID, REDIRECT_URI, state) });
    }

    if (action === "disconnect") {
      const { data: conn } = await admin
        .from("social_connections")
        .select("id, tenant_id, provider, account_name")
        .eq("id", body.connection_id)
        .maybeSingle();
      if (!conn || conn.tenant_id !== user.id) return json({ error: "Forbidden" }, 403);

      await admin.from("social_connection_secrets").delete().eq("connection_id", conn.id);
      await admin.from("social_connections").update({ status: "disconnected" }).eq("id", conn.id);
      await admin.from("audit_logs").insert({
        actor_user_id: user.id,
        action: "social.disconnect",
        target_type: "social_connection",
        target_id: conn.id,
        target_name: conn.account_name,
        details: { provider: conn.provider },
      });
      return json({ ok: true });
    }

    if (action === "sync_now") {
      // sincronização manual e controlada (sem polling automático)
      const { data: conn } = await admin
        .from("social_connections")
        .select("*")
        .eq("id", body.connection_id)
        .maybeSingle();
      if (!conn || conn.tenant_id !== user.id) return json({ error: "Forbidden" }, 403);
      const { data: secret } = await admin
        .from("social_connection_secrets")
        .select("access_token")
        .eq("connection_id", conn.id)
        .maybeSingle();
      if (!secret) return json({ error: "Conexão sem token. Reconecte a conta." }, 400);

      const adapter = getAdapter(conn.provider);
      const posts = await adapter.fetchRecentPosts(conn.provider_account_id!, secret.access_token, 5);
      let created = 0;
      for (const p of posts) {
        const { data: inserted } = await admin
          .from("social_media_posts")
          .upsert(
            {
              tenant_id: conn.tenant_id,
              connection_id: conn.id,
              provider: conn.provider,
              ...p,
              processing_status: "NEW",
            },
            { onConflict: "tenant_id,provider,external_post_id", ignoreDuplicates: true },
          )
          .select("id")
          .maybeSingle();
        if (inserted?.id) {
          created++;
          await admin.rpc("bump_social_analytics", {
            p_tenant_id: conn.tenant_id, p_provider: conn.provider, p_field: "posts_detected", p_amount: 1,
          });
          fetch(`${SUPABASE_URL}/functions/v1/social-analyze-post`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
            body: JSON.stringify({ post_id: inserted.id }),
          }).catch(() => {});
        }
      }
      return json({ ok: true, new_posts: created });
    }

    return json({ error: "Ação inválida" }, 400);
  } catch (e) {
    console.error("social-oauth error", e);
    const msg = e instanceof Error ? e.message : "Erro inesperado";
    if (url.searchParams.get("code")) return new Response(`Erro na conexão: ${msg}`, { status: 400 });
    return json({ error: msg }, 400);
  }
});
