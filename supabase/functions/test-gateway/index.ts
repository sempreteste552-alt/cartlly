// Edge function: test-gateway
// Tests connection to a payment gateway by performing a simple read-only API call.
// Body: { gateway: "asaas" | "mercadopago" | "amplopay" | "pagbank" | "stripe", api_key: string, public_key?: string, test_mode?: boolean }

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { gateway, api_key, public_key, test_mode } = await req.json();
    if (!gateway || !api_key) {
      return json({ ok: false, error: "Parâmetros 'gateway' e 'api_key' obrigatórios." }, 400);
    }

    if (gateway === "asaas") {
      const baseUrl = test_mode
        ? "https://api-sandbox.asaas.com/v3"
        : "https://api.asaas.com/v3";
      const r = await fetch(`${baseUrl}/myAccount`, {
        method: "GET",
        headers: { "access_token": api_key, "Content-Type": "application/json" },
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        const msg = data?.errors?.[0]?.description || `Erro Asaas (HTTP ${r.status})`;
        return json({ ok: false, error: msg, details: data }, 200);
      }
      return json({
        ok: true,
        gateway: "asaas",
        environment: test_mode ? "sandbox" : "production",
        account: { name: data?.name, email: data?.email, walletId: data?.walletId },
      });
    }

    if (gateway === "mercadopago") {
      // /users/me requires access token
      const r = await fetch("https://api.mercadopago.com/users/me", {
        headers: { Authorization: `Bearer ${api_key}` },
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        return json({ ok: false, error: data?.message || `Erro Mercado Pago (HTTP ${r.status})`, details: data }, 200);
      }
      return json({
        ok: true,
        gateway: "mercadopago",
        account: { id: data?.id, nickname: data?.nickname, email: data?.email, country_id: data?.country_id, site_id: data?.site_id },
      });
    }

    if (gateway === "stripe") {
      const r = await fetch("https://api.stripe.com/v1/account", {
        headers: { Authorization: `Bearer ${api_key}` },
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        return json({ ok: false, error: data?.error?.message || `Erro Stripe (HTTP ${r.status})`, details: data }, 200);
      }
      return json({
        ok: true,
        gateway: "stripe",
        account: { id: data?.id, email: data?.email, country: data?.country, business_type: data?.business_type, charges_enabled: data?.charges_enabled },
      });
    }

    if (gateway === "amplopay") {
      // Amplopay uses Basic Auth with publicKey:secretKey
      if (!public_key) {
        return json({ ok: false, error: "Amplopay requer Public Key + Secret Key." }, 400);
      }
      const auth = btoa(`${public_key}:${api_key}`);
      // Try a lightweight balance/account endpoint
      const r = await fetch("https://api.amplopay.com/v1/balance", {
        method: "GET",
        headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
      });
      const text = await r.text();
      let data: any = {};
      try { data = JSON.parse(text); } catch { data = { raw: text }; }
      if (!r.ok) {
        return json({ ok: false, error: data?.message || `Erro Amplopay (HTTP ${r.status})`, details: data }, 200);
      }
      return json({ ok: true, gateway: "amplopay", account: data });
    }

    if (gateway === "pagbank") {
      // PagBank: GET /public-keys requires bearer token
      const baseUrl = test_mode
        ? "https://sandbox.api.pagseguro.com"
        : "https://api.pagseguro.com";
      const r = await fetch(`${baseUrl}/public-keys`, {
        method: "POST",
        headers: { Authorization: `Bearer ${api_key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ type: "card" }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        return json({ ok: false, error: data?.error_messages?.[0]?.description || `Erro PagBank (HTTP ${r.status})`, details: data }, 200);
      }
      return json({
        ok: true,
        gateway: "pagbank",
        environment: test_mode ? "sandbox" : "production",
        public_key_preview: typeof data?.public_key === "string" ? data.public_key.slice(0, 40) + "..." : null,
      });
    }

    return json({ ok: false, error: `Gateway "${gateway}" não suportado.` }, 400);
  } catch (e: any) {
    console.error("test-gateway error:", e);
    return json({ ok: false, error: e?.message || "Erro inesperado" }, 500);
  }
});
