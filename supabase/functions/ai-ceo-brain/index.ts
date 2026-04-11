import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

        // Fetch Rich Insights
        const { data: insights, error: insightErr } = await supabase.rpc("get_store_rich_insights", { p_user_id: userId });
        if (insightErr) {
          console.error(`[ai-ceo-brain] Insights error for ${userId}:`, insightErr);
          continue;
        }

        // Fetch last 20 CEO notifications to prevent ANY repetition
        const { data: previousNotifs } = await supabase
          .from("admin_notifications")
          .select("title, message, created_at")
          .eq("target_user_id", userId)
          .eq("type", "ceo_insight")
          .order("created_at", { ascending: false })
          .limit(20);

        const previousMessages = previousNotifs?.map(
          (n: any) => `[${n.title}] ${n.message}`
        ).join("\n") || "Nenhuma mensagem anterior.";

        // Extract unique words from previous messages for blacklist
        const allPrevWords = previousNotifs?.flatMap((n: any) => {
          const text = `${n.title} ${n.message}`.toLowerCase();
          return text.split(/\s+/).filter((w: string) => w.length > 4);
        }) || [];
        const frequentWords = [...new Set(allPrevWords)].slice(0, 50).join(", ");

        const systemPrompt = `Você é o "Cérebro CEO", uma inteligência artificial de elite cujo único propósito é fazer os donos de loja ganharem muito dinheiro.
Personalidade: Amigável, analítica, focada em resultados e proativa.

STATUS DA LOJA (${store.store_name}):
- Faturamento APROVADO (30d): R$ ${insights.sales_30d}
- Total gerado incluindo cancelados (30d): R$ ${insights.sales_total_30d || insights.sales_30d}
- Pedidos totais (30d): ${insights.orders_30d}
- Pedidos aprovados (30d): ${insights.approved_orders_30d || insights.orders_30d}
- Pedidos recusados/cancelados (30d): ${insights.refused_orders_30d || 0}
- Pedidos pendentes (30d): ${insights.pending_orders_30d || 0}
- Ticket médio (aprovados): R$ ${insights.avg_ticket || 0}
- Taxa de Carrinho Abandonado: ${insights.abandoned_rate}%
- Novos Clientes (30d): ${insights.new_customers_30d}
- Falhas de Pagamento (7d): ${insights.failed_payments_7d}
- Melhores Produtos: ${JSON.stringify(insights.top_products)}
- Piores Produtos (vistos mas pouco vendidos): ${JSON.stringify(insights.bottom_products)}

IMPORTANTE: "Faturamento" = APENAS pedidos aprovados.

===== REGRAS ANTI-REPETIÇÃO (OBRIGATÓRIO) =====
1. Abaixo estão TODAS as mensagens que você já enviou. Leia CADA UMA com atenção.
2. Sua nova mensagem NÃO PODE:
   - Começar com a mesma palavra ou emoji de qualquer mensagem anterior
   - Usar o mesmo tema/assunto (ex: se já falou de "carrinho abandonado", fale de OUTRO assunto)
   - Repetir NENHUMA frase, expressão ou estrutura similar
   - Usar gírias de dia da semana (Sextou, Sabadão, Segundou, etc.) se já usou antes
3. Se TODAS as ideias já foram cobertas, responda "[NO_INSIGHT]".
4. Cada mensagem deve trazer uma perspectiva 100% NOVA e ÚNICA.

MENSAGENS JÁ ENVIADAS (NUNCA REPITA NADA DAQUI):
${previousMessages}

PALAVRAS JÁ USADAS (EVITE TODAS):
${frequentWords}
=======================================

REGRAS DE CONTEÚDO:
1. Se os dados estiverem excelentes, dê parabéns com dica de escala.
2. Se houver problemas, dê solução acionável IMEDIATA.
3. Tom de "amigo CEO" — direto, encorajador.
4. Se não houver nada novo para falar, responda "[NO_INSIGHT]".

FORMATO (JSON):
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
            temperature: 0.9,
            response_format: { type: "json_object" }
          }),
        });

        const aiData = await aiResponse.json();
        const rawContent = aiData.choices?.[0]?.message?.content || "";

        if (rawContent.includes("[NO_INSIGHT]")) {
          results.push({ userId, status: "skipped", reason: "AI decided no insight needed" });
          continue;
        }

        let content;
        try {
          content = JSON.parse(rawContent);
        } catch {
          results.push({ userId, status: "skipped", reason: "Failed to parse AI response" });
          continue;
        }

        const { title, message } = content;
        if (!title || !message) {
          results.push({ userId, status: "skipped", reason: "Empty title or message" });
          continue;
        }

        // Rate Limit & Dedup Check
        const { data: canSend, error: rateErr } = await supabase.rpc("can_send_message", {
          p_target_id: userId,
          p_title: title,
          p_body: message,
          p_cooldown_minutes: 5
        });

        if (rateErr) {
          console.error(`[ai-ceo-brain] Rate check error for ${userId}:`, rateErr);
          continue;
        }

        if (!canSend) {
          results.push({ userId, status: "skipped", reason: "Rate limited or duplicate" });
          continue;
        }

        // Save Notification
        const { error: notifErr } = await supabase
          .from("admin_notifications")
          .insert({
            sender_user_id: userId,
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

        // Send push
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
