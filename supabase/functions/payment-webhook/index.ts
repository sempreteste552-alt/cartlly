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
    } else if (gateway === "stripe") {
      return await handleStripe(req, supabase);
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

  const isLegacy = !!body.topic && !!body.resource;
  const isNew = body.type === "payment" || body.action?.startsWith("payment.");

  if (!isLegacy && !isNew) {
    console.log("MP Webhook: Ignoring non-payment event:", JSON.stringify(body));
    return new Response(JSON.stringify({ received: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let paymentId = body.data?.id || body.id;
  if (isLegacy && body.topic === "payment") {
    const resource = body.resource;
    paymentId = resource.split("/").pop();
  }

  if (!paymentId) {
    console.log("MP Webhook: No payment ID found in body:", JSON.stringify(body));
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
      .update({ 
        status: newStatus, 
        status_detail: mpData.status_detail,
        raw_response: mpData 
      })
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
      console.log(`Updating order ${payment.order_id} to processando...`);
      const { error: orderUpdateErr } = await supabase.from("orders").update({ status: "processando" }).eq("id", payment.order_id);
      if (orderUpdateErr) {
        console.error("Error updating order status:", orderUpdateErr);
      } else {
        console.log(`Order ${payment.order_id} updated to processando successfully.`);
      }

      await supabase.from("order_status_history").insert({ order_id: payment.order_id, status: "pago" });

      // 🧠 AI Continuous Learning: Learn from purchase
      try {
        const { data: customer } = await supabase.from("customers")
          .select("id")
          .eq("store_user_id", payment.user_id)
          .eq("email", order?.customer_email)
          .maybeSingle();

        const { data: orderItems } = await supabase.from("order_items").select("product_name, quantity").eq("order_id", payment.order_id);
        const productList = (orderItems || []).map((i: any) => `${i.quantity}x ${i.product_name}`).join(", ");
        
        if (customer?.id) {
          await supabase.functions.invoke("ai-memory-manager", {
            body: {
              action: "learn-from-purchase",
              tenantId: payment.user_id,
              customerId: customer.id,
              metadata: { 
                orderId: payment.order_id, 
                amount: orderTotal,
                products: productList
              }
            }
          });
        }
      } catch (e) {
        console.warn("AI learning failed for purchase:", e);
      }

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
    await sendRichPush(payment.user_id, {
      title: "✅ Pagamento aprovado!",
      body: `Pagamento de R$ ${Number(payment.amount || 0).toFixed(2).replace(".", ",")} via Amplopay aprovado 💰`,
      url: "/admin/pedidos",
      type: "payment_approved",
      data: { orderId: payment.order_id, paymentId: payment.id },
    });
  } else if (newStatus === "rejected" || newStatus === "cancelled") {
    await supabase.from("orders").update({ status: "cancelado" }).eq("id", payment.order_id);
    await supabase.from("order_status_history").insert({ order_id: payment.order_id, status: "cancelado" });
    await sendRichPush(payment.user_id, {
      title: "❌ Pagamento recusado!",
      body: `Pagamento do pedido #${payment.order_id?.slice(0, 8)} foi recusado.`,
      url: "/admin/pedidos",
      type: "payment_rejected",
      data: { orderId: payment.order_id, paymentId: payment.id },
    });
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

      // Notify in-app
      await supabase.from("admin_notifications").insert({
        sender_user_id: userId,
        target_user_id: userId,
        title: "✅ Plano Ativado!",
        message: `Seu plano ${plan?.name || ""} foi ativado com sucesso via ${gateway === "mercadopago" ? "Mercado Pago" : "PagBank"}.`,
        type: "plan_activated",
      });

      // 🔔 Push: Plan activated
      await sendRichPush(userId, {
        title: "🎉 Plano Ativado!",
        body: `Seu plano ${plan?.name || ""} está ativo! Aproveite todas as funcionalidades 🚀`,
        url: "/admin/plano",
        type: "plan_activated",
        data: { planId, planName: plan?.name },
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


async function handleStripe(req: Request, supabase: any) {
  const url = new URL(req.url);
  const orderId = url.searchParams.get("order_id");
  const paymentIntentId = url.searchParams.get("payment_intent");

  console.log("Stripe Webhook/Redirect:", { orderId, paymentIntentId, method: req.method });

  if (req.method === "POST") {
    try {
      const body = await req.json();
      const event = body;
      const paymentIntent = event.data?.object;
      
      if (event.type === "payment_intent.succeeded" || event.type === "payment_intent.payment_failed" || event.type === "payment_intent.canceled") {
        const pOrderId = paymentIntent.metadata?.order_id || orderId;
        const status = event.type === "payment_intent.succeeded" ? "approved" : 
                       event.type === "payment_intent.canceled" ? "cancelled" : "rejected";

        if (pOrderId) {
          await processStatusUpdate(supabase, pOrderId, status, "stripe", paymentIntent.id, paymentIntent);
        }
      }
    } catch (e) {
      console.error("Stripe Webhook JSON error:", e.message);
    }
  } else if (req.method === "GET" && orderId && paymentIntentId) {
    // Redirection from Stripe checkout
    // We don't have the secret key here easily without finding the store owner
    // But we can check the status from the DB if it was already updated by webhook
    // or we can wait for the webhook to do it.
    // For now, let's just log and redirect the user back to the store
    console.log("Stripe Redirect GET received for order:", orderId);
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function processStatusUpdate(supabase: any, orderId: string, status: string, gateway: string, gatewayPaymentId: string, rawResponse: any) {
  console.log(`Processing status update for order ${orderId}: ${status} (${gateway})`);
  
  // Update payment record
  const { data: payment } = await supabase
    .from("payments")
    .update({ status, raw_response: rawResponse })
    .eq("order_id", orderId)
    .eq("gateway", gateway)
    .select("*, orders(*)")
    .maybeSingle();

  if (!payment) {
    console.error(`Payment not found for order ${orderId} and gateway ${gateway}`);
    return;
  }

  const order = payment.orders;
  const userId = payment.user_id;
  const customerName = order?.customer_name || "Cliente";
  const orderTotal = payment.amount || order?.total || 0;
  const formattedTotal = `R$ ${Number(orderTotal).toFixed(2).replace(".", ",")}`;
  const orderId8 = orderId.slice(0, 8);

  if (status === "approved") {
    await supabase.from("orders").update({ status: "processando" }).eq("id", orderId);
    await supabase.from("order_status_history").insert({ order_id: orderId, status: "pago" });

    await sendRichPush(userId, {
      title: "✅ Pagamento aprovado!",
      body: `${customerName} pagou ${formattedTotal} via ${gateway} 💰 Pedido #${orderId8}`,
      url: "/admin/pedidos",
      type: "payment_approved",
      data: { orderId, paymentId: payment.id, gateway },
    });
  } else if (status === "rejected" || status === "cancelled") {
    await supabase.from("orders").update({ status: "cancelado" }).eq("id", orderId);
    await supabase.from("order_status_history").insert({ order_id: orderId, status: "cancelado" });

    await sendRichPush(userId, {
      title: status === "rejected" ? "❌ Pagamento recusado!" : "⚠️ Pagamento cancelado",
      body: `Pagamento de ${formattedTotal} do pedido #${orderId8} foi ${status === "rejected" ? "recusado" : "cancelado"}.`,
      url: "/admin/pedidos",
      type: status === "rejected" ? "payment_rejected" : "payment_cancelled",
      data: { orderId, paymentId: payment.id },
    });
  }
}


async function sendRichPush(targetUserId: string, payload: {
  title: string;
  body: string;
  url?: string;
  type?: string;
  data?: any;
  tag?: string;
  store_user_id?: string;
}) {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const resp = await fetch(`${supabaseUrl}/functions/v1/send-push-internal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        target_user_id: targetUserId,
        title: payload.title,
        body: payload.body,
        url: payload.url || "/admin",
        type: payload.type || "general",
        data: payload.data || {},
        tag: payload.tag || payload.type || "default",
        ...(payload.store_user_id ? { store_user_id: payload.store_user_id } : {}),
      }),
    });
    if (!resp.ok) {
      const text = await resp.text();
      console.error("sendRichPush failed:", resp.status, text);
    } else {
      await resp.text();
    }
  } catch (e: any) {
    console.error("sendRichPush error:", e.message);
  }
}

/**
 * Notifica o cliente da loja (storefront) sobre mudança de pagamento.
 * - Insere uma mensagem no sininho da vitrine
 * - Envia push direto ao cliente (se subscrito)
 */
async function notifyCustomerStorefront(supabase: any, args: {
  storeUserId: string;
  customerEmail?: string | null;
  orderId: string;
  status: "approved" | "rejected" | "pending" | "cancelled";
  method: string;
  amount: number;
  productSummary?: string;
  storeSlug?: string;
}) {
  try {
    if (!args.customerEmail) return;

    const { data: customer } = await supabase
      .from("customers")
      .select("id, name, auth_user_id")
      .eq("store_user_id", args.storeUserId)
      .eq("email", args.customerEmail)
      .maybeSingle();

    if (!customer?.auth_user_id) return;

    const firstName = (customer.name || "").split(" ")[0] || "Tudo certo";
    const formattedTotal = `R$ ${Number(args.amount || 0).toFixed(2).replace(".", ",")}`;
    const orderId8 = args.orderId.slice(0, 8).toUpperCase();
    const methodLabel = args.method === "pix" ? "PIX"
      : args.method === "credit_card" ? "cartão"
      : args.method === "boleto" ? "boleto"
      : args.method === "debit_card" ? "cartão de débito"
      : args.method;
    const productPart = args.productSummary ? ` (${args.productSummary})` : "";
    const trackingUrl = args.storeSlug ? `/loja/${args.storeSlug}/rastreio/${args.orderId}` : "/";

    let title = "";
    let body = "";
    let messageType = "info";

    if (args.status === "approved") {
      title = `🎉 ${firstName}, seu pagamento foi aprovado!`;
      body = `Recebemos ${formattedTotal} no ${methodLabel}. Já estamos preparando seu pedido${productPart} com muito carinho 💛 Pedido #${orderId8}`;
      messageType = "success";
    } else if (args.status === "rejected") {
      title = `😕 Ops, ${firstName}, seu pagamento não passou`;
      body = `O ${methodLabel} de ${formattedTotal} foi recusado pelo banco. Não desanima! Tenta de novo ou escolhe outra forma — a gente te espera 💛 Pedido #${orderId8}`;
      messageType = "warning";
    } else if (args.status === "cancelled") {
      title = `Pedido cancelado`;
      body = `${firstName}, o pagamento de ${formattedTotal} (#${orderId8}) foi cancelado. Se foi engano, é só voltar e finalizar de novo 😉`;
      messageType = "warning";
    } else if (args.status === "pending") {
      title = `⏳ ${firstName}, estamos aguardando seu pagamento`;
      body = `Geramos seu ${methodLabel} de ${formattedTotal}. Assim que cair, avisamos por aqui! Pedido #${orderId8}`;
      messageType = "info";
    } else {
      return;
    }

    await supabase.from("tenant_messages").insert({
      source_tenant_id: args.storeUserId,
      sender_type: "tenant_admin",
      sender_user_id: args.storeUserId,
      audience_type: "tenant_admin_to_one_customer",
      target_area: "public_store",
      target_tenant_id: args.storeUserId,
      target_user_id: customer.auth_user_id,
      channel: "in_app",
      title,
      body,
      message_type: messageType,
      priority: args.status === "approved" || args.status === "rejected" ? "high" : "normal",
      is_global: false,
      status: "sent",
    });

    await sendRichPush(customer.auth_user_id, {
      title,
      body,
      url: trackingUrl,
      type: args.status === "approved" ? "payment_approved"
        : args.status === "rejected" ? "payment_rejected"
        : args.status === "pending" ? "payment_pending"
        : "order_update",
      data: { orderId: args.orderId, status: args.status, method: args.method },
      tag: `customer_payment_${args.orderId}`,
      store_user_id: args.storeUserId,
    });
  } catch (e: any) {
    console.error("notifyCustomerStorefront error:", e.message);
  }
}

