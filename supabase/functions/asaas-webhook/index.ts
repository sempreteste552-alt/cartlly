import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, asaas-access-token",
};

/**
 * Asaas webhook receiver.
 * Configure in Asaas dashboard → Integrações → Webhooks:
 *   URL: https://<project>.supabase.co/functions/v1/asaas-webhook
 *   Events: PAYMENT_CONFIRMED, PAYMENT_RECEIVED, PAYMENT_OVERDUE, PAYMENT_REFUNDED, PAYMENT_DELETED
 *
 * Webhook payload reference: https://docs.asaas.com/docs/webhooks
 * { event: "PAYMENT_CONFIRMED", payment: { id, status, externalReference, value, ... } }
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

    // externalReference format: plan_<planId>_user_<userId>_<ts>
    const ref = String(payment.externalReference || "");
    const match = ref.match(/^plan_([a-f0-9-]+)_user_([a-f0-9-]+)/i);
    
    if (!match) {
      console.warn("[asaas-webhook] Invalid externalReference:", ref);
      // Try to find by customer id or other fields if possible, but for now stick to externalReference
      return new Response(JSON.stringify({ ok: true, ignored: "invalid ref" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [, planId, userId] = match;
    console.log(`[asaas-webhook] Event: ${event}, Plan: ${planId}, User: ${userId}`);

    // Confirmation events: https://docs.asaas.com/docs/webhooks#eventos-de-pagamento
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
      "PAYMENT_CHARGEBACK_DISPUTE",
      "PAYMENT_AWAITING_CHARGEBACK_REVERSAL"
    ].includes(event);

    if (isPaid) {
      console.log(`[asaas-webhook] Processing payment for user ${userId}`);
      
      // Activate subscription
      const { data: plan, error: planErr } = await supabase
        .from("tenant_plans")
        .select("name, price")
        .eq("id", planId)
        .single();

      if (planErr) {
        console.error("[asaas-webhook] Error fetching plan:", planErr);
      }

      const now = new Date();
      // Subscriptions are usually 30 days
      const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const { data: existing, error: subErr } = await supabase
        .from("tenant_subscriptions")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (subErr) {
        console.error("[asaas-webhook] Error fetching existing sub:", subErr);
      }

      if (existing) {
        console.log(`[asaas-webhook] Updating existing subscription ${existing.id}`);
        const { error: updateErr } = await supabase
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
          
        if (updateErr) console.error("[asaas-webhook] Update subscription error:", updateErr);
      } else {
        console.log(`[asaas-webhook] Creating new subscription for user ${userId}`);
        const { error: insertErr } = await supabase.from("tenant_subscriptions").insert({
          user_id: userId,
          plan_id: planId,
          status: "active",
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
        });
        
        if (insertErr) console.error("[asaas-webhook] Insert subscription error:", insertErr);
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

      // Resolve any pending plan-change requests
      await supabase
        .from("plan_change_requests")
        .update({ status: "approved", resolved_at: now.toISOString() })
        .eq("user_id", userId)
        .eq("status", "pending");

      // Ensure profile is active
      await supabase.from("profiles").update({ status: "active" }).eq("user_id", userId);

      // Notify tenant
      await supabase.from("admin_notifications").insert({
        sender_user_id: userId,
        target_user_id: userId,
        title: "✅ Pagamento confirmado!",
        message: `Plano ${plan?.name ?? ""} ativado com sucesso. Aproveite todos os recursos!`,
        type: "plan_activated",
      });
      
      console.log(`[asaas-webhook] Subscription successfully ${existing ? 'updated' : 'created'} for user ${userId}`);
    } else if (isFailed) {
      console.log(`[asaas-webhook] Payment failed/refunded for user ${userId}: ${event}`);
      await supabase.from("admin_notifications").insert({
        sender_user_id: userId,
        target_user_id: userId,
        title: "⚠️ Pagamento não concluído",
        message: `Sua cobrança (${event}) não foi processada ou foi estornada. Tente novamente ou contate o suporte.`,
        type: "payment_failed",
      });
    }

    return new Response(JSON.stringify({ ok: true, event, planId, userId }), {
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
