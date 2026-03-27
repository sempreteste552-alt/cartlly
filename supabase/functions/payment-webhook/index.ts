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
    .select("gateway_secret_key, store_name")
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

    // Get order info for push notification
    const order = payment.orders;
    const customerName = order?.customer_name || "Cliente";
    const orderTotal = payment.amount || order?.total || 0;
    const formattedTotal = `R$ ${Number(orderTotal).toFixed(2).replace(".", ",")}`;
    const orderId8 = payment.order_id?.slice(0, 8) || "";
    const methodLabel = payment.method === "pix" ? "PIX" : payment.method === "credit_card" ? "Cartão" : payment.method === "boleto" ? "Boleto" : payment.method;

    // Update order status based on payment
    if (newStatus === "approved") {
      await supabase.from("orders").update({ status: "processando" }).eq("id", payment.order_id);
      await supabase.from("order_status_history").insert({ order_id: payment.order_id, status: "pago" });

      // 🔔 Push: Payment approved
      await sendRichPush(payment.user_id, {
        title: "✅ Pagamento aprovado!",
        body: `${customerName} pagou ${formattedTotal} via ${methodLabel} 💰 Pedido #${orderId8}`,
        url: "/admin/pedidos",
        type: "payment_approved",
        data: { orderId: payment.order_id, paymentId: payment.id, method: payment.method },
      });
    } else if (newStatus === "rejected" || newStatus === "cancelled") {
      await supabase.from("orders").update({ status: "cancelado" }).eq("id", payment.order_id);
      await supabase.from("order_status_history").insert({ order_id: payment.order_id, status: "cancelado" });

      // 🔔 Push: Payment rejected
      await sendRichPush(payment.user_id, {
        title: "❌ Pagamento recusado!",
        body: `Pagamento de ${formattedTotal} via ${methodLabel} do pedido #${orderId8} (${customerName}) foi recusado.`,
        url: "/admin/pedidos",
        type: "payment_rejected",
        data: { orderId: payment.order_id, paymentId: payment.id },
      });
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
      .select("*, orders(customer_name, total)")
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
        const cName = orderPayment.orders?.customer_name || "Cliente";
        const cTotal = `R$ ${Number(orderPayment.amount || 0).toFixed(2).replace(".", ",")}`;
        await sendRichPush(orderPayment.user_id, {
          title: "✅ Pagamento aprovado!",
          body: `${cName} pagou ${cTotal} via PagBank 💰`,
          url: "/admin/pedidos",
          type: "payment_approved",
          data: { orderId, paymentId: orderPayment.id },
        });
      } else if (newStatus === "rejected") {
        await sendRichPush(orderPayment.user_id, {
          title: "❌ Pagamento recusado!",
          body: `Pagamento do pedido #${orderId.slice(0, 8)} foi recusado no PagBank.`,
          url: "/admin/pedidos",
          type: "payment_rejected",
          data: { orderId, paymentId: orderPayment.id },
        });
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
      await sendRichPush(payment.user_id, {
        title: "✅ Pagamento aprovado!",
        body: `Pagamento de R$ ${Number(payment.amount || 0).toFixed(2).replace(".", ",")} via PagBank aprovado 💰`,
        url: "/admin/pedidos",
        type: "payment_approved",
        data: { orderId: payment.order_id, paymentId: payment.id },
      });
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

// ===================== PLAN SUBSCRIPTION ACTIVATION =====================

async function checkPlanSubscriptionWebhook(supabase: any, gateway: string, paymentId: string): Promise<boolean> {
  try {
    // Get platform gateway key to fetch payment details
    const keyName = gateway === "mercadopago" ? "mercadopago_global_key" : gateway === "pagbank" ? "pagbank_global_key" : "";
    if (!keyName) return false;

    const { data: settings } = await supabase.from("platform_settings").select("key, value").eq("key", keyName).single();
    const accessToken = settings?.value?.value;
    if (!accessToken) return false;

    let externalRef = "";
    let status = "";

    if (gateway === "mercadopago") {
      const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return false;
      const data = await res.json();
      externalRef = data.external_reference || "";
      status = data.status;
    }

    // Check if this is a plan subscription payment
    const match = externalRef.match(/^plan_(.+)_user_(.+?)(_\d+)?$/);
    if (!match) return false;

    const planId = match[1];
    const userId = match[2];

    if (status === "approved") {
      // Activate subscription
      const { data: plan } = await supabase.from("tenant_plans").select("name").eq("id", planId).single();
      await activatePlanSubscription(supabase, userId, planId);

      // Notify
      await supabase.from("admin_notifications").insert({
        sender_user_id: userId,
        target_user_id: userId,
        title: "✅ Plano Ativado!",
        message: `Seu plano ${plan?.name || ""} foi ativado com sucesso via ${gateway === "mercadopago" ? "Mercado Pago" : "PagBank"}.`,
        type: "plan_activated",
      });

      console.log(`Plan subscription activated: user=${userId}, plan=${planId}`);
      return true;
    }

    return false;
  } catch (e: any) {
    console.error("checkPlanSubscriptionWebhook error:", e.message);
    return false;
  }
}

async function activatePlanSubscription(supabase: any, userId: string, planId: string) {
  const now = new Date();
  const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const { data: existingSub } = await supabase
    .from("tenant_subscriptions")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existingSub) {
    await supabase.from("tenant_subscriptions").update({
      plan_id: planId,
      status: "active",
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
      trial_ends_at: null,
      updated_at: now.toISOString(),
    }).eq("id", existingSub.id);
  } else {
    await supabase.from("tenant_subscriptions").insert({
      user_id: userId,
      plan_id: planId,
      status: "active",
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
    });
  }

  // Cancel pending plan change requests
  await supabase.from("plan_change_requests")
    .update({ status: "approved", resolved_at: now.toISOString() })
    .eq("user_id", userId)
    .eq("status", "pending");
}
