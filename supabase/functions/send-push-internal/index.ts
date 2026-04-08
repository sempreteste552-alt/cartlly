import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function b64url(buf: Uint8Array): string {
  let binary = "";
  for (const b of buf) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(str: string): Uint8Array {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob(base64 + padding);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const len = arrays.reduce((s, a) => s + a.length, 0);
  const result = new Uint8Array(len);
  let offset = 0;
  for (const a of arrays) { result.set(a, offset); offset += a.length; }
  return result;
}

async function hkdfExtractExpand(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const saltKey = await crypto.subtle.importKey("raw", salt.length > 0 ? salt : new Uint8Array(32), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const prk = new Uint8Array(await crypto.subtle.sign("HMAC", saltKey, ikm));
  const prkKey = await crypto.subtle.importKey("raw", prk, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const t1 = new Uint8Array(await crypto.subtle.sign("HMAC", prkKey, concat(info, new Uint8Array([1]))));
  return t1.slice(0, length);
}

async function encryptPayload(clientPublicKeyB64: string, clientAuthB64: string, payload: string) {
  const enc = new TextEncoder();
  const plaintext = enc.encode(payload);
  const clientPublicKeyRaw = b64urlDecode(clientPublicKeyB64);
  const clientAuth = b64urlDecode(clientAuthB64);

  const serverKeys = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const serverPublicKeyRaw = new Uint8Array(await crypto.subtle.exportKey("raw", serverKeys.publicKey));
  const clientKey = await crypto.subtle.importKey("raw", clientPublicKeyRaw, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const sharedSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: clientKey }, serverKeys.privateKey, 256));

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const authInfo = concat(enc.encode("WebPush: info\0"), clientPublicKeyRaw, serverPublicKeyRaw);
  const ikm = await hkdfExtractExpand(clientAuth, sharedSecret, authInfo, 32);
  const cek = await hkdfExtractExpand(salt, ikm, concat(enc.encode("Content-Encoding: aes128gcm\0")), 16);
  const nonce = await hkdfExtractExpand(salt, ikm, concat(enc.encode("Content-Encoding: nonce\0")), 12);

  const paddedPlaintext = concat(plaintext, new Uint8Array([2]));
  const aesKey = await crypto.subtle.importKey("raw", cek, { name: "AES-GCM" }, false, ["encrypt"]);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, paddedPlaintext));

  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096);
  return concat(salt, rs, new Uint8Array([serverPublicKeyRaw.length]), serverPublicKeyRaw, ciphertext);
}

function padTo(buf: Uint8Array, len: number): Uint8Array {
  if (buf.length === len) return buf;
  if (buf.length > len) return buf.slice(buf.length - len);
  const padded = new Uint8Array(len);
  padded.set(buf, len - buf.length);
  return padded;
}

async function generateVapidAuthHeader(endpoint: string, vapidPublicKey: string, vapidPrivateKey: string) {
  const urlObj = new URL(endpoint);
  const audience = `${urlObj.protocol}//${urlObj.host}`;
  const enc = new TextEncoder();

  const header = { typ: "JWT", alg: "ES256" };
  const now = Math.floor(Date.now() / 1000);
  const payload = { aud: audience, exp: now + 86400, sub: "mailto:noreply@cartlly.lovable.app" };

  const headerB64 = b64url(enc.encode(JSON.stringify(header)));
  const payloadB64 = b64url(enc.encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  const rawPrivate = b64urlDecode(vapidPrivateKey.trim());
  const rawPublic = b64urlDecode(vapidPublicKey.trim());
  const xBytes = padTo(rawPublic.slice(1, 33), 32);
  const yBytes = padTo(rawPublic.slice(33, 65), 32);
  const dBytes = padTo(rawPrivate, 32);

  const key = await crypto.subtle.importKey(
    "jwk",
    { kty: "EC", crv: "P-256", x: b64url(xBytes), y: b64url(yBytes), d: b64url(dBytes) },
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign"]
  );

  const signatureBuf = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(unsignedToken));
  const sigBytes = new Uint8Array(signatureBuf);
  let r: Uint8Array, s: Uint8Array;

  if (sigBytes.length !== 64 && sigBytes[0] === 0x30) {
    let offset = 2;
    if (sigBytes[1] & 0x80) offset += sigBytes[1] & 0x7f;
    if (sigBytes[offset] !== 0x02) throw new Error("Invalid DER sig");
    offset++;
    const rLen = sigBytes[offset++];
    r = sigBytes.slice(offset, offset + rLen);
    offset += rLen;
    if (sigBytes[offset] !== 0x02) throw new Error("Invalid DER sig");
    offset++;
    const sLen = sigBytes[offset++];
    s = sigBytes.slice(offset, offset + sLen);
  } else {
    r = sigBytes.slice(0, 32);
    s = sigBytes.slice(32, 64);
  }

  const rawSig = new Uint8Array(64);
  rawSig.set(padTo(r, 32), 0);
  rawSig.set(padTo(s, 32), 32);

  return { token: `${unsignedToken}.${b64url(rawSig)}`, vapidKey: vapidPublicKey };
}

function shouldDeleteSubscription(status: number, responseText: string): boolean {
  return status === 404 || status === 410 ||
    responseText.includes("VapidPkHashMismatch") ||
    responseText.includes("do not correspond to the credentials used");
}

function isTransientError(status: number): boolean {
  return status === 429 || status >= 500;
}

async function sendWithRetry(
  sub: any, vapidPublicKey: string, vapidPrivateKey: string,
  payloadStr: string, maxRetries = 2
): Promise<{ status: number; text: string }> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const { token, vapidKey } = await generateVapidAuthHeader(sub.endpoint, vapidPublicKey, vapidPrivateKey);
    const encrypted = await encryptPayload(sub.p256dh, sub.auth, payloadStr);

    const resp = await fetch(sub.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Encoding": "aes128gcm",
        "Authorization": `vapid t=${token}, k=${vapidKey}`,
        "TTL": "86400",
        "Urgency": "high",
      },
      body: encrypted,
    });

    if (resp.status === 200 || resp.status === 201) return { status: resp.status, text: "" };

    const text = await resp.text();
    if (!isTransientError(resp.status) || attempt === maxRetries) return { status: resp.status, text };

    await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
  }
  return { status: 500, text: "Max retries exceeded" };
}

async function logPush(
  supabase: any, userId: string, subscriptionId: string | null,
  eventType: string, title: string, body: string | undefined,
  payload: any, status: string, errorMessage: string | null,
  extras?: { store_user_id?: string; customer_id?: string; trigger_type?: string }
) {
  try {
    await supabase.from("push_logs").insert({
      user_id: userId, subscription_id: subscriptionId,
      event_type: eventType, title, body: body || null,
      payload: payload || {}, status, error_message: errorMessage,
      store_user_id: extras?.store_user_id || null,
      customer_id: extras?.customer_id || null,
      trigger_type: extras?.trigger_type || eventType,
      delivered_at: (status === "sent" || status === "delivered") ? new Date().toISOString() : null,
    });
  } catch (e) { console.error("Failed to log push:", e); }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { target_user_id, title, body: msgBody, url, type, data: extraData, tag, store_user_id, customer_id } = body;
    const logExtras = { store_user_id, customer_id, trigger_type: type };

    if (!target_user_id || !title) return json({ error: "target_user_id and title required" }, 400);

    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    if (!vapidPublicKey || !vapidPrivateKey) return json({ error: "VAPID not configured" }, 500);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    let query = supabase.from("push_subscriptions").select("*").eq("user_id", target_user_id);

    if (store_user_id) {
      query = query.or(`store_user_id.eq.${store_user_id},store_user_id.is.null`);
      if (target_user_id === store_user_id) {
        return json({ sent: 0, total: 0, removed: 0, message: "Cannot send store push to store owner" });
      }
    }

    const { data: subs } = await query;

    if (!subs || subs.length === 0) {
      await logPush(supabase, target_user_id, null, type || "general", title, msgBody, extraData, "no_subscription", null, logExtras);
      return json({ sent: 0, total: 0, removed: 0, message: "No push subscriptions" });
    }

    // Validate subscriptions: must have endpoint + keys
    const validSubs = subs.filter((s: any) => s.endpoint && s.p256dh && s.auth);
    const invalidSubs = subs.filter((s: any) => !s.endpoint || !s.p256dh || !s.auth);

    if (invalidSubs.length > 0) {
      const ids = invalidSubs.map((s: any) => s.id);
      await supabase.from("push_subscriptions").delete().in("id", ids);
      console.log(`Cleaned ${invalidSubs.length} invalid subscriptions`);
    }

    const pushPayload: any = {
      title, body: msgBody || "", url: url || "/admin",
      type: type || "general", tag: tag || type || "default",
      data: extraData || {},
    };

    if (type === "payment_approved" || type === "new_order") {
      pushPayload.actions = [{ action: "view_order", title: "📋 Ver Pedido" }];
    } else if (type === "pix_generated" || type === "boleto_generated") {
      pushPayload.actions = [{ action: "view_payment", title: "💰 Ver Pagamento" }];
    }

    const payloadStr = JSON.stringify(pushPayload);
    let sent = 0;
    let removed = 0;
    const failures: string[] = [];

    for (const sub of validSubs) {
      try {
        const result = await sendWithRetry(sub, vapidPublicKey, vapidPrivateKey, payloadStr);

        if (result.status === 200 || result.status === 201) {
          sent++;
          await logPush(supabase, target_user_id, sub.id, type || "general", title, msgBody, extraData, "sent", null, logExtras);
        } else if (shouldDeleteSubscription(result.status, result.text)) {
          await supabase.from("push_subscriptions").delete().eq("id", sub.id);
          removed++;
          await logPush(supabase, target_user_id, sub.id, type || "general", title, msgBody, extraData, "expired", result.text.slice(0, 200), logExtras);
        } else {
          console.error(`Push failed ${sub.id}: ${result.status} ${result.text}`);
          failures.push(`${sub.id}: ${result.status}`);
          await logPush(supabase, target_user_id, sub.id, type || "general", title, msgBody, extraData, "failed", `HTTP ${result.status}: ${result.text.slice(0, 200)}`, logExtras);
        }
      } catch (e: any) {
        console.error(`Push error ${sub.id}:`, e);
        failures.push(`${sub.id}: ${e.message}`);
        await logPush(supabase, target_user_id, sub.id, type || "general", title, msgBody, extraData, "error", e.message?.slice(0, 200), logExtras);
      }
    }

    return json({ sent, total: validSubs.length, removed, failures });
  } catch (error: any) {
    console.error("Internal push error:", error);
    return json({ error: error.message, fallback: true }, 200);
  }
});

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
