import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Web Push with VAPID using web crypto
async function generateVapidAuthHeader(
  endpoint: string,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  subject: string
) {
  const urlObj = new URL(endpoint);
  const audience = `${urlObj.protocol}//${urlObj.host}`;

  // Create JWT
  const header = { typ: "JWT", alg: "ES256" };
  const now = Math.floor(Date.now() / 1000);
  const payload = { aud: audience, exp: now + 86400, sub: subject };

  const enc = new TextEncoder();
  const b64url = (buf: ArrayBuffer | Uint8Array) => {
    const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    let binary = "";
    for (const b of bytes) binary += String.fromCharCode(b);
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  };

  const headerB64 = b64url(enc.encode(JSON.stringify(header)));
  const payloadB64 = b64url(enc.encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  // Import private key
  const rawPrivate = Uint8Array.from(atob(vapidPrivateKey.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
  const rawPublic = Uint8Array.from(atob(vapidPublicKey.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

  // Build JWK for P-256
  const x = b64url(rawPublic.slice(1, 33));
  const y = b64url(rawPublic.slice(33, 65));
  const d = b64url(rawPrivate);

  const key = await crypto.subtle.importKey(
    "jwk",
    { kty: "EC", crv: "P-256", x, y, d },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    enc.encode(unsignedToken)
  );

  // Convert DER signature to raw r||s format
  const sigBytes = new Uint8Array(signature);
  let r: Uint8Array, s: Uint8Array;
  if (sigBytes.length === 64) {
    r = sigBytes.slice(0, 32);
    s = sigBytes.slice(32, 64);
  } else {
    // Already raw format
    r = sigBytes.slice(0, 32);
    s = sigBytes.slice(32);
  }

  const rawSig = new Uint8Array(64);
  rawSig.set(r.length > 32 ? r.slice(r.length - 32) : r, 32 - Math.min(r.length, 32));
  rawSig.set(s.length > 32 ? s.slice(s.length - 32) : s, 64 - Math.min(s.length, 32));

  const token = `${unsignedToken}.${b64url(rawSig)}`;
  const vapidKeyB64 = vapidPublicKey;

  return {
    authorization: `vapid t=${token}, k=${vapidKeyB64}`,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Validate auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const { title, body, url, targetUserId } = await req.json();

    if (!title) {
      return new Response(JSON.stringify({ error: "Title is required" }), { status: 400, headers: corsHeaders });
    }

    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");

    if (!vapidPublicKey || !vapidPrivateKey) {
      return new Response(JSON.stringify({ error: "VAPID keys not configured" }), { status: 500, headers: corsHeaders });
    }

    // Get push subscriptions for target user
    const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    let query = serviceClient.from("push_subscriptions").select("*");
    if (targetUserId) {
      query = query.eq("user_id", targetUserId);
    }

    const { data: subscriptions, error: subErr } = await query;
    if (subErr) throw subErr;

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: "No subscriptions found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = JSON.stringify({ title, body, url: url || "/admin" });
    let sent = 0;
    const failures: string[] = [];

    for (const sub of subscriptions) {
      try {
        const { authorization } = await generateVapidAuthHeader(
          sub.endpoint,
          vapidPublicKey,
          vapidPrivateKey,
          "mailto:noreply@cartlly.lovable.app"
        );

        const resp = await fetch(sub.endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Encoding": "aes128gcm",
            Authorization: authorization.split(", ")[0].replace("vapid ", ""),
            TTL: "86400",
          },
          body: payload,
        });

        if (resp.status === 201 || resp.status === 200) {
          sent++;
        } else if (resp.status === 404 || resp.status === 410) {
          // Subscription expired, remove it
          await serviceClient.from("push_subscriptions").delete().eq("id", sub.id);
          failures.push(`Removed expired subscription ${sub.id}`);
        } else {
          const text = await resp.text();
          failures.push(`${sub.id}: ${resp.status} ${text}`);
        }
      } catch (e) {
        failures.push(`${sub.id}: ${e instanceof Error ? e.message : "unknown"}`);
      }
    }

    return new Response(JSON.stringify({ sent, total: subscriptions.length, failures }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Send push error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
