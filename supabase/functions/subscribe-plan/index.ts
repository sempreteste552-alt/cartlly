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
    const { user_id, plan_id, card_number, card_holder, card_expiry, card_cvv, gateway } = body;

    if (!user_id || !plan_id || !card_number || !card_holder || !card_expiry || !card_cvv) {
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

    // Get platform gateway settings
    const { data: settings } = await supabase
      .from("platform_settings")
      .select("key, value")
      .in("key", [
        "stripe_global_key",
        "stripe_publishable_key",
        "mercadopago_global_key",
        "mercadopago_public_key",
        "gateway_test_mode",
      ]);

    const cfg: Record<string, string> = {};
    settings?.forEach((s: any) => {
      cfg[s.key] = s.value?.value ?? "";
    });

    const selectedGateway = gateway || "stripe";
    let paymentResult: any = null;

    if (selectedGateway === "stripe") {
      paymentResult = await processStripe(cfg, plan, card_number, card_holder, card_expiry, card_cvv);
    } else if (selectedGateway === "mercadopago") {
      paymentResult = await processMercadoPago(cfg, plan, card_number, card_holder, card_expiry, card_cvv, user_id);
    } else {
      return new Response(JSON.stringify({ error: "Gateway não suportado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!paymentResult.success) {
      return new Response(JSON.stringify({ error: paymentResult.error || "Pagamento recusado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Payment approved — activate subscription
    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

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
          status: "active",
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
          trial_ends_at: null,
          updated_at: now.toISOString(),
        })
        .eq("id", existingSub.id);
    } else {
      await supabase
        .from("tenant_subscriptions")
        .insert({
          user_id,
          plan_id,
          status: "active",
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
        });
    }

    // Cancel any pending plan change requests
    await supabase
      .from("plan_change_requests")
      .update({ status: "approved", resolved_at: now.toISOString() })
      .eq("user_id", user_id)
      .eq("status", "pending");

    // Notify user
    await supabase.from("admin_notifications").insert({
      sender_user_id: user_id,
      target_user_id: user_id,
      title: "✅ Plano Ativado!",
      message: `Seu plano ${plan.name} foi ativado com sucesso. Pagamento via ${selectedGateway === "stripe" ? "Stripe" : "Mercado Pago"}.`,
      type: "plan_activated",
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Pagamento aprovado e plano ativado!",
        plan_name: plan.name,
        gateway_id: paymentResult.gateway_id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Subscribe error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function processStripe(
  cfg: Record<string, string>,
  plan: any,
  cardNumber: string,
  cardHolder: string,
  cardExpiry: string,
  cardCvv: string
) {
  const secretKey = cfg.stripe_global_key;
  if (!secretKey) return { success: false, error: "Stripe não configurado pelo administrador" };

  try {
    const [expMonth, expYear] = cardExpiry.split("/").map((s: string) => s.trim());

    // Create payment method
    const pmRes = await fetch("https://api.stripe.com/v1/payment_methods", {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(secretKey + ":")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        type: "card",
        "card[number]": cardNumber.replace(/\s/g, ""),
        "card[exp_month]": expMonth,
        "card[exp_year]": expYear.length === 2 ? `20${expYear}` : expYear,
        "card[cvc]": cardCvv,
      }),
    });
    const pm = await pmRes.json();
    if (pm.error) return { success: false, error: pm.error.message };

    // Create payment intent
    const piRes = await fetch("https://api.stripe.com/v1/payment_intents", {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(secretKey + ":")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        amount: String(Math.round(plan.price * 100)),
        currency: "brl",
        payment_method: pm.id,
        confirm: "true",
        description: `Assinatura plano ${plan.name}`,
        "automatic_payment_methods[enabled]": "true",
        "automatic_payment_methods[allow_redirects]": "never",
      }),
    });
    const pi = await piRes.json();

    if (pi.error) return { success: false, error: pi.error.message };
    if (pi.status === "succeeded" || pi.status === "requires_capture") {
      return { success: true, gateway_id: pi.id };
    }
    return { success: false, error: `Status: ${pi.status}` };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

async function processMercadoPago(
  cfg: Record<string, string>,
  plan: any,
  cardNumber: string,
  cardHolder: string,
  cardExpiry: string,
  cardCvv: string,
  userId: string
) {
  const accessToken = cfg.mercadopago_global_key;
  if (!accessToken) return { success: false, error: "Mercado Pago não configurado pelo administrador" };

  try {
    const [expMonth, expYear] = cardExpiry.split("/").map((s: string) => s.trim());

    const paymentBody = {
      transaction_amount: plan.price,
      description: `Assinatura plano ${plan.name}`,
      payment_method_id: "visa",
      payer: { email: `tenant-${userId}@cartlly.com` },
      card: {
        card_number: cardNumber.replace(/\s/g, ""),
        cardholder: { name: cardHolder },
        expiration_month: parseInt(expMonth),
        expiration_year: parseInt(expYear.length === 2 ? `20${expYear}` : expYear),
        security_code: cardCvv,
      },
      installments: 1,
      external_reference: `plan_${plan.id}_user_${userId}`,
    };

    const res = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": `plan-${plan.id}-${userId}-${Date.now()}`,
      },
      body: JSON.stringify(paymentBody),
    });
    const data = await res.json();

    if (data.status === "approved") {
      return { success: true, gateway_id: String(data.id) };
    }
    return {
      success: false,
      error: data.message || data.cause?.[0]?.description || `Status: ${data.status}`,
    };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
