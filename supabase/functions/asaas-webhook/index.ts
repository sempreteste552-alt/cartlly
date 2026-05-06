import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, asaas-access-token",
};

/**
 * Asaas webhook receiver.
 * Handles both Platform Subscriptions (plan_...) and Store Sales (UUID orderId).
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const asaasToken = req.headers.get("asaas-access-token");
    const expectedToken = Deno.env.get("ASAAS_WEBHOOK_TOKEN");
    
    if (expectedToken && asaasToken !== expectedToken) {
      console.error("[asaas-webhook] Unauthorized: Invalid asaas-access-token");
      return new Response(JSON.stringify({ error: "Unauthorized" }), { 
        status: 401, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const payload = await req.json();
    console.log("[asaas-webhook] Payload received:", JSON.stringify(payload));

    const event = payload.event as string;
    const payment = payload.payment;

    if (!payment) {
      console.warn("[asaas-webhook] No payment object in payload");
      return new Response(JSON.stringify({ ok: true, ignored: "no payment" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // externalReference format:
    // 1. plan_<planId>_user_<userId>_<ts> (Platform Subscriptions)
    // 2. <orderId> (Store Sales)
    const ref = String(payment.externalReference || "");
    const planMatch = ref.match(/^plan_([a-f0-9-]+)_user_([a-f0-9-]+)/i);
    const orderMatch = ref.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    
    if (planMatch) {
      const [, planId, userId] = planMatch;
      console.log(`[asaas-webhook] Sub Event: ${event}, Plan: ${planId}, User: ${userId}`);

      // Confirmation events
      const isPaid = [
        "PAYMENT_CONFIRMED", 
        "PAYMENT_RECEIVED", 
        "PAYMENT_CREDITED",
        "SUBSCRIPTION_PAYMENT_CONFIRMED",
        "SUBSCRIPTION_PAYMENT_RECEIVED"
      ].includes(event);
      
      const isFailed = [
        "PAYMENT_OVERDUE", 
        "PAYMENT_DELETED", 
        "PAYMENT_REFUNDED",
        "PAYMENT_CHARGEBACK_REQUESTED",
        "PAYMENT_CHARGEBACK_DISPUTE"
      ].includes(event);

      if (isPaid) {
        console.log(`[asaas-webhook] Processing payment for user ${userId}`);
        
        // Activate subscription
        const { data: plan, error: planErr } = await supabase
          .from("tenant_plans")
          .select("name, price")
          .eq("id", planId)
          .single();

        if (planErr) console.error("[asaas-webhook] Error fetching plan:", planErr);

        const now = new Date();
        const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

        const { data: existing } = await supabase
          .from("tenant_subscriptions")
          .select("id")
          .eq("user_id", userId)
          .maybeSingle();

        if (existing) {
          await supabase
            .from("tenant_subscriptions")
            .update({
              plan_id: planId,
              status: "active",
              current_period_start: now.toISOString(),
              current_period_end: periodEnd.toISOString(),
              trial_ends_at: null,
              updated_at: now.toISOString(),
            })
            .eq("id", existing.id);
        } else {
          await supabase.from("tenant_subscriptions").insert({
            user_id: userId,
            plan_id: planId,
            status: "active",
            current_period_start: now.toISOString(),
            current_period_end: periodEnd.toISOString(),
          });
        }

        // Record payment
        await supabase.from("payments").insert({
          user_id: userId,
          amount: payment.value,
          gateway: "asaas",
          method: payment.billingType?.toLowerCase() || "unknown",
          status: "approved",
          external_id: payment.id,
        });

        // Resolve pending plan-change requests
        await supabase
          .from("plan_change_requests")
          .update({ status: "approved", resolved_at: now.toISOString() })
          .eq("user_id", userId)
          .eq("status", "pending");

        // Ensure profile is active
        await supabase.from("profiles").update({ status: "active" }).eq("user_id", userId);

        // Audit log
        await supabase.from("audit_logs").insert({
          action: "asaas_payment_confirmed",
          target_type: "tenant",
          target_id: userId,
          target_name: plan?.name || "Premium",
          details: { payment_id: payment.id, event, value: payment.value, plan_id: planId },
        });

        // Notify tenant
        await supabase.from("admin_notifications").insert({
          sender_user_id: userId,
          target_user_id: userId,
          title: "✅ Pagamento confirmado!",
          message: `Plano ${plan?.name ?? ""} ativado com sucesso. Aproveite todos os recursos!`,
          type: "plan_activated",
        });
      } else if (isFailed) {
        await supabase.from("audit_logs").insert({
          action: "asaas_payment_failed",
          target_type: "tenant",
          target_id: userId,
          details: { payment_id: payment.id, event },
        });
        await supabase.from("admin_notifications").insert({
          sender_user_id: userId,
          target_user_id: userId,
          title: "⚠️ Pagamento não concluído",
          message: `Sua cobrança (${event}) não foi processada ou foi estornada.`,
          type: "payment_failed",
        });
      }
    } else if (orderMatch) {
      const orderId = ref;
      console.log(`[asaas-webhook] Order Event: ${event}, OrderId: ${orderId}`);

      const isPaid = [
        "PAYMENT_CONFIRMED", 
        "PAYMENT_RECEIVED", 
        "PAYMENT_CREDITED",
        "RECEIVED_IN_CASH"
      ].includes(event);
      
      const isFailed = [
        "PAYMENT_OVERDUE", 
        "PAYMENT_DELETED", 
        "PAYMENT_REFUNDED",
        "PAYMENT_CHARGEBACK_REQUESTED"
      ].includes(event);

      const status = isPaid ? "approved" : isFailed ? "rejected" : "pending";
      
      if (isPaid || isFailed) {
        await processStorePaymentUpdate(supabase, orderId, status, "asaas", payment.id, payment);
      }
    } else {
      console.warn("[asaas-webhook] Invalid externalReference:", ref);
      return new Response(JSON.stringify({ ok: true, ignored: "invalid ref" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, event }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Asaas webhook error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function processStorePaymentUpdate(supabase: any, orderId: string, status: string, gateway: string, gatewayPaymentId: string, rawResponse: any) {
  console.log(`[asaas-webhook] Processing status update for order ${orderId}: ${status}`);
  
  const { data: payment, error: pErr } = await supabase
    .from("payments")
    .update({ status, raw_response: rawResponse })
    .eq("order_id", orderId)
    .eq("gateway", gateway)
    .select("*, orders(*)")
    .maybeSingle();

  if (pErr || !payment) {
    console.error(`[asaas-webhook] Payment not found for order ${orderId} and gateway ${gateway}`, pErr);
    return;
  }

  const order = payment.orders;
  const userId = payment.user_id;
  const customerName = order?.customer_name || "Cliente";
  const orderTotal = payment.amount || order?.total || 0;
  const formattedTotal = `R$ ${Number(orderTotal).toFixed(2).replace(".", ",")}`;
  const orderId8 = orderId.slice(0, 8).toUpperCase();

  if (status === "approved") {
    await supabase.from("orders").update({ status: "processando" }).eq("id", orderId);
    await supabase.from("order_status_history").insert({ order_id: orderId, status: "pago" });

    await sendRichPush(userId, {
      title: "✅ Pagamento aprovado!",
      body: `${customerName} pagou ${formattedTotal} via Asaas 💰 Pedido #${orderId8}`,
      url: "/admin/pedidos",
      type: "payment_approved",
      data: { orderId, paymentId: payment.id, gateway },
    });

    try {
      const { data: storeMeta } = await supabase.from("store_settings").select("store_slug").eq("user_id", userId).maybeSingle();
      const productSummary = (await supabase.from("order_items").select("product_name, quantity").eq("order_id", orderId)).data
        ?.map((i: any) => `${i.quantity}x ${i.product_name}`).slice(0, 2).join(", ");
        
      await notifyCustomerStorefront(supabase, {
        storeUserId: userId,
        customerEmail: order?.customer_email,
        orderId: orderId,
        status: "approved",
        method: payment.method,
        amount: orderTotal,
        productSummary,
        storeSlug: storeMeta?.store_slug,
      });
    } catch (e) {
      console.error("[asaas-webhook] Failed to notify customer:", e);
    }
  } else if (status === "rejected") {
    await supabase.from("orders").update({ status: "cancelado" }).eq("id", orderId);
    await supabase.from("order_status_history").insert({ order_id: orderId, status: "cancelado" });

    await sendRichPush(userId, {
      title: "❌ Pagamento recusado!",
      body: `Pagamento de ${formattedTotal} do pedido #${orderId8} foi recusado via Asaas.`,
      url: "/admin/pedidos",
      type: "payment_rejected",
      data: { orderId, paymentId: payment.id },
    });
  }
}

async function sendRichPush(targetUserId: string, payload: any) {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    await fetch(`${supabaseUrl}/functions/v1/send-push-internal`, {
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
      }),
    });
  } catch (e: any) {
    console.error("sendRichPush error:", e.message);
  }
}

async function notifyCustomerStorefront(supabase: any, args: any) {
  try {
    if (!args.customerEmail) return;

    const { data: customer } = await supabase
      .from("customers")
      .select("id, name, auth_user_id")
      .eq("store_user_id", args.storeUserId)
      .eq("email", args.customerEmail)
      .maybeSingle();

    if (!customer?.auth_user_id) return;

    const firstName = (customer.name || "").split(" ")[0] || "Cliente";
    const formattedTotal = `R$ ${Number(args.amount || 0).toFixed(2).replace(".", ",")}`;
    const orderId8 = args.orderId.slice(0, 8).toUpperCase();
    const trackingUrl = args.storeSlug ? `/loja/${args.storeSlug}/rastreio/${args.orderId}` : "/";

    let title = "";
    let body = "";
    let messageType = "info";

    if (args.status === "approved") {
      title = `🎉 ${firstName}, seu pagamento foi aprovado!`;
      body = `Recebemos ${formattedTotal}. Já estamos preparando seu pedido com muito carinho 💛 Pedido #${orderId8}`;
      messageType = "success";
    } else if (args.status === "rejected") {
      title = `😕 Ops, ${firstName}, seu pagamento não passou`;
      body = `O pagamento de ${formattedTotal} foi recusado. Tente novamente ou escolha outra forma 💛 Pedido #${orderId8}`;
      messageType = "warning";
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
      priority: "high",
      is_global: false,
      status: "sent",
    });

    await sendRichPush(customer.auth_user_id, {
      title,
      body,
      url: trackingUrl,
      type: args.status === "approved" ? "payment_approved" : "payment_rejected",
      data: { orderId: args.orderId, status: args.status },
      store_user_id: args.storeUserId,
    });
  } catch (e: any) {
    console.error("notifyCustomerStorefront error:", e.message);
  }
}
