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

    const amplopayToken = req.headers.get("x-amplopay-token") || req.headers.get("authorization");
    const expectedToken = Deno.env.get("AMPLOPAY_WEBHOOK_SECRET");

    if (expectedToken && amplopayToken !== expectedToken) {
      console.error("[amplopay-webhook] Unauthorized: Invalid token");
      return new Response(JSON.stringify({ error: "Unauthorized" }), { 
        status: 401, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const body = await req.json();
    console.log("Amplopay webhook received:", JSON.stringify(body));


    const { event, token, transaction, subscription: subData, client, orderItems } = body;

    if (!event || !transaction) {
      return new Response(JSON.stringify({ error: "Payload inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract user_id and plan_id from the identifier
    // The identifier can come from transaction.identifier or subscription.identifier
    // Format: plan_{planId}_user_{userId}_{timestamp}
    const identifier = body.subscription?.identifier || transaction.identifier || "";
    const identifierParts = identifier.match(/plan_(.+?)_user_(.+?)_\d+$/);

    if (!identifierParts) {
      console.log("Could not parse identifier:", identifier);
      return new Response(JSON.stringify({ received: true, warning: "Unknown identifier format" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const planId = identifierParts[1];
    const userId = identifierParts[2];

    // Get plan info
    const { data: plan } = await supabase
      .from("tenant_plans")
      .select("*")
      .eq("id", planId)
      .single();

    const planName = plan?.name || "Plano";

    // Get tenant name
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", userId)
      .single();

    const tenantName = profile?.display_name || "Tenant";

    switch (event) {
      case "TRANSACTION_PAID": {
        if (transaction.status === "COMPLETED") {
          // Activate subscription
          const now = new Date();
          const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

          const { data: existingSub } = await supabase
            .from("tenant_subscriptions")
            .select("id")
            .eq("user_id", userId)
            .maybeSingle();

          if (existingSub) {
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
              .eq("id", existingSub.id);
          } else {
            await supabase
              .from("tenant_subscriptions")
              .insert({
                user_id: userId,
                plan_id: planId,
                status: "active",
                current_period_start: now.toISOString(),
                current_period_end: periodEnd.toISOString(),
              });
          }

          // Cancel pending plan change requests
          await supabase
            .from("plan_change_requests")
            .update({ status: "approved", resolved_at: now.toISOString() })
            .eq("user_id", userId)
            .eq("status", "pending");

          // Notify tenant
          const methodEmoji = transaction.paymentMethod === "PIX" ? "💰" :
            transaction.paymentMethod === "CREDIT_CARD" ? "💳" : "🧾";

          await supabase.from("admin_notifications").insert({
            sender_user_id: userId,
            target_user_id: userId,
            title: `${methodEmoji} Plano Ativado!`,
            message: `Seu plano ${planName} foi ativado com sucesso! Pagamento via ${
              transaction.paymentMethod === "PIX" ? "PIX" :
              transaction.paymentMethod === "CREDIT_CARD" ? "Cartão de Crédito" : "Boleto"
            }.`,
            type: "plan_activated",
          });

          // Notify super admins
          const { data: superAdmins } = await supabase
            .from("user_roles")
            .select("user_id")
            .eq("role", "super_admin");

          for (const admin of superAdmins || []) {
            await supabase.from("admin_notifications").insert({
              sender_user_id: userId,
              target_user_id: admin.user_id,
              title: `${methodEmoji} Pagamento Aprovado`,
              message: `${tenantName} pagou o plano ${planName} (R$ ${transaction.amount}) via ${transaction.paymentMethod}.`,
              type: "payment_approved",
            });
          }
        }
        break;
      }

      case "TRANSACTION_CANCELED":
      case "TRANSACTION_REFUNDED": {
        // Notify tenant
        await supabase.from("admin_notifications").insert({
          sender_user_id: userId,
          target_user_id: userId,
          title: event === "TRANSACTION_CANCELED" ? "❌ Pagamento Cancelado" : "🔄 Pagamento Estornado",
          message: `O pagamento do plano ${planName} foi ${event === "TRANSACTION_CANCELED" ? "cancelado" : "estornado"}.`,
          type: event === "TRANSACTION_CANCELED" ? "payment_canceled" : "payment_refunded",
        });

        // Update subscription status
        await supabase
          .from("tenant_subscriptions")
          .update({ status: "canceled", updated_at: new Date().toISOString() })
          .eq("user_id", userId);

        break;
      }

      case "TRANSACTION_CREATED": {
        console.log(`Transaction created for user ${userId}, plan ${planId}`);
        break;
      }

      default:
        console.log("Unhandled event:", event);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
