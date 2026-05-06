import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Daily routine to check for expired subscriptions and block users.
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
    const now = new Date();
    
    // 1. Find active subscriptions where current_period_end has passed
    const { data: expiredSubs, error: fetchErr } = await supabase
      .from("tenant_subscriptions")
      .select("*, profiles!inner(*)")
      .eq("status", "active")
      .lt("current_period_end", now.toISOString());

    if (fetchErr) throw fetchErr;

    console.log(`[subscription-checker] Found ${expiredSubs?.length || 0} expired subscriptions.`);

    for (const sub of (expiredSubs || [])) {
      // For Asaas subscriptions, we usually rely on the webhook to tell us when a payment is overdue.
      // But as a safety net, if the period has ended and no new payment recorded:
      
      console.log(`[subscription-checker] Blocking user ${sub.user_id} due to expired subscription ${sub.id}`);

      // Update subscription status
      await supabase
        .from("tenant_subscriptions")
        .update({ status: "pending", updated_at: now.toISOString() })
        .eq("id", sub.id);

      // Update profile status
      await supabase
        .from("profiles")
        .update({ status: "inativo" })
        .eq("user_id", sub.user_id);

      // Notify user
      await supabase.from("admin_notifications").insert({
        sender_user_id: sub.user_id,
        target_user_id: sub.user_id,
        title: "⚠️ Assinatura expirada",
        message: "Sua assinatura expirou e seu acesso foi limitado. Realize o pagamento para continuar usando.",
        type: "subscription_expired",
      });
      
      // Audit log
      await supabase.from("audit_logs").insert({
        action: "subscription_auto_blocked",
        target_type: "tenant",
        target_id: sub.user_id,
        details: { subscription_id: sub.id, expired_at: sub.current_period_end },
      });
    }

    return new Response(JSON.stringify({ 
      ok: true, 
      processed: expiredSubs?.length || 0 
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[subscription-checker] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
