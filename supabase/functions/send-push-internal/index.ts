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
  for (const a of arrays) {
    result.set(a, offset);
    offset += a.length;
  }
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
  const payload = { aud: audience, exp: now + 86400, sub: "mailto:noreply@www.cartlly.lovable.app" };

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

  const key = await crypto.subtle.importKey(
    "jwk",
    { kty: "EC", crv: "P-256", x: b64url(xBytes), y: b64url(yBytes), d: b64url(dBytes) },
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign"]
  );

  const signatureBuf = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(unsignedToken));
  const sigBytes = new Uint8Array(signatureBuf);
  let r: Uint8Array;
  let s: Uint8Array;

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

function shouldDeleteSubscription(status: number, responseText: string) {
  return status === 404 || status === 410 || responseText.includes("VapidPkHashMismatch") || responseText.includes("do not correspond to the credentials used to create the subscriptions");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { target_user_id, customer_id, title, body: msgBody, url, type, data: extraData, tag, store_user_id } = body;
    const effectiveStoreUserId = store_user_id || null;

    if ((!target_user_id && !customer_id) || !title) {
      return json({ error: "target_user_id or customer_id and title required" }, 400);
    }

    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    if (!vapidPublicKey || !vapidPrivateKey) {
      return json({ error: "VAPID not configured" }, 500);
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // === DEDUPLICATION: cooldown + exact duplicate + semantic similarity on last 15 ===
    // Skip dedup entirely for chat/support messages — they are conversational and frequent
    const chatTypes = ["support_message", "new_customer", "admin_message"];
    const skipDedup = chatTypes.includes(type || "");

    const effectiveTarget = target_user_id || customer_id;
    if (effectiveTarget && !skipDedup) {
      const { data: recentHistory } = await supabase
        .from("push_logs")
        .select("title, body, created_at")
        .or(`user_id.eq.${effectiveTarget},customer_id.eq.${effectiveTarget}`)
        .eq("status", "sent")
        .order("created_at", { ascending: false })
        .limit(15);

      const recentHistoryTexts = (recentHistory || [])
        .map((entry: any) => `${entry.title || ""} ${entry.body || ""}`.trim())
        .filter(Boolean);

      const latestSentAt = recentHistory?.[0]?.created_at ? new Date(recentHistory[0].created_at).getTime() : 0;
      if (latestSentAt && Date.now() - latestSentAt < 5 * 60 * 1000) {
        console.log(`[DEDUP] Cooldown active for ${effectiveTarget}, last push at ${recentHistory?.[0]?.created_at}`);
        await logPush(supabase, target_user_id, customer_id, null, type || "general", title, msgBody, extraData, "cooldown_blocked", "5-min cooldown active", effectiveStoreUserId);
        return json({ sent: 0, total: 0, removed: 0, message: "Cooldown: push sent less than 5 minutes ago" });
      }

      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: duplicates } = await supabase
        .from("push_logs")
        .select("id")
        .or(`user_id.eq.${effectiveTarget},customer_id.eq.${effectiveTarget}`)
        .eq("title", title)
        .eq("body", msgBody || "")
        .gte("created_at", twentyFourHoursAgo)
        .eq("status", "sent")
        .limit(1);

      if (duplicates && duplicates.length > 0) {
        console.log(`[DEDUP] Duplicate message blocked for ${effectiveTarget}: "${title}"`);
        await logPush(supabase, target_user_id, customer_id, null, type || "general", title, msgBody, extraData, "duplicate_blocked", "Same message sent in last 24h", effectiveStoreUserId);
        return json({ sent: 0, total: 0, removed: 0, message: "Duplicate: same message already sent in 24h" });
      }

      const similarityReason = getSimilarityBlockReason(title, msgBody, recentHistoryTexts, type || "general");
      if (similarityReason) {
        console.log(`[DEDUP] Similarity blocked for ${effectiveTarget}: ${similarityReason}`);
        await logPush(supabase, target_user_id, customer_id, null, type || "general", title, msgBody, extraData, "similarity_blocked", similarityReason, effectiveStoreUserId);
        return json({ sent: 0, total: 0, removed: 0, message: `Similarity blocked: ${similarityReason}` });
      }
    }

    let query = supabase
      .from("push_subscriptions")
      .select("*");

    if (target_user_id) {
      query = query.eq("user_id", target_user_id);
    } else if (customer_id) {
      const { data: customerTokens } = await supabase
        .from("customer_push_tokens")
        .select("token")
        .eq("customer_id", customer_id);
      
      if (customerTokens && customerTokens.length > 0) {
        const tokens = customerTokens.map(t => t.token);
        query = query.in("endpoint", tokens);
      } else {
        return json({ sent: 0, total: 0, removed: 0, message: "No tokens found for customer" });
      }
    }

    // Tenant isolation
    if (store_user_id) {
      query = query.or(`store_user_id.eq.${store_user_id},store_user_id.is.null`);
      const behaviorTypes = ["product_view", "abandoned_cart", "inactivity", "review_thankyou", "new_product", "new_coupon", "new_customer", "ceo_insight", "support_message"];
      if (target_user_id === store_user_id && !behaviorTypes.includes(type || "")) {
        return json({ sent: 0, total: 0, removed: 0, message: "Cannot send store promo push to store owner" });
      }
    }

    const { data: subs } = await query;

    const customerPushTypes = ["store_promotion", "abandoned_cart", "product_view", "inactivity", "new_product", "new_coupon", "review_thankyou", "order_status_update", "tenant_message"];
    const shouldMirrorInAppNotification = !!(store_user_id && target_user_id && target_user_id !== store_user_id && customerPushTypes.includes(type || ""));

    let sent = 0;
    let removed = 0;
    const failures: string[] = [];

    const mirrorInAppNotification = async () => {
      try {
        const { data: existing } = await supabase
          .from("tenant_messages")
          .select("id")
          .eq("source_tenant_id", store_user_id)
          .eq("target_user_id", target_user_id)
          .eq("title", title)
          .gte("created_at", new Date(Date.now() - 60000).toISOString())
          .limit(1);

        if (!existing || existing.length === 0) {
          await supabase.from("tenant_messages").insert({
            source_tenant_id: store_user_id,
            target_user_id: target_user_id,
            target_area: "public_store",
            audience_type: "tenant_admin_to_one_customer",
            title,
            body: msgBody || null,
            message_type: type === "store_promotion" ? "promotion" : "info",
            status: "sent",
            channel: sent > 0 ? "push" : "in_app",
            sender_type: "tenant_admin",
            sender_user_id: store_user_id,
            is_global: false,
            target_tenant_id: store_user_id,
          });
        }
      } catch (e) {
        console.error("Failed to create in-app notification:", e);
      }
    };

    if (!subs || subs.length === 0) {
      if (shouldMirrorInAppNotification) {
        await mirrorInAppNotification();
      }
      await logPush(supabase, target_user_id, customer_id, null, type || "general", title, msgBody, extraData, "no_subscription", null, effectiveStoreUserId);
      return json({ sent: 0, total: 0, removed: 0, message: "No push subscriptions" });
    }

    const pushPayload: any = {
      title,
      body: msgBody || "",
      url: url || "/admin",
      type: type || "general",
      tag: tag || type || "default",
      data: extraData || {},
    };

    if (type === "payment_approved" || type === "new_order") {
      pushPayload.actions = [{ action: "view_order", title: "📋 Ver Pedido" }];
    } else if (type === "pix_generated" || type === "boleto_generated") {
      pushPayload.actions = [{ action: "view_payment", title: "💰 Ver Pagamento" }];
    }

    const payloadStr = JSON.stringify(pushPayload);
    // sent, removed, failures already declared above

    for (const sub of subs) {
      try {
        if (sub.platform === "web" || !sub.platform || sub.platform === "") {
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

          if (resp.status === 201 || resp.status === 200) {
            sent++;
            await logPush(supabase, target_user_id, customer_id, sub.id, type || "general", title, msgBody, extraData, "sent", null, effectiveStoreUserId);
          } else {
            const text = await resp.text();
            if (shouldDeleteSubscription(resp.status, text)) {
              await supabase.from("push_subscriptions").delete().eq("id", sub.id);
              removed++;
              await logPush(supabase, target_user_id, customer_id, sub.id, type || "general", title, msgBody, extraData, "expired", text.slice(0, 200), effectiveStoreUserId);
            } else {
              console.error(`Push failed ${sub.id}: ${resp.status} ${text}`);
              failures.push(`${sub.id}: ${resp.status}`);
              await logPush(supabase, target_user_id, customer_id, sub.id, type || "general", title, msgBody, extraData, "failed", `HTTP ${resp.status}: ${text.slice(0, 200)}`, effectiveStoreUserId);
            }
          }
        }
      } catch (e: any) {
        console.error(`Push error ${sub.id}:`, e);
        failures.push(`${sub.id}: ${e.message}`);
        await logPush(supabase, target_user_id, customer_id, sub.id, type || "general", title, msgBody, extraData, "error", e.message?.slice(0, 200), effectiveStoreUserId);
      }
    }

    if (shouldMirrorInAppNotification) {
      await mirrorInAppNotification();
    }

    return json({ sent, total: subs.length, removed, failures });
  } catch (error: any) {
    console.error("Internal push error:", error);
    return json({ error: error.message }, 500);
  }
});

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function logPush(
  supabase: any,
  userId: string | null,
  customerId: string | null,
  subscriptionId: string | null,
  eventType: string,
  title: string,
  body: string | undefined,
  payload: any,
  status: string,
  errorMessage: string | null,
  storeUserId?: string | null
) {
  try {
    await supabase.from("push_logs").insert({
      user_id: userId,
      customer_id: customerId,
      subscription_id: subscriptionId,
      event_type: eventType,
      title,
      body: body || null,
      payload: payload || {},
      status,
      error_message: errorMessage,
      store_user_id: storeUserId || null,
    });
  } catch (e) {
    console.error("Failed to log push:", e);
  }
}

const STOPWORDS = new Set([
  "a", "o", "as", "os", "de", "da", "do", "das", "dos", "e", "em", "para", "por", "com", "sem",
  "na", "no", "nas", "nos", "um", "uma", "uns", "umas", "que", "se", "sua", "seu", "suas", "seus",
  "mais", "muito", "muita", "hoje", "ontem", "amanha", "voce", "você", "pra", "pro", "como", "essa",
  "esse", "bom", "boa", "dia", "tarde", "noite", "madrugada", "cartlly", "loja",
]);

const TOPIC_KEYWORDS: Array<{ topic: string; keywords: string[] }> = [
  { topic: "vendas", keywords: ["venda", "vendas", "fatur", "pedido", "pedidos", "ticket", "lucro", "resultado", "meta"] },
  { topic: "marketing", keywords: ["marketing", "campanha", "anuncio", "anuncios", "trafego", "instagram", "conteudo", "criativo", "rede social"] },
  { topic: "operacao", keywords: ["organiza", "catalogo", "estoque", "cadastro", "banner", "foto", "preco", "precificacao", "vitrine"] },
  { topic: "clientes", keywords: ["cliente", "clientes", "atendimento", "feedback", "avaliacao", "resposta", "relacionamento"] },
  { topic: "oferta", keywords: ["cupom", "desconto", "oferta", "promocao", "promo", "off"] },
  { topic: "recompra", keywords: ["carrinho", "checkout", "finalizar", "abandono", "voltar", "comprar"] },
];

const SIMILARITY_GUARD_TYPES = new Set([
  "motivational_push",
  "ceo_insight",
  "store_promotion",
  "abandoned_cart",
  "product_view",
  "product_view_10x",
  "new_product",
  "new_coupon",
  "review_thankyou",
  "new_customer",
]);

const STRICT_DIVERSITY_TYPES = new Set([
  "motivational_push",
  "ceo_insight",
  "store_promotion",
]);

function normalizeText(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeMeaningful(text: string) {
  return normalizeText(text)
    .split(" ")
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));
}

function detectTopic(text: string) {
  const normalized = normalizeText(text);
  let bestTopic = "other";
  let bestScore = 0;

  for (const entry of TOPIC_KEYWORDS) {
    const score = entry.keywords.reduce((total, keyword) => total + (normalized.includes(keyword) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      bestTopic = entry.topic;
    }
  }

  return bestScore > 0 ? bestTopic : "other";
}

function getOpeningSignature(text: string) {
  return normalizeText(text).split(" ").slice(0, 6).join(" ");
}

function jaccardSimilarity(a: string, b: string) {
  const setA = new Set(tokenizeMeaningful(a));
  const setB = new Set(tokenizeMeaningful(b));

  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection++;
  }

  return intersection / (setA.size + setB.size - intersection);
}

function getSimilarityBlockReason(
  title: string,
  body: string | undefined,
  historyTexts: string[],
  eventType: string,
) {
  if (!SIMILARITY_GUARD_TYPES.has(eventType)) return null;

  const candidate = `${title} ${body || ""}`.trim();
  if (!candidate) return "mensagem vazia";

  const strictTheme = STRICT_DIVERSITY_TYPES.has(eventType);
  const candidateTopic = detectTopic(candidate);

  if (strictTheme && candidateTopic !== "other") {
    const sameTopicCount = historyTexts.filter((previous) => detectTopic(previous) === candidateTopic).length;
    if (sameTopicCount >= 2) {
      return `tema repetido (${candidateTopic}) nas últimas 15`;
    }
  }

  for (const previous of historyTexts) {
    if (!previous) continue;

    const sameOpening = getOpeningSignature(candidate);
    if (sameOpening && sameOpening === getOpeningSignature(previous)) {
      return "abertura repetida nas últimas 15";
    }

    const samePrefix = normalizeText(candidate).slice(0, 24);
    if (samePrefix.length >= 16 && samePrefix === normalizeText(previous).slice(0, 24)) {
      return "prefixo repetido nas últimas 15";
    }

    const similarity = jaccardSimilarity(candidate, previous);
    if (similarity >= 0.52) {
      return `conteúdo muito parecido (${Math.round(similarity * 100)}%)`;
    }

    if (candidateTopic !== "other" && candidateTopic === detectTopic(previous) && similarity >= (strictTheme ? 0.18 : 0.32)) {
      return `mesma lógica de tema (${candidateTopic})`;
    }
  }

  return null;
}
