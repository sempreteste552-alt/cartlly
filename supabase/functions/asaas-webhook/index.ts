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
    console.log("Asaas webhook received:", JSON.stringify(payload).slice(0, 500));


    const event = payload.event as string;
    const payment = payload.payment;

    if (!payment) {
      return new Response(JSON.stringify({ ok: true, ignored: "no payment" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // externalReference format: plan_<planId>_user_<userId>_<ts>
    const ref = String(payment.externalReference || "");
    const match = ref.match(/^plan_([a-f0-9-]+)_user_([a-f0-9-]+)/i);
    if (!match) {
      console.warn("Asaas webhook: invalid externalReference", ref);
      return new Response(JSON.stringify({ ok: true, ignored: "invalid ref" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [, planId, userId] = match;

    // Confirmation events
    const isPaid = event === "PAYMENT_CONFIRMED" || event === "PAYMENT_RECEIVED";
    const isFailed = event === "PAYMENT_OVERDUE" || event === "PAYMENT_DELETED" || event === "PAYMENT_REFUNDED";

    if (isPaid) {
      // Activate subscription
      const { data: plan } = await supabase
        .from("tenant_plans")
        .select("name, price")
        .eq("id", planId)
        .single();

      const now = new Date();
      const periodEnd = new Date(now.getTime() + 30 * 86400 * 1000);

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

      // Resolve any pending plan-change requests
      await supabase
        .from("plan_change_requests")
        .update({ status: "approved", resolved_at: now.toISOString() })
        .eq("user_id", userId)
        .eq("status", "pending");

      // Notify tenant
      await supabase.from("admin_notifications").insert({
        sender_user_id: userId,
        target_user_id: userId,
        title: "✅ Pagamento confirmado!",
        message: `Plano ${plan?.name ?? ""} ativado com sucesso. Aproveite todos os recursos!`,
        type: "plan_activated",
      });
    } else if (isFailed) {
      await supabase.from("admin_notifications").insert({
        sender_user_id: userId,
        target_user_id: userId,
        title: "⚠️ Pagamento não concluído",
        message: `Sua cobrança (${event}) não foi processada. Tente novamente ou contate o suporte.`,
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
