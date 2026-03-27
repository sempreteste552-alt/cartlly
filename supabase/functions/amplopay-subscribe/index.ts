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
    const { user_id, plan_id, payment_method, document, phone, card } = body;

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
      return new Response(JSON.stringify({ error: "Gateway Amplopay não configurado pelo administrador. Entre em contato com o suporte." }), {
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
    const tenantEmail = authUser?.user?.email || `tenant-${user_id}@cartlly.com`;
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

    const productData = {
      id: plan.id,
      name: `Plano ${plan.name}`,
      price: plan.price,
    };

    const subscriptionData = {
      periodicityType: "MONTHS",
      periodicity: 1,
      firstChargeIn: 0,
    };

    let endpoint = "";
    let requestBody: any = {};

    if (method === "PIX") {
      endpoint = "https://app.amplopay.com/api/v1/gateway/pix/subscription";
      requestBody = {
        identifier,
        amount: plan.price,
        product: productData,
        subscription: subscriptionData,
        client: clientData,
        callbackUrl,
      };
    } else if (method === "CREDIT_CARD") {
      endpoint = "https://app.amplopay.com/api/v1/gateway/credit-card/subscription";
      requestBody = {
        identifier,
        amount: plan.price,
        product: productData,
        subscription: subscriptionData,
        client: clientData,
        callbackUrl,
        card: card || undefined,
      };
    } else if (method === "BOLETO") {
      endpoint = "https://app.amplopay.com/api/v1/gateway/boleto/subscription";
      requestBody = {
        identifier,
        amount: plan.price,
        product: productData,
        subscription: subscriptionData,
        client: clientData,
        callbackUrl,
      };
    } else {
      return new Response(JSON.stringify({ error: "Método de pagamento inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
      message: `Cobrança de ${plan.name} (R$ ${plan.price.toFixed(2)}) criada via ${method}. Aguardando pagamento.`,
      type: "payment_pending",
    });

    // Return payment data
    return new Response(
      JSON.stringify({
        success: true,
        message: "Cobrança criada! Aguardando pagamento.",
        transaction_id: amplopayData.transactionId,
        status: amplopayData.status,
        method,
        pix: amplopayData.pix || null,
        boleto: amplopayData.boleto || null,
        card: amplopayData.card || null,
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
