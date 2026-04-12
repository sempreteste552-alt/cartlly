import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STOPWORDS = new Set([
  "a", "o", "as", "os", "de", "da", "do", "das", "dos", "e", "em", "para", "por", "com", "sem",
  "na", "no", "nas", "nos", "um", "uma", "uns", "umas", "que", "se", "sua", "seu", "suas", "seus",
  "mais", "muito", "muita", "hoje", "ontem", "amanha", "voce", "você", "pra", "pro", "como", "essa",
  "esse", "bom", "boa", "dia", "tarde", "noite", "madrugada", "cartlly", "loja",
]);

const TOPIC_KEYWORDS: Array<{ topic: string; keywords: string[] }> = [
  { topic: "vendas", keywords: ["venda", "vendas", "fatur", "pedido", "pedidos", "ticket", "lucro", "resultado", "meta"] },
  { topic: "carrinho", keywords: ["carrinho", "checkout", "abandono", "abandono", "abandona", "abandono"] },
  { topic: "produtos", keywords: ["produto", "produtos", "catalogo", "estoque", "mix", "colecao", "vitrine"] },
  { topic: "clientes", keywords: ["cliente", "clientes", "recorrencia", "recompra", "atendimento", "fidelizacao", "avaliacao"] },
  { topic: "marketing", keywords: ["marketing", "campanha", "anuncio", "anuncios", "trafego", "instagram", "conteudo", "criativo"] },
  { topic: "pagamento", keywords: ["pagamento", "pagamentos", "pix", "boleto", "cartao", "falha", "falhas"] },
  { topic: "operacao", keywords: ["organiz", "processo", "margem", "preco", "precificacao", "banner", "foto"] },
];

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
      .select("user_id, store_name, store_category");

    if (storeErr) throw storeErr;
    if (!stores || stores.length === 0) {
      return json({ message: "No stores to process" });
    }

    const results = [];

    for (const store of stores) {
      try {
        const userId = store.user_id;

        const [
          { data: insights, error: insightErr },
          { data: aiConfig },
        ] = await Promise.all([
          supabase.rpc("get_store_rich_insights", { p_user_id: userId }),
          supabase.from("tenant_ai_brain_config").select("custom_instructions, niche, personality, store_knowledge, tone_of_voice, writing_style, approach_type, sending_rules, approved_examples, prohibitions, language_preferences, formality_level, emoji_usage, persuasion_style, brand_identity").eq("user_id", userId).maybeSingle(),
        ]);
        if (insightErr) {
          console.error(`[ai-ceo-brain] Insights error for ${userId}:`, insightErr);
          continue;
        }

        const storeNiche = aiConfig?.niche || store.store_category || "Loja virtual";
        const storeKnowledge = typeof aiConfig?.store_knowledge === "object" && aiConfig?.store_knowledge
          ? (aiConfig.store_knowledge as any).description || ""
          : "";
        const customInstructions = aiConfig?.custom_instructions || "";

        const { data: previousNotifs } = await supabase
          .from("admin_notifications")
          .select("title, message, created_at")
          .eq("target_user_id", userId)
          .eq("type", "ceo_insight")
          .order("created_at", { ascending: false })
          .limit(15);

        const historyTexts = (previousNotifs || [])
          .map((notification: any) => `${notification.title || ""} ${notification.message || ""}`.trim())
          .filter(Boolean);

        const previousMessages = historyTexts.length > 0
          ? historyTexts.map((msg, index) => `${index + 1}. ${msg}`).join("\n")
          : "Nenhuma mensagem anterior.";

        const frequentWords = [...new Set(historyTexts.flatMap((text) => tokenizeMeaningful(text)))].slice(0, 60).join(", ") || "nenhuma";

        const brainBlock = aiConfig ? [
          "MANDATORY TENANT-SPECIFIC TRAINING / TREINAMENTO OBRIGATÓRIO (MANDATORY PRIORITY):",
          aiConfig.brand_identity ? `BRAND IDENTITY / IDENTIDADE DA MARCA: ${aiConfig.brand_identity}` : "",
          aiConfig.niche ? `STORE NICHE / NICHO: ${aiConfig.niche}` : "",
          aiConfig.personality ? `DEFINED PERSONALITY / PERSONALIDADE: ${aiConfig.personality}` : "",
          aiConfig.tone_of_voice ? `TONE OF VOICE / TOM DE VOZ: ${aiConfig.tone_of_voice}` : "",
          aiConfig.writing_style ? `WRITING STYLE / ESTILO DE ESCRITA: ${aiConfig.writing_style}` : "",
          aiConfig.emoji_usage ? `EMOJI USAGE / USO DE EMOJIS: ${aiConfig.emoji_usage}` : "",
          aiConfig.prohibitions ? `STRICT PROHIBITIONS / PROIBIÇÕES (NEVER DO THIS): ${aiConfig.prohibitions}` : "",
          storeKnowledge ? `MANDATORY KNOWLEDGE BASE / BASE DE CONHECIMENTO:\n${storeKnowledge}` : "",
          aiConfig.custom_instructions ? `CUSTOM MERCHANT INSTRUCTIONS / INSTRUÇÕES DO LOJISTA:\n${aiConfig.custom_instructions}` : "",
          "\nCRITICAL HIERARCHY: 1. MERCHANT TRAINING > 2. DATA INSIGHTS > 3. AI OPTIMIZATIONS",
          "If any insight conflicts with the merchant's training above, YOU MUST CORRECT IT."
        ].filter(Boolean).join("\n") : "";

        const systemPrompt = `${brainBlock ? `${brainBlock}\n\n---\n\n` : ""}Você é o "Cérebro CEO", uma inteligência artificial de elite cujo único propósito é fazer os donos de loja ganharem muito dinheiro.

NICHO DA LOJA: ${storeNiche}
${storeKnowledge ? `\nCONHECIMENTO DA LOJA:\n${storeKnowledge}\n` : ""}
${customInstructions ? `\nINSTRUÇÕES DO LOJISTA:\n${customInstructions}\n` : ""}

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
- Piores Produtos: ${JSON.stringify(insights.bottom_products)}

Use terminologia do nicho "${storeNiche}" nas mensagens.

REGRAS CRÍTICAS:
- Analise as 15 mensagens anteriores antes de responder.
- NÃO repita abertura, emoji inicial, tema ou lógica.
- Se não houver nada novo, responda "[NO_INSIGHT]".

15 MENSAGENS ANTERIORES:
${previousMessages}

PALAVRAS JÁ GASTAS: ${frequentWords}

FORMATO (JSON):
{"title": "...", "message": "..."}`;

        const userPromptBase = `Crie UM insight novo para ${store.store_name}.
Escolha um ângulo realmente diferente do histórico acima.
Se houver problema, entregue solução prática. Se houver oportunidade, entregue ação objetiva.`;

        let selectedMessage: { title: string; message: string } | null = null;

        for (let attempt = 0; attempt < 4; attempt++) {
          const retryInstruction = attempt === 0
            ? ""
            : `\nREJEIÇÃO ${attempt}: a opção anterior repetiu abertura, lógica ou tema. Gere um insight com outro raciocínio.`;

          const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${lovableApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: `${userPromptBase}${retryInstruction}` },
              ],
              temperature: 1,
              response_format: { type: "json_object" },
            }),
          });

          const aiData = await aiResponse.json();
          const rawContent = aiData.choices?.[0]?.message?.content || "";

          if (rawContent.includes("[NO_INSIGHT]")) break;

          const candidate = parseGeneratedCopy(rawContent, ["message", "body"]);
          if (!candidate) continue;

          const similarityReason = getSimilarityBlockReason(candidate.title, candidate.body, historyTexts, true);
          if (similarityReason) {
            console.warn(`[ai-ceo-brain] Candidate rejected for ${userId} (${similarityReason})`);
            continue;
          }

          selectedMessage = {
            title: candidate.title.substring(0, 60),
            message: candidate.body.substring(0, 220),
          };
          break;
        }

        if (!selectedMessage) {
          results.push({ userId, status: "skipped", reason: "similarity_guard_or_no_insight" });
          continue;
        }

        const { title, message } = selectedMessage;

        const { data: canSend, error: rateErr } = await supabase.rpc("can_send_message", {
          p_target_id: userId,
          p_title: title,
          p_body: message,
          p_cooldown_minutes: 5,
        });

        if (rateErr) {
          console.error(`[ai-ceo-brain] Rate check error for ${userId}:`, rateErr);
          continue;
        }

        if (!canSend) {
          results.push({ userId, status: "skipped", reason: "rate_limited_or_duplicate" });
          continue;
        }

        const { error: notifErr } = await supabase
          .from("admin_notifications")
          .insert({
            sender_user_id: userId,
            target_user_id: userId,
            title,
            message,
            type: "ceo_insight",
            read: false,
          });

        if (notifErr) {
          console.error(`[ai-ceo-brain] Notification error for ${userId}:`, notifErr);
          continue;
        }

        await fetch(`${supabaseUrl}/functions/v1/send-push-internal`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({
            target_user_id: userId,
            title,
            body: message,
            type: "ceo_insight",
            store_user_id: userId,
            url: "/admin",
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

function normalizeText(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeMeaningful(text: string) {
  return normalizeText(text)
    .split(" ")
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));
}

function detectTopic(text: string) {
  const normalized = normalizeText(text);
  let bestTopic = "other";
  let bestScore = 0;

  for (const entry of TOPIC_KEYWORDS) {
    const score = entry.keywords.reduce((total, keyword) => total + (normalized.includes(keyword) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      bestTopic = entry.topic;
    }
  }

  return bestScore > 0 ? bestTopic : "other";
}

function getOpeningSignature(text: string) {
  return normalizeText(text).split(" ").slice(0, 6).join(" ");
}

function jaccardSimilarity(a: string, b: string) {
  const setA = new Set(tokenizeMeaningful(a));
  const setB = new Set(tokenizeMeaningful(b));

  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection++;
  }

  return intersection / (setA.size + setB.size - intersection);
}

function getSimilarityBlockReason(
  title: string,
  body: string | undefined,
  historyTexts: string[],
  strictTheme: boolean,
) {
  const candidate = `${title} ${body || ""}`.trim();
  if (!candidate) return "mensagem vazia";

  const candidateTopic = detectTopic(candidate);
  if (strictTheme && candidateTopic !== "other") {
    const sameTopicCount = historyTexts.filter((previous) => detectTopic(previous) === candidateTopic).length;
    if (sameTopicCount >= 2) {
      return `tema repetido (${candidateTopic})`;
    }
  }

  for (const previous of historyTexts) {
    if (!previous) continue;

    const sameOpening = getOpeningSignature(candidate);
    if (sameOpening && sameOpening === getOpeningSignature(previous)) {
      return "abertura repetida";
    }

    const samePrefix = normalizeText(candidate).slice(0, 24);
    if (samePrefix.length >= 16 && samePrefix === normalizeText(previous).slice(0, 24)) {
      return "prefixo repetido";
    }

    const similarity = jaccardSimilarity(candidate, previous);
    if (similarity >= 0.5) {
      return `conteúdo muito parecido (${Math.round(similarity * 100)}%)`;
    }

    if (candidateTopic !== "other" && candidateTopic === detectTopic(previous) && similarity >= (strictTheme ? 0.16 : 0.3)) {
      return `mesma lógica de tema (${candidateTopic})`;
    }
  }

  return null;
}

function parseGeneratedCopy(rawContent: string, bodyKeys: string[]) {
  try {
    const cleaned = rawContent.replace(/```json\s*/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    const title = typeof parsed.title === "string" ? parsed.title.trim() : "";
    const body = bodyKeys
      .map((key) => (typeof parsed[key] === "string" ? parsed[key].trim() : ""))
      .find(Boolean) || "";

    if (!title || !body) return null;
    return { title, body };
  } catch {
    return null;
  }
}
