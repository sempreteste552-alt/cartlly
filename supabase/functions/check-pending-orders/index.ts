import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find orders that are "processando" (paid and waiting to be sent)
    const { data: pendingOrders, error: orderErr } = await supabase
      .from("orders")
      .select("user_id, id")
      .eq("status", "processando");

    if (orderErr) throw orderErr;

    if (!pendingOrders || pendingOrders.length === 0) {
      return new Response(JSON.stringify({ message: "No pending orders to notify" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Group by user_id
    const userStats = pendingOrders.reduce((acc: Record<string, number>, order) => {
      acc[order.user_id] = (acc[order.user_id] || 0) + 1;
      return acc;
    }, {});

    const results = [];
    for (const [userId, count] of Object.entries(userStats)) {
      console.log(`Sending notification to user ${userId} for ${count} orders`);
      
      const pushResp = await fetch(`${supabaseUrl}/functions/v1/send-push`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          targetUserId: userId,
          title: "🚀 Pedidos pendentes de envio!",
          body: `Você tem ${count} ${count === 1 ? 'pedido esperando' : 'pedidos esperando'} ser enviado após o pagamento.`,
          url: "/admin/vendas" // Assuming this is the admin sales page
        }),
      });

      const pushData = await pushResp.json();
      results.push({ userId, status: pushResp.status, ...pushData });
    }

    return new Response(JSON.stringify({ results }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in check-pending-orders:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
