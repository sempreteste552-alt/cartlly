import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * AI CEO Brain: Proactive Business Insights for Admins.
 * Runs periodically to analyze store data and push "money-making" ideas to admins.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    
    if (!lovableApiKey) {
      console.error("[ai-ceo-brain] LOVABLE_API_KEY is missing");
      return json({ error: "AI key not configured" }, 500);
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Get all stores/admins
    const { data: stores, error: storeErr } = await supabase
      .from("store_settings")
      .select("user_id, store_name, category");

    if (storeErr) throw storeErr;
    if (!stores || stores.length === 0) {
      return json({ message: "No stores to process" });
    }

    const results = [];

    for (const store of stores) {
      try {
        const userId = store.user_id;

        // 2. Fetch Rich Insights
        const { data: insights, error: insightErr } = await supabase.rpc("get_store_rich_insights", { p_user_id: userId });
        if (insightErr) {
          console.error(`[ai-ceo-brain] Insights error for ${userId}:`, insightErr);
          continue;
        }

        // 3. Ask AI for a CEO Insight
        const systemPrompt = `Você é o "Cérebro CEO", uma inteligência artificial de elite cujo único propósito é fazer os donos de loja (admins) ganharem muito dinheiro.
Sua personalidade: Amigável (como um braço direito/amigo), extremamente analítica, focada em resultados e proativa.
Você não manda mensagens chatas ou genéricas. Cada mensagem deve ser uma oportunidade real de lucro ou eficiência.

STATUS DA LOJA (${store.store_name}):
- Vendas (30d): R$ ${insights.sales_30d}
- Pedidos (30d): ${insights.orders_30d}
- Taxa de Carrinho Abandonado: ${insights.abandoned_rate}%
- Novos Clientes (30d): ${insights.new_customers_30d}
- Falhas de Pagamento (7d): ${insights.failed_payments_7d}
- Melhores Produtos: ${JSON.stringify(insights.top_products)}
- Piores Produtos (vistos mas pouco vendidos): ${JSON.stringify(insights.bottom_products)}

REGRAS:
1. Se os dados estiverem excelentes, dê um parabéns entusiasmado e uma dica de escala.
2. Se houver problemas (ex: muitos abandonos, pagamentos falhos, produtos sem giro), dê uma solução acionável IMEDIATA.
3. Use um tom de "amigo CEO" — direto ao ponto, encorajador.
4. Jamais repita a mesma ideia de forma idêntica a mensagens anteriores.
5. Se não houver nada de relevante para falar agora, responda apenas "[NO_INSIGHT]".

FORMATO DE RESPOSTA (JSON):
{
  "title": "Título curto e impactante (com emoji)",
  "message": "Corpo da mensagem curto e direto ao ponto"
}`;

        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lovableApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [{ role: "system", content: systemPrompt }],
            temperature: 0.8,
            response_format: { type: "json_object" }
          }),
        });

        const aiData = await aiResponse.json();
        const content = JSON.parse(aiData.choices[0].message.content);

        if (aiData.choices[0].message.content.includes("[NO_INSIGHT]")) {
          results.push({ userId, status: "skipped", reason: "AI decided no insight needed" });
          continue;
        }

        const { title, message } = content;

        // 4. Rate Limit & Dedup Check (using our new generic RPC)
        const { data: canSend, error: rateErr } = await supabase.rpc("can_send_message", {
          p_target_id: userId,
          p_title: title,
          p_body: message,
          p_cooldown_minutes: 5 // User requested at least 5 minutes
        });

        if (rateErr) {
          console.error(`[ai-ceo-brain] Rate check error for ${userId}:`, rateErr);
          continue;
        }

        if (!canSend) {
          results.push({ userId, status: "skipped", reason: "Rate limited or duplicate" });
          continue;
        }

        // 5. Save Notification & Send Push
        // Insert into admin_notifications
        const { error: notifErr } = await supabase
          .from("admin_notifications")
          .insert({
            sender_user_id: userId, // AI is acting as the system/store brain
            target_user_id: userId,
            title,
            message,
            type: "ceo_insight",
            read: false
          });

        if (notifErr) {
          console.error(`[ai-ceo-brain] Notification error for ${userId}:`, notifErr);
          continue;
        }

        // Trigger real push notification
        await fetch(`${supabaseUrl}/functions/v1/send-push-internal`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseKey}`
          },
          body: JSON.stringify({
            target_user_id: userId,
            title,
            body: message,
            type: "ceo_insight",
            store_user_id: userId,
            url: "/admin"
          }),
        });

        results.push({ userId, status: "sent", title });

      } catch (err: any) {
        console.error(`[ai-ceo-brain] Store error for ${store.user_id}:`, err);
        results.push({ userId: store.user_id, status: "error", message: err.message });
      }
    }

    return json({ processed: results.length, results });

  } catch (error: any) {
    console.error("[ai-ceo-brain] Fatal error:", error);
    return json({ error: error.message }, 500);
  }
});

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
