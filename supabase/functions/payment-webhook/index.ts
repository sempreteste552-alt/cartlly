import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

    const url = new URL(req.url);
    const gateway = url.searchParams.get("gateway");

    if (gateway === "mercadopago") {
      return await handleMercadoPago(req, supabase);
    } else if (gateway === "pagbank") {
      return await handlePagBank(req, supabase);
    } else if (gateway === "amplopay") {
      return await handleAmplopay(req, supabase);
    }

    return new Response(JSON.stringify({ error: "Gateway não especificado" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function handleMercadoPago(req: Request, supabase: any) {
  const body = await req.json();
  console.log("MP Webhook:", JSON.stringify(body));

  if (body.type !== "payment" && body.action !== "payment.updated") {
    return new Response(JSON.stringify({ received: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const paymentId = body.data?.id;
  if (!paymentId) {
    return new Response(JSON.stringify({ error: "No payment ID" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Find payment in our DB by gateway_payment_id
  const { data: payment, error: findErr } = await supabase
    .from("payments")
    .select("*, orders(*)")
    .eq("gateway_payment_id", String(paymentId))
    .eq("gateway", "mercadopago")
    .maybeSingle();

  if (findErr || !payment) {
    // Not a store payment — might be a plan subscription payment
    // Try to fetch from MP API using platform settings
    console.log("Store payment not found for MP ID:", paymentId, "— checking plan subscription...");
    const handled = await checkPlanSubscriptionWebhook(supabase, "mercadopago", paymentId);
    if (handled) {
      return new Response(JSON.stringify({ received: true, plan_activated: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ received: true, note: "payment_not_found" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Get store settings to fetch payment details from MP
  const { data: settings } = await supabase
    .from("store_settings")
    .select("gateway_secret_key")
    .eq("user_id", payment.user_id)
    .single();

  if (settings?.gateway_secret_key) {
    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${settings.gateway_secret_key}` },
    });
    const mpData = await mpResponse.json();

    const newStatus = mapMPStatus(mpData.status);

    await supabase
      .from("payments")
      .update({ status: newStatus, raw_response: mpData })
      .eq("id", payment.id);

    // Update order status based on payment
    if (newStatus === "approved") {
      await supabase.from("orders").update({ status: "processando" }).eq("id", payment.order_id);
      await supabase.from("order_status_history").insert({ order_id: payment.order_id, status: "pago" });
    } else if (newStatus === "rejected" || newStatus === "cancelled") {
      await supabase.from("orders").update({ status: "cancelado" }).eq("id", payment.order_id);
      await supabase.from("order_status_history").insert({ order_id: payment.order_id, status: "cancelado" });
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handlePagBank(req: Request, supabase: any) {
  const body = await req.json();
  console.log("PagBank Webhook:", JSON.stringify(body));

  const orderId = body.reference_id;
  const charges = body.charges || [];

  if (!orderId) {
    return new Response(JSON.stringify({ received: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Find payment by order_id
  const { data: payment } = await supabase
    .from("payments")
    .select("*")
    .eq("gateway", "pagbank")
    .or(`gateway_payment_id.eq.${body.id}`)
    .maybeSingle();

  if (!payment) {
    // Try by order reference
    const { data: orderPayment } = await supabase
      .from("payments")
      .select("*")
      .eq("gateway", "pagbank")
      .eq("order_id", orderId)
      .maybeSingle();

    if (orderPayment) {
      const chargeStatus = charges[0]?.status;
      const newStatus = mapPagBankStatus(chargeStatus);

      await supabase
        .from("payments")
        .update({ status: newStatus, raw_response: body })
        .eq("id", orderPayment.id);

      if (newStatus === "approved") {
        await supabase.from("orders").update({ status: "processando" }).eq("id", orderId);
        await supabase.from("order_status_history").insert({ order_id: orderId, status: "pago" });
      }
    }
  } else {
    const chargeStatus = charges[0]?.status;
    const newStatus = mapPagBankStatus(chargeStatus);

    await supabase
      .from("payments")
      .update({ status: newStatus, raw_response: body })
      .eq("id", payment.id);

    if (newStatus === "approved") {
      await supabase.from("orders").update({ status: "processando" }).eq("id", payment.order_id);
      await supabase.from("order_status_history").insert({ order_id: payment.order_id, status: "pago" });
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function mapMPStatus(status: string): string {
  const map: Record<string, string> = {
    approved: "approved",
    pending: "pending",
    authorized: "pending",
    in_process: "pending",
    in_mediation: "pending",
    rejected: "rejected",
    cancelled: "cancelled",
    refunded: "refunded",
  };
  return map[status] || "pending";
}

function mapPagBankStatus(status: string): string {
  const map: Record<string, string> = {
    PAID: "approved",
    AUTHORIZED: "pending",
    IN_ANALYSIS: "pending",
    DECLINED: "rejected",
    CANCELED: "cancelled",
  };
  return map[status] || "pending";
}

// ===================== AMPLOPAY =====================

async function handleAmplopay(req: Request, supabase: any) {
  const body = await req.json();
  console.log("Amplopay Webhook:", JSON.stringify(body));

  const transactionId = body.transactionId || body.id;
  const status = body.status;

  if (!transactionId) {
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: payment } = await supabase
    .from("payments")
    .select("*")
    .eq("gateway", "amplopay")
    .eq("gateway_payment_id", String(transactionId))
    .maybeSingle();

  if (!payment) {
    console.log("Payment not found for Amplopay ID:", transactionId);
    return new Response(JSON.stringify({ received: true, note: "payment_not_found" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const newStatus = mapAmplopayStatus(status);

  await supabase
    .from("payments")
    .update({ status: newStatus, raw_response: body })
    .eq("id", payment.id);

  if (newStatus === "approved") {
    await supabase.from("orders").update({ status: "processando" }).eq("id", payment.order_id);
    await supabase.from("order_status_history").insert({ order_id: payment.order_id, status: "pago" });
  } else if (newStatus === "rejected" || newStatus === "cancelled") {
    await supabase.from("orders").update({ status: "cancelado" }).eq("id", payment.order_id);
    await supabase.from("order_status_history").insert({ order_id: payment.order_id, status: "cancelado" });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function mapAmplopayStatus(status: string): string {
  const map: Record<string, string> = {
    PAID: "approved",
    CONFIRMED: "approved",
    RECEIVED: "approved",
    PENDING: "pending",
    OVERDUE: "pending",
    REFUNDED: "refunded",
    DELETED: "cancelled",
  };
  return map[status] || "pending";
}
