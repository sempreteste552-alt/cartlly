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
    const { user_id, plan_id, payment_method } = body;
    // payment_method: "PIX" | "CREDIT_CARD" | "BOLETO"

    if (!user_id || !plan_id) {
      return new Response(JSON.stringify({ error: "Dados incompletos" }), {
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

    // Get user email from auth
    const { data: authUser } = await supabase.auth.admin.getUserById(user_id);
    const tenantEmail = authUser?.user?.email || `tenant-${user_id}@cartlly.com`;
    const tenantName = profile?.display_name || "Tenant";

    const identifier = `plan_${plan.id}_user_${user_id}_${Date.now()}`;
    const method = payment_method || "PIX";

    // Determine Amplopay endpoint based on method
    let endpoint = "";
    let requestBody: any = {};

    const callbackUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/amplopay-webhook`;

    if (method === "PIX") {
      endpoint = "https://app.amplopay.com/api/v1/gateway/pix/subscription";
      requestBody = {
        identifier,
        amount: plan.price,
        product: {
          id: plan.id,
          name: `Plano ${plan.name}`,
          price: plan.price,
        },
        subscription: {
          periodicityType: "MONTHS",
          periodicity: 1,
          firstChargeIn: 0,
        },
        client: {
          name: tenantName,
          email: tenantEmail,
          phone: "(00) 0 0000-0000",
          document: "000.000.000-00",
        },
        callbackUrl,
      };
    } else {
      // For CREDIT_CARD and BOLETO, use the same structure
      // Amplopay may have different endpoints; using PIX subscription for now
      endpoint = "https://app.amplopay.com/api/v1/gateway/pix/subscription";
      requestBody = {
        identifier,
        amount: plan.price,
        product: {
          id: plan.id,
          name: `Plano ${plan.name}`,
          price: plan.price,
        },
        subscription: {
          periodicityType: "MONTHS",
          periodicity: 1,
          firstChargeIn: 0,
        },
        client: {
          name: tenantName,
          email: tenantEmail,
          phone: "(00) 0 0000-0000",
          document: "000.000.000-00",
        },
        callbackUrl,
      };
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

    const amplopayData = await amplopayRes.json();
    console.log("Amplopay response:", JSON.stringify(amplopayData));

    if (!amplopayRes.ok) {
      return new Response(JSON.stringify({
        error: amplopayData.message || "Erro ao criar cobrança no Amplopay",
        details: amplopayData,
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Store pending subscription info for webhook processing
    // Check if subscription exists
    const { data: existingSub } = await supabase
      .from("tenant_subscriptions")
      .select("id")
      .eq("user_id", user_id)
      .maybeSingle();

    if (existingSub) {
      await supabase
        .from("tenant_subscriptions")
        .update({
          plan_id,
          status: "pending_payment",
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingSub.id);
    } else {
      await supabase
        .from("tenant_subscriptions")
        .insert({
          user_id,
          plan_id,
          status: "pending_payment",
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

    // Return payment data (PIX QR code, etc.)
    return new Response(
      JSON.stringify({
        success: true,
        message: "Cobrança criada! Aguardando pagamento.",
        transaction_id: amplopayData.transactionId,
        status: amplopayData.status,
        pix: amplopayData.pix || null,
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
