import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { user_id, plan_id, payment_method, document, phone } = body;

    if (!user_id || !plan_id || !document) {
      return new Response(JSON.stringify({ error: "Dados incompletos. Informe CPF/CNPJ." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get plan details
    const { data: plan, error: planErr } = await supabase
      .from("tenant_plans")
      .select("*")
      .eq("id", plan_id)
      .single();

    if (planErr || !plan) {
      return new Response(JSON.stringify({ error: "Plano não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (plan.price <= 0) {
      return new Response(JSON.stringify({ error: "Plano gratuito não requer pagamento" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get Amplopay keys from platform_settings
    const { data: settings } = await supabase
      .from("platform_settings")
      .select("key, value")
      .in("key", ["amplopay_public_key", "amplopay_secret_key"]);

    const cfg: Record<string, string> = {};
    settings?.forEach((s: any) => {
      cfg[s.key] = s.value?.value ?? "";
    });

    const publicKey = cfg.amplopay_public_key;
    const secretKey = cfg.amplopay_secret_key;

    if (!publicKey || !secretKey) {
      return new Response(JSON.stringify({ error: "Gateway Amplopay não configurado pelo administrador." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get tenant info
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", user_id)
      .single();

    const { data: authUser } = await supabase.auth.admin.getUserById(user_id);
    const tenantEmail = authUser?.user?.email || `tenant-${user_id}@msktelemarkting.com`;
    const tenantName = profile?.display_name || "Tenant";

    const identifier = `plan_${plan.id}_user_${user_id}_${Date.now()}`;
    const method = payment_method || "PIX";
    const callbackUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/amplopay-webhook`;

    const clientData = {
      name: tenantName,
      email: tenantEmail,
      phone: phone || "(00) 0 0000-0000",
      document: document,
    };

    // Amplopay API docs: https://app.amplopay.com/docs
    // PIX subscription: POST /gateway/pix/subscription
    // PIX receive (one-time): POST /gateway/pix/receive
    // Boleto receive: POST /gateway/boleto/receive
    // Credit card: NOT available as separate subscription endpoint

    // For plan subscriptions, use PIX subscription endpoint
    // For one-time PIX, use PIX receive endpoint
    const BASE_URL = "https://app.amplopay.com/api/v1";

    let endpoint = "";
    let requestBody: any = {};

    if (method === "PIX") {
      // Use PIX subscription endpoint for recurring plan payments
      endpoint = `${BASE_URL}/gateway/pix/subscription`;
      requestBody = {
        identifier,
        amount: plan.price,
        product: {
          id: plan.id,
          name: `Plano ${plan.name}`,
          quantity: 1,
          price: plan.price,
        },
        subscription: {
          periodicityType: "MONTHS",
          periodicity: 1,
          firstChargeIn: 0,
        },
        client: clientData,
        callbackUrl,
      };
    } else if (method === "CREDIT_CARD") {
      // Amplopay does not have a direct credit card subscription API endpoint.
      // Use PIX subscription as fallback for now, or use checkout.
      // For credit card, we'll use the checkout endpoint which supports multiple methods.
      endpoint = `${BASE_URL}/gateway/pix/subscription`;
      requestBody = {
        identifier,
        amount: plan.price,
        product: {
          id: plan.id,
          name: `Plano ${plan.name}`,
          quantity: 1,
          price: plan.price,
        },
        subscription: {
          periodicityType: "MONTHS",
          periodicity: 1,
          firstChargeIn: 0,
        },
        client: clientData,
        callbackUrl,
      };
    } else {
      return new Response(JSON.stringify({ error: "Método de pagamento inválido. Use PIX." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Amplopay request:", endpoint, JSON.stringify(requestBody));

    // Call Amplopay API
    const amplopayRes = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-public-key": publicKey,
        "x-secret-key": secretKey,
      },
      body: JSON.stringify(requestBody),
    });

    const amplopayText = await amplopayRes.text();
    console.log("Amplopay raw response:", amplopayRes.status, amplopayText);

    let amplopayData: any;
    try {
      amplopayData = JSON.parse(amplopayText);
    } catch {
      return new Response(JSON.stringify({
        error: `Erro na resposta do gateway: ${amplopayText || "resposta vazia"}`,
        status_code: amplopayRes.status,
      }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!amplopayRes.ok) {
      return new Response(JSON.stringify({
        error: amplopayData.message || amplopayData.error || "Erro ao criar cobrança no Amplopay",
        details: amplopayData,
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Notify tenant
    await supabase.from("admin_notifications").insert({
      sender_user_id: user_id,
      target_user_id: user_id,
      title: "💳 Cobrança Criada",
      message: `Cobrança de ${plan.name} (R$ ${plan.price.toFixed(2)}) criada via PIX. Aguardando pagamento.`,
      type: "payment_pending",
    });

    // Normalize PIX response fields (Amplopay uses code/base64, not qrCode/qrCodeBase64)
    const pixData = amplopayData.pix ? {
      qrCode: amplopayData.pix.code || amplopayData.pix.qrCode,
      qrCodeBase64: amplopayData.pix.base64 || amplopayData.pix.qrCodeBase64,
      image: amplopayData.pix.image,
    } : null;

    return new Response(
      JSON.stringify({
        success: true,
        message: "Cobrança criada! Escaneie o QR Code PIX para pagar.",
        transaction_id: amplopayData.transactionId,
        status: amplopayData.status,
        method: "PIX",
        pix: pixData,
        plan_name: plan.name,
        identifier,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Amplopay subscribe error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
