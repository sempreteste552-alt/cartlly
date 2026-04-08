import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    // Find abandoned carts: items added 30+ min ago, not recovered, reminder not sent recently
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    const { data: carts, error: cartErr } = await supabase
      .from("abandoned_carts")
      .select("*, customers!inner(name, email, auth_user_id, store_user_id)")
      .eq("recovered", false)
      .lt("abandoned_at", thirtyMinAgo)
      .or(`last_reminder_at.is.null,last_reminder_at.lt.${twoHoursAgo}`)
      .lt("reminder_sent_count", 3);

    if (cartErr) {
      console.error("Query error:", cartErr);
      return json({ error: cartErr.message }, 500);
    }

    if (!carts || carts.length === 0) {
      return json({ processed: 0, message: "No abandoned carts to process" });
    }

    let sent = 0;
    let skipped = 0;

    for (const cart of carts) {
      try {
        const customer = (cart as any).customers;
        if (!customer?.auth_user_id || !customer?.store_user_id) {
          skipped++;
          continue;
        }

        // Parse cart items for context
        const items = Array.isArray(cart.items) ? cart.items : [];
        const itemNames = items.slice(0, 3).map((i: any) => i.name || "Produto").join(", ");
        const totalValue = cart.total || items.reduce((s: number, i: any) => s + ((i.price || 0) * (i.quantity || 1)), 0);

        // Generate AI message
        let title = "🛒 Seus itens estão te esperando!";
        let body = `Olá ${customer.name}! Você deixou ${items.length} item(s) no carrinho. Finalize sua compra antes que acabem!`;

        if (lovableApiKey && items.length > 0) {
          try {
            const aiResp = await fetch("https://ai.lovable.dev/api/chat", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${lovableApiKey}`,
              },
              body: JSON.stringify({
                model: "google/gemini-2.5-flash-lite",
                messages: [
                  {
                    role: "system",
                    content: `Você é uma gestora de marketing e vendas experiente, educada e persuasiva. Seu objetivo é recuperar vendas de carrinhos abandonados de forma gentil, empática e profissional. Use emoji com moderação. Nunca invente escassez falsa. Seja direta e amigável.

REGRAS:
- Responda APENAS com JSON: {"title": "...", "body": "..."}
- title: máximo 50 caracteres, com 1 emoji no início
- body: máximo 120 caracteres, mencionando o produto ou valor
- Tom: amigável, educado, sem pressão exagerada
- Sempre personalize com o nome do cliente`,
                  },
                  {
                    role: "user",
                    content: `Cliente: ${customer.name}\nProdutos no carrinho: ${itemNames}\nValor total: R$ ${Number(totalValue).toFixed(2)}\nQuantidade de itens: ${items.length}\nTempo abandonado: ${cart.reminder_sent_count === 0 ? "30 minutos" : cart.reminder_sent_count === 1 ? "2 horas" : "4+ horas"}\n\nGere a notificação push de recuperação.`,
                  },
                ],
                max_tokens: 150,
                temperature: 0.7,
              }),
            });

            if (aiResp.ok) {
              const aiData = await aiResp.json();
              const content = aiData.choices?.[0]?.message?.content || "";
              const cleaned = content.replace(/```json\n?/g, "").replace(/```/g, "").trim();
              const parsed = JSON.parse(cleaned);
              if (parsed.title) title = parsed.title;
              if (parsed.body) body = parsed.body;
            }
          } catch (aiErr) {
            console.error("AI generation failed, using default message:", aiErr);
          }
        }

        // Send push via send-push-internal
        const pushResp = await fetch(`${supabaseUrl}/functions/v1/send-push-internal`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            target_user_id: customer.auth_user_id,
            title,
            body,
            url: "/",
            type: "abandoned_cart",
            store_user_id: customer.store_user_id,
            data: { cartId: cart.id, itemCount: items.length },
          }),
        });

        const pushData = await pushResp.json();

        // Update cart reminder tracking
        await supabase
          .from("abandoned_carts")
          .update({
            last_reminder_at: new Date().toISOString(),
            reminder_sent_count: (cart.reminder_sent_count || 0) + 1,
          })
          .eq("id", cart.id);

        // Log the automation execution
        await supabase.from("automation_executions").insert({
          user_id: customer.store_user_id,
          customer_id: cart.customer_id,
          trigger_type: "abandoned_cart",
          channel: "push",
          message_text: `${title} — ${body}`,
          ai_generated: !!lovableApiKey,
          status: pushData.sent > 0 ? "sent" : "failed",
          error_message: pushData.sent > 0 ? null : JSON.stringify(pushData).slice(0, 200),
        });

        if (pushData.sent > 0) sent++;
        else skipped++;
      } catch (err: any) {
        console.error(`Error processing cart ${cart.id}:`, err);
        skipped++;
      }
    }

    return json({ processed: carts.length, sent, skipped });
  } catch (error: any) {
    console.error("Abandoned cart recovery error:", error);
    return json({ error: error.message }, 500);
  }
});

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
