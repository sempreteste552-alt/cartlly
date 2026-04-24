import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { callAI } from "../_shared/ai-service.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STOPWORDS = new Set([
  "a", "o", "as", "os", "de", "da", "do", "das", "dos", "e", "em", "para", "por", "com", "sem",
  "na", "no", "nas", "nos", "um", "uma", "uns", "umas", "que", "se", "sua", "seu", "suas", "seus",
  "mais", "muito", "muita", "hoje", "ontem", "amanha", "você", "voce", "pra", "pro", "como", "sua",
  "loja", "cartlly", "bom", "boa", "dia", "tarde", "noite", "madrugada", "aqui", "essa", "esse",
]);

const TOPIC_KEYWORDS: Array<{ topic: string; keywords: string[] }> = [
  { topic: "vendas", keywords: ["venda", "vendas", "fatur", "pedido", "pedidos", "ticket", "lucro", "resultado", "meta"] },
  { topic: "marketing", keywords: ["marketing", "campanha", "anuncio", "anuncios", "trafego", "instagram", "conteudo", "criativo", "rede social"] },
  { topic: "operacao", keywords: ["organiza", "catalogo", "estoque", "cadastro", "banner", "foto", "preco", "precificacao", "vitrine"] },
  { topic: "clientes", keywords: ["cliente", "clientes", "atendimento", "feedback", "avaliacao", "resposta", "relacionamento"] },
  { topic: "motivacao", keywords: ["foco", "constancia", "disciplina", "energia", "coragem", "persistencia", "forca"] },
  { topic: "oferta", keywords: ["cupom", "desconto", "oferta", "promocao", "promo", "off"] },
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { user_id } = await req.json();
    if (!user_id) throw new Error("user_id required");

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user_id)
      .eq("role", "super_admin")
      .maybeSingle();

    if (roleData) {
      return new Response(JSON.stringify({ skipped: true, reason: "super_admin" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const todayStart = getNowBrasilia();
    todayStart.setHours(0, 0, 0, 0);

    const { data: todayPushes, error: countErr } = await supabase
      .from("push_logs")
      .select("id")
      .eq("user_id", user_id)
      .eq("event_type", "motivational_push")
      .eq("status", "sent")
      .gte("created_at", todayStart.toISOString());

    if (countErr) throw countErr;

    if ((todayPushes?.length || 0) >= 2) {
      return new Response(JSON.stringify({ skipped: true, reason: "limit_reached" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", user_id)
      .maybeSingle();

    const { data: storeSetting } = await supabase
      .from("store_settings")
      .select("store_name")
      .eq("user_id", user_id)
      .maybeSingle();

    const { data: recentOrders } = await supabase
      .from("orders")
      .select("id, total")
      .eq("user_id", user_id)
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .neq("status", "cancelado");

    const orderCount = recentOrders?.length || 0;
    const revenue = recentOrders?.reduce((sum: number, order: any) => sum + (order.total || 0), 0) || 0;

    const { count: productCount } = await supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user_id)
      .eq("published", true);

    const { count: customerCount } = await supabase
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("store_user_id", user_id);

    const tenantName = profile?.display_name || storeSetting?.store_name || "Lojista";
    const storeName = storeSetting?.store_name || "sua loja";
    const isFirstPush = (todayPushes?.length || 0) === 0;

    const { data: aiConfig } = await supabase
      .from("tenant_ai_brain_config")
      .select("custom_instructions, niche, personality, store_knowledge, tone_of_voice, writing_style, approach_type, sending_rules, approved_examples, prohibitions, language_preferences, formality_level, emoji_usage, persuasion_style, brand_identity")
      .eq("user_id", user_id)
      .maybeSingle();
    const customInstructions = aiConfig?.custom_instructions || "";
    const storeNiche = aiConfig?.niche || "";
    const storeKnowledge = typeof aiConfig?.store_knowledge === "object" && aiConfig?.store_knowledge
      ? (aiConfig.store_knowledge as any).description || ""
      : "";

    const { data: lastMsgs } = await supabase
      .from("push_logs")
      .select("body, title, created_at")
      .eq("user_id", user_id)
      .eq("event_type", "motivational_push")
      .eq("status", "sent")
      .order("created_at", { ascending: false })
      .limit(15);

    const historyTexts = (lastMsgs || [])
      .map((msg: any) => `${msg.title || ""} ${msg.body || ""}`.trim())
      .filter(Boolean);

    const recentMessages = historyTexts.length > 0
      ? historyTexts.map((msg, index) => `${index + 1}. ${msg}`).join("\n")
      : "Nenhuma mensagem anterior.";

    const prevWords = historyTexts.flatMap((text) =>
      tokenizeMeaningful(text).filter((word) => word.length > 3),
    );
    const wordBlacklist = [...new Set(prevWords)].slice(0, 80).join(", ") || "nenhuma";

    const nowBrasilia = getNowBrasilia();
    const hour = nowBrasilia.getHours();
    const greeting = hour < 6 ? "Boa madrugada" : hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
    const dayOfWeek = nowBrasilia.toLocaleDateString("pt-BR", { weekday: "long" });

    const brainBlock = aiConfig ? [
      "MANDATORY TENANT-SPECIFIC TRAINING / TREINAMENTO OBRIGATÓRIO (MANDATORY PRIORITY):",
      aiConfig.brand_identity ? `BRAND IDENTITY / IDENTIDADE DA MARCA: ${aiConfig.brand_identity}` : "",
      storeNiche ? `STORE NICHE / NICHO: ${storeNiche}` : "",
      aiConfig.personality ? `DEFINED PERSONALITY / PERSONALIDADE: ${aiConfig.personality}` : "",
      aiConfig.tone_of_voice ? `TONE OF VOICE / TOM DE VOZ: ${aiConfig.tone_of_voice}` : "",
      aiConfig.writing_style ? `WRITING STYLE / ESTILO DE ESCRITA: ${aiConfig.writing_style}` : "",
      aiConfig.emoji_usage ? `EMOJI USAGE / USO DE EMOJIS: ${aiConfig.emoji_usage}` : "",
      aiConfig.prohibitions ? `STRICT PROHIBITIONS / PROIBIÇÕES (NEVER DO THIS): ${aiConfig.prohibitions}` : "",
      storeKnowledge ? `MANDATORY KNOWLEDGE BASE / BASE DE CONHECIMENTO:\n${storeKnowledge}` : "",
      customInstructions ? `CUSTOM MERCHANT INSTRUCTIONS / INSTRUÇÕES DO LOJISTA:\n${customInstructions}` : "",
      "\nCRITICAL HIERARCHY: 1. MERCHANT TRAINING > 2. CONTEXT > 3. AI OPTIMIZATIONS",
      "If generation conflicts with merchant training, YOU MUST CORRECT IT."
    ].filter(Boolean).join("\n") : "";

    const systemPrompt = `${brainBlock ? `${brainBlock}\n\n---\n\n` : ""}Você é o assistente motivacional da plataforma Cartlly. Envie UMA mensagem curta, motivacional e persuasiva para o dono da loja.

REGRAS DE FORMATO:
- JSON: {"title": "...", "body": "..."}
- title: máx 40 chars. body: máx 120 chars.
- Emojis: 1-2 máx.
- Horário Brasília: ${hour}h (${dayOfWeek}). Saudação: "${greeting}". NUNCA erre o período do dia.

REGRAS CRÍTICAS:
- Você DEVE analisar as 15 mensagens anteriores listadas abaixo antes de escrever.
- A nova mensagem precisa soar como OUTRA pessoa, com OUTRO gancho, OUTRA estrutura e OUTRO assunto.
- NÃO use a mesma lógica de abertura, a mesma energia de vendas ou o mesmo raciocínio batido.
- NÃO repita primeira frase, emoji inicial, vocabulário dominante nem tema principal.
- Se não conseguir criar algo realmente novo, responda {"title":"","body":""}.

PALAVRAS JÁ USADAS (EVITE): ${wordBlacklist}

15 MENSAGENS ANTERIORES PARA ANALISAR:
${recentMessages}

TEMAS DISPONÍVEIS:
- organização prática da loja
- atendimento e experiência do cliente
- marketing e conteúdo
- preço, margem ou vitrine
- disciplina do lojista
- ação simples para hoje
${customInstructions ? `\nINSTRUÇÕES DO LOJISTA:\n${customInstructions}` : ""}`;

    const userPromptBase = `Gere uma mensagem motivacional para ${tenantName} (loja: ${storeName}).
Contexto: ${greeting}, ${isFirstPush ? "primeiro acesso do dia" : "segundo acesso do dia"}.
Pedidos hoje: ${orderCount} (R$ ${revenue.toFixed(2)}).
Produtos ativos: ${productCount || 0}. Clientes cadastrados: ${customerCount || 0}.

Lembre-se: analise as 15 anteriores e mude totalmente a lógica da mensagem.`;

    let selectedMessage: { title: string; body: string } | null = null;
    

    for (let attempt = 0; attempt < 4; attempt++) {
      const retryInstruction = attempt === 0
        ? ""
        : `\nREJEIÇÃO ${attempt}: a opção anterior foi recusada por repetição de tema, abertura ou lógica. Troque radicalmente o gancho.`;

      const aiData = await callAI({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `${userPromptBase}${retryInstruction}` },
        ],
        temperature: 1,
        feature: "motivational_push",
        store_user_id: user_id,
      });

      const rawContent = aiData.content || "";
      const candidate = parseGeneratedCopy(rawContent, ["body"]);

      if (!candidate) continue;

      const similarityReason = getSimilarityBlockReason(candidate.title, candidate.body, historyTexts, true);
      if (similarityReason) {
        console.warn(`[ai-motivational-push] Candidate rejected (${similarityReason})`);
        continue;
      }

      selectedMessage = {
        title: candidate.title.substring(0, 50),
        body: candidate.body.substring(0, 150),
      };
    }

    if (!selectedMessage) {
      const fallbackCandidates = [
        { title: "🧭 Ajuste simples, impacto real", body: `${greeting}, ${tenantName}: escolha 1 detalhe da vitrine da ${storeName} e melhore hoje.` },
        { title: "📸 Sua loja merece capricho", body: `${tenantName}, revise fotos e destaque da ${storeName}. Pequeno ajuste pode puxar mais cliques.` },
        { title: "🤝 Atendimento vende de novo", body: `${greeting}, ${tenantName}: responda um cliente com atenção extra hoje e fortaleça a ${storeName}.` },
        { title: "💡 Ideia boa é a que sai", body: `${tenantName}, publique uma oferta clara na ${storeName} hoje. Ação simples vale mais que plano parado.` },
      ];

      selectedMessage = fallbackCandidates.find((candidate) =>
        !getSimilarityBlockReason(candidate.title, candidate.body, historyTexts, true)
      ) || null;
    }

    if (!selectedMessage) {
      return new Response(JSON.stringify({ skipped: true, reason: "similarity_guard" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { title, body } = selectedMessage;

    const { data: pushResult, error: pushError } = await supabase.functions.invoke("send-push-internal", {
      body: {
        target_user_id: user_id,
        title,
        body,
        type: "motivational_push",
        url: "/admin",
      },
    });

    if (pushError) throw pushError;

    if (!pushResult?.sent) {
      return new Response(JSON.stringify({ skipped: true, reason: pushResult?.message || "blocked", title, body }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ sent: true, title, body }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Motivational push error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function getNowBrasilia() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const d: any = {};
  parts.forEach(({ type, value }) => { d[type] = value; });
  
  // Create a date object where the "local" time matches Brasília
  return new Date(
    parseInt(d.year),
    parseInt(d.month) - 1,
    parseInt(d.day),
    parseInt(d.hour),
    parseInt(d.minute),
    parseInt(d.second)
  );
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
    if (similarity >= 0.52) {
      return `conteúdo muito parecido (${Math.round(similarity * 100)}%)`;
    }

    if (candidateTopic !== "other" && candidateTopic === detectTopic(previous) && similarity >= (strictTheme ? 0.18 : 0.3)) {
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
