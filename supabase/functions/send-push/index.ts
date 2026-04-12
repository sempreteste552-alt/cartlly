import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ============================================================
// Minimal Web Push (RFC 8291 / aes128gcm) implementation
// using only the Web Crypto API available in Deno.
// ============================================================

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

async function hkdfDerive(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", ikm, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const prk = new Uint8Array(await crypto.subtle.sign("HMAC", key, salt.length > 0 ? salt : new Uint8Array(32)));
  
  const prkKey = await crypto.subtle.importKey("raw", prk, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const infoWithCounter = concat(info, new Uint8Array([1]));
  const okm = new Uint8Array(await crypto.subtle.sign("HMAC", prkKey, infoWithCounter));
  return okm.slice(0, length);
}

// Actually for Web Push we need proper HKDF extract then expand
async function hkdfExtractExpand(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  // Extract
  const saltKey = await crypto.subtle.importKey("raw", salt.length > 0 ? salt : new Uint8Array(32), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const prk = new Uint8Array(await crypto.subtle.sign("HMAC", saltKey, ikm));
  // Expand
  const prkKey = await crypto.subtle.importKey("raw", prk, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const t1 = new Uint8Array(await crypto.subtle.sign("HMAC", prkKey, concat(info, new Uint8Array([1]))));
  return t1.slice(0, length);
}

function createInfo(type: string, clientPublicKey: Uint8Array, serverPublicKey: Uint8Array): Uint8Array {
  const enc = new TextEncoder();
  const typeBytes = enc.encode(type);
  const len = 2 + typeBytes.length + 1 + 5 + 2 + clientPublicKey.length + 2 + serverPublicKey.length;
  const info = new Uint8Array(len);
  let offset = 0;
  
  // "Content-Encoding: " + type + \0
  const prefix = enc.encode("Content-Encoding: ");
  info.set(prefix, offset); offset += prefix.length;
  info.set(typeBytes, offset); offset += typeBytes.length;
  info[offset++] = 0;
  
  // "P-256" + \0
  const p256 = enc.encode("P-256");
  info.set(p256, offset); offset += p256.length;
  info[offset++] = 0;
  
  // client key length (2 bytes) + client key
  info[offset++] = 0;
  info[offset++] = clientPublicKey.length;
  info.set(clientPublicKey, offset); offset += clientPublicKey.length;
  
  // server key length (2 bytes) + server key
  info[offset++] = 0;
  info[offset++] = serverPublicKey.length;
  info.set(serverPublicKey, offset);
  
  return info;
}

async function encryptPayload(
  clientPublicKeyB64: string,
  clientAuthB64: string,
  payload: string
): Promise<{ encrypted: Uint8Array; salt: Uint8Array; serverPublicKey: Uint8Array }> {
  const enc = new TextEncoder();
  const plaintext = enc.encode(payload);

  const clientPublicKeyRaw = b64urlDecode(clientPublicKeyB64);
  const clientAuth = b64urlDecode(clientAuthB64);

  // Generate ephemeral ECDH key pair
  const serverKeys = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const serverPublicKeyRaw = new Uint8Array(await crypto.subtle.exportKey("raw", serverKeys.publicKey));

  // Import client public key
  const clientKey = await crypto.subtle.importKey("raw", clientPublicKeyRaw, { name: "ECDH", namedCurve: "P-256" }, false, []);

  // ECDH shared secret
  const sharedSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: clientKey }, serverKeys.privateKey, 256));

  // Generate random salt
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // HKDF for auth info  
  const authInfo = concat(enc.encode("WebPush: info\0"), clientPublicKeyRaw, serverPublicKeyRaw);
  const ikm = await hkdfExtractExpand(clientAuth, sharedSecret, authInfo, 32);

  // Derive content encryption key and nonce
  const cekInfo = concat(enc.encode("Content-Encoding: aes128gcm\0"));
  const nonceInfo = concat(enc.encode("Content-Encoding: nonce\0"));
  
  const cek = await hkdfExtractExpand(salt, ikm, cekInfo, 16);
  const nonce = await hkdfExtractExpand(salt, ikm, nonceInfo, 12);

  // Add padding delimiter
  const paddedPlaintext = concat(plaintext, new Uint8Array([2])); // 2 = final record

  // AES-128-GCM encrypt
  const aesKey = await crypto.subtle.importKey("raw", cek, { name: "AES-GCM" }, false, ["encrypt"]);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, paddedPlaintext));

  // Build aes128gcm header: salt(16) + rs(4) + idlen(1) + keyid(65) + ciphertext
  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096);
  
  const header = concat(
    salt,
    rs,
    new Uint8Array([serverPublicKeyRaw.length]),
    serverPublicKeyRaw
  );

  const body = concat(header, ciphertext);

  return { encrypted: body, salt, serverPublicKey: serverPublicKeyRaw };
}

/** Pad or trim a byte array to exactly `len` bytes (left-pad with zeros). */
function padTo(buf: Uint8Array, len: number): Uint8Array {
  if (buf.length === len) return buf;
  if (buf.length > len) return buf.slice(buf.length - len);
  const padded = new Uint8Array(len);
  padded.set(buf, len - buf.length);
  return padded;
}

async function generateVapidAuthHeader(
  endpoint: string,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  subject: string
) {
  const urlObj = new URL(endpoint);
  const audience = `${urlObj.protocol}//${urlObj.host}`;

  const header = { typ: "JWT", alg: "ES256" };
  const now = Math.floor(Date.now() / 1000);
  const payload = { aud: audience, exp: now + 86400, sub: subject };

  const enc = new TextEncoder();

  const headerB64 = b64url(enc.encode(JSON.stringify(header)));
  const payloadB64 = b64url(enc.encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  const rawPrivate = b64urlDecode(vapidPrivateKey.trim());
  const rawPublic = b64urlDecode(vapidPublicKey.trim());

  // Handle both 65-byte (0x04 prefix) and 64-byte public keys
  let xBytes: Uint8Array;
  let yBytes: Uint8Array;

  if (rawPublic.length === 65 && rawPublic[0] === 0x04) {
    xBytes = rawPublic.slice(1, 33);
    yBytes = rawPublic.slice(33, 65);
  } else if (rawPublic.length === 64) {
    xBytes = rawPublic.slice(0, 32);
    yBytes = rawPublic.slice(32, 64);
  } else {
    throw new Error(`Invalid VAPID public key length: ${rawPublic.length} bytes (expected 64 or 65)`);
  }

  const dBytes = padTo(rawPrivate, 32);

  const x = b64url(xBytes);
  const y = b64url(yBytes);
  const d = b64url(dBytes);

  const key = await crypto.subtle.importKey(
    "jwk",
    { kty: "EC", crv: "P-256", x, y, d },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const signatureBuf = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    enc.encode(unsignedToken)
  );

  // Web Crypto may return DER-encoded signature; we need raw r||s (64 bytes)
  const sigBytes = new Uint8Array(signatureBuf);
  let r: Uint8Array, s: Uint8Array;

  if (sigBytes.length !== 64 && sigBytes[0] === 0x30) {
    // DER encoded — parse it
    let offset = 2;
    if (sigBytes[1] & 0x80) offset += (sigBytes[1] & 0x7f);
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

  const token = `${unsignedToken}.${b64url(rawSig)}`;

  return { token, vapidKey: vapidPublicKey };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const authHeader = req.headers.get("Authorization");
    const isAdminCall = authHeader?.includes(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "impossible-key");

    if (!isAdminCall) {
      const { data: { user }, error: userErr } = await supabase.auth.getUser();
      if (userErr || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
      }
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

    const payloadStr = JSON.stringify({ title, body: body || "", url: url || "/admin" });
    let sent = 0;
    const failures: string[] = [];

    for (const sub of subscriptions) {
      try {
        const { token, vapidKey } = await generateVapidAuthHeader(
          sub.endpoint,
          vapidPublicKey,
          vapidPrivateKey,
          "mailto:noreply@www.cartlly.lovable.app"
        );

        // Encrypt the payload using Web Push encryption (aes128gcm)
        const { encrypted } = await encryptPayload(sub.p256dh, sub.auth, payloadStr);

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

        if (resp.status === 201 || resp.status === 200) {
          sent++;
        } else if (resp.status === 404 || resp.status === 410) {
          await serviceClient.from("push_subscriptions").delete().eq("id", sub.id);
          failures.push(`Removed expired subscription ${sub.id}`);
        } else {
          const text = await resp.text();
          console.error(`Push failed for ${sub.id}: ${resp.status} ${text}`);
          failures.push(`${sub.id}: ${resp.status} ${text}`);
        }
      } catch (e) {
        console.error(`Push error for ${sub.id}:`, e);
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
