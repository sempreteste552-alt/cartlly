import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization")!;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) throw new Error("Não autorizado");

    const { messages } = await req.json();

    // 1. Fetch Store Config & Context (Expanded)
    const [
      { data: storeSettings },
      { data: aiConfig },
      { data: recentOrders },
      { data: failedPayments },
      { data: lowStockProducts },
       { data: salesStats },
       { data: storePages },
       { data: storeBanners },
       { data: homeSections },
       { data: stagnantProducts },
       { data: recentOrderItems },
       { data: marketingConfig },
        { data: deliveryLogs },
        { data: behaviorStats },
        { data: wishlistItems },
        { data: cartItems }
      ] = await Promise.all([
        supabase.from("store_settings").select("*").eq("user_id", user.id).single(),
        supabase.from("tenant_ai_brain_config").select("*").eq("user_id", user.id).single(),
        supabase.from("orders").select("id, status, total_amount, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10),
        supabase.from("payments").select("id, order_id, status, amount, created_at").eq("user_id", user.id).eq("status", "failed").order("created_at", { ascending: false }).limit(5),
        supabase.from("products").select("name, stock, price").eq("user_id", user.id).lt("stock", 5).limit(10),
        supabase.rpc("get_store_sales_stats", { p_user_id: user.id }),
        supabase.from("store_pages").select("title, slug, content").eq("user_id", user.id).limit(5),
        supabase.from("store_banners").select("title, description").eq("user_id", user.id).limit(5),
        supabase.from("store_home_sections").select("title, subtitle, type").eq("user_id", user.id).limit(10),
        supabase.from("products").select("name, stock, views, price, id").eq("user_id", user.id).order("views", { ascending: true }).limit(10),
        supabase.from("order_items").select("product_id, quantity").limit(100),
        supabase.from("store_marketing_config").select("*").eq("user_id", user.id).single(),
        supabase.from("message_delivery_logs").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10),
        supabase.from("customer_behavior_events").select("event_type, customer_id, product_id, created_at").eq("store_user_id", user.id).order("created_at", { ascending: false }).limit(50),
        supabase.from("customer_wishlist").select("customer_id, product_id, created_at").eq("store_user_id", user.id).order("created_at", { ascending: false }).limit(30),
        supabase.from("abandoned_carts").select("customer_id, items, total_amount, created_at").eq("store_user_id", user.id).order("created_at", { ascending: false }).limit(20)
      ]);

    const storeName = storeSettings?.store_name || "Sua Loja";
    const niche = aiConfig?.niche || storeSettings?.store_category || "Não definido";
    const chatTone = storeSettings?.ai_chat_tone || aiConfig?.personality || "educada";
    const storeKnowledge = typeof aiConfig?.store_knowledge === "object" && aiConfig?.store_knowledge
      ? (aiConfig.store_knowledge as any).description || ""
      : "";
    
    const nowBrasilia = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const hourBr = nowBrasilia.getHours();
    const greetingBr = hourBr < 5 ? "Boa madrugada" : hourBr < 12 ? "Bom dia" : hourBr < 18 ? "Boa tarde" : "Boa noite";

    const personalityMap: Record<string, string> = {
      amigavel: "Amigável e próxima — como uma amiga empreendedora de confiança.",
      profissional: "Profissional e direta — com dados, métricas e linguagem objetiva.",
      divertida: "Divertida e descontraída — com emojis e humor leve.",
      agressiva: "Agressiva e focada em conversão — com urgência, metas ambiciosas e frases fortes.",
      educada: "Educada e formal — com linguagem refinada e respeitosa.",
    };
    const personalityDesc = personalityMap[chatTone] || personalityMap.educada;

    const brainBlock = aiConfig ? [
      "MANDATORY TENANT-SPECIFIC TRAINING / TREINAMENTO OBRIGATÓRIO (MANDATORY PRIORITY):",
      aiConfig.brand_identity ? `BRAND IDENTITY / IDENTIDADE DA MARCA: ${aiConfig.brand_identity}` : "",
      aiConfig.niche ? `STORE NICHE / NICHO: ${aiConfig.niche}` : "",
      aiConfig.personality ? `DEFINED PERSONALITY / PERSONALIDADE: ${aiConfig.personality}` : "",
      aiConfig.tone_of_voice ? `TONE OF VOICE / TOM DE VOZ: ${aiConfig.tone_of_voice}` : "",
      aiConfig.formality_level ? `FORMALITY LEVEL / FORMALIDADE: ${aiConfig.formality_level}` : "",
      aiConfig.writing_style ? `WRITING STYLE / ESTILO DE ESCRITA: ${aiConfig.writing_style}` : "",
      aiConfig.emoji_usage ? `EMOJI USAGE / USO DE EMOJIS: ${aiConfig.emoji_usage}` : "",
      aiConfig.persuasion_style ? `PERSUASION STYLE / PERSUASÃO: ${aiConfig.persuasion_style}` : "",
      aiConfig.approach_type ? `APPROACH TYPE / ABORDAGEM: ${aiConfig.approach_type}` : "",
      aiConfig.sending_rules ? `SENDING RULES / REGRAS DE ENVIO: ${aiConfig.sending_rules}` : "",
      aiConfig.prohibitions ? `STRICT PROHIBITIONS / PROIBIÇÕES (NEVER DO THIS): ${aiConfig.prohibitions}` : "",
      aiConfig.approved_examples ? `APPROVED MESSAGE EXAMPLES / EXEMPLOS APROVADOS:\n${aiConfig.approved_examples}` : "",
      storeKnowledge ? `MANDATORY KNOWLEDGE BASE / BASE DE CONHECIMENTO:\n${storeKnowledge}` : "",
      aiConfig.custom_instructions ? `CUSTOM MERCHANT INSTRUCTIONS / INSTRUÇÕES DO LOJISTA:\n${aiConfig.custom_instructions}` : "",
      "\nCRITICAL HIERARCHY OF DECISION: 1. MERCHANT RULES/TRAINING (ABOVE) > 2. CONTEXT > 3. STORE EVENTS",
      "If any generation conflicts with the merchant's training above, YOU MUST CORRECT IT."
    ].filter(Boolean).join("\n") : "";

    const systemPrompt = `${brainBlock ? `${brainBlock}\n\n---\n\n` : ""}Você é a "Amiga CEO", o cérebro estratégico e braço direito do dono da loja "${storeName}". Agora são ${hourBr}h (horário de Brasília), então use "${greetingBr}" como saudação.
Sua missão é ser uma "máquina de fazer dinheiro" e um suporte administrativo impecável.

PERSONALIDADE: ${personalityDesc}

NICHO DA LOJA: ${niche}
${storeKnowledge ? `\nO QUE A LOJA OFERECE (dados fornecidos pelo dono):\n${storeKnowledge}\n\nUse esse conhecimento para dar conselhos específicos e relevantes ao nicho.` : ""}

CONTEXTO DA LOJA:
- Configurações: ${JSON.stringify(storeSettings || {})}
- Marketing: ${JSON.stringify(marketingConfig || {})}
- Páginas: ${JSON.stringify(storePages || [])}
- Banners: ${JSON.stringify(storeBanners || [])}
- Seções da Home: ${JSON.stringify(homeSections || [])}

STATUS ATUAL:
- Pedidos Recentes: ${JSON.stringify(recentOrders || [])}
- Pagamentos Falhos: ${JSON.stringify(failedPayments || [])}
- Produtos com Baixo Estoque: ${JSON.stringify(lowStockProducts || [])}
- Vendas Hoje: ${JSON.stringify(salesStats || "N/A")}
- Produtos Parados (menos visualizações/vendas): ${JSON.stringify(stagnantProducts || [])}
- Amostragem de Itens Vendidos: ${JSON.stringify(recentOrderItems || [])}
- Histórico de Entrega de Mensagens/Push: ${JSON.stringify(deliveryLogs || [])}
- Comportamento Recente dos Clientes (Navegação, Favoritos, Carrinhos):
    * Eventos: ${JSON.stringify(behaviorStats || [])}
    * Favoritos/Wishlist: ${JSON.stringify(wishlistItems || [])}
    * Carrinhos Abandonados: ${JSON.stringify(cartItems || [])}

INSTRUÇÕES DE PERSONALIDADE:
- Seja proativa, analítica e focada em resultados (vendas e eficiência).
- Fale a linguagem do nicho "${niche}" — use termos, gírias e referências do segmento.
- Se o dono pedir "agressividade", crie frases de alto impacto para checkout, banners e descrição da loja que removam objeções e criem urgência.
- Se houver produtos "parados" (muitas visualizações mas pouca venda, ou sem visualizações), sugira frases de impacto, selos de destaque ou melhoria no SEO/CTA.
${aiConfig?.custom_instructions ? `\nINSTRUÇÕES PERSONALIZADAS DO LOJISTA:\n${aiConfig.custom_instructions}` : ""}

CAPACIDADES ESPECIAIS (AÇÕES):
Você pode realizar ações inserindo blocos JSON no final da sua resposta:

1. AGENDAR TAREFA (Push para Clientes):
[ACTION_SCHEDULE_TASK]{
  "task_type": "send_push",
  "scheduled_at": "ISO_TIMESTAMP",
  "payload": { "title": "...", "body": "..." },
  "ai_instruction": "descrição da tarefa"
}[/ACTION_SCHEDULE_TASK]

2. LEMBRETE PESSOAL (Push para o Dono):
[ACTION_SCHEDULE_REMINDER]{
  "title": "Lembrete",
  "description": "...",
  "remind_at": "ISO_TIMESTAMP"
}[/ACTION_SCHEDULE_REMINDER]

3. ATUALIZAR CONFIGURAÇÕES DA LOJA (Gerais):
[ACTION_UPDATE_STORE_SETTINGS]{ "store_description": "...", "marquee_text": "...", "store_name": "..." }[/ACTION_UPDATE_STORE_SETTINGS]

4. ATUALIZAR FERRAMENTAS DE MARKETING (Faixa Promocional, Frete Grátis, Countdown):
[ACTION_UPDATE_MARKETING_CONFIG]{ 
  "announcement_bar_enabled": true, 
  "announcement_bar_text": "Frete Grátis!", 
  "announcement_bar_bg_color": "#000000",
  "announcement_bar_text_color": "#ffffff",
  "announcement_bar_search_enabled": true,
  "free_shipping_bar_enabled": true,
  "free_shipping_threshold": 200
}[/ACTION_UPDATE_MARKETING_CONFIG]

5. ATUALIZAR PÁGINA:
[ACTION_UPDATE_PAGE]{ "slug": "sobre-nos", "content": "..." }[/ACTION_UPDATE_PAGE]

6. ATUALIZAR ESTOQUE DE PRODUTO:
[ACTION_UPDATE_STOCK]{ "product_name": "...", "new_stock": 10 }[/ACTION_UPDATE_STOCK]

7. GERAR CONTEÚDO PARA PRODUTO (SEO, Descrição ou Selo):
[ACTION_GENERATE_PRODUCT_CONTENT]{ "product_name": "...", "type": "description|seo|badge" }[/ACTION_GENERATE_PRODUCT_CONTENT]

8. CRIAR CUPOM DE DESCONTO:
[ACTION_CREATE_COUPON]{
  "code": "CÓDIGO",
  "discount_type": "percentage|fixed",
  "discount_value": 10,
  "min_order_value": 0,
  "validity_days": 30,
  "reason": "frase explicando por que criou este cupom"
}[/ACTION_CREATE_COUPON]

9. ATUALIZAR INSTRUÇÕES DA IA (Push, Chat, Comportamento):
Use esta ação quando o dono pedir para corrigir, ajustar ou ensinar algo à IA (ex: "não mande bom dia à noite", "seja mais agressiva nos pushes", "não fale gírias").
[ACTION_UPDATE_AI_INSTRUCTIONS]{ "instructions": "Novas instruções adicionais aqui..." }[/ACTION_UPDATE_AI_INSTRUCTIONS]

REGRAS CRÍTICAS:
- Responda sempre em Português do Brasil.
- SEMPRE que o usuário pedir para mudar algo (nome, descrição, cores, letreiro, faixa, abrir/fechar loja, etc.), você DEVE incluir o bloco [ACTION_UPDATE_STORE_SETTINGS] ou [ACTION_UPDATE_MARKETING_CONFIG] correspondente.
- Se o usuário pedir para ativar o "letreiro" ou "marquee", use [ACTION_UPDATE_STORE_SETTINGS]{ "marquee_enabled": true, "marquee_text": "...", "marquee_speed": 50 }.
- Se o usuário pedir para "abrir" ou "fechar" a loja, use [ACTION_UPDATE_STORE_SETTINGS]{ "store_open": true/false }.
- Se o usuário reclamar do comportamento da IA (push, chat, saudação), use [ACTION_UPDATE_AI_INSTRUCTIONS] para salvar a correção permanentemente.
- Use as ações JSON apenas quando necessário e SEMPRE no final da resposta.
- Se o usuário pedir para ser "agressivo", confirme que ativou o modo de alta conversão e sugira frases fortes.`;

    // 3. Call LLM
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        temperature: 0.7,
      }),
    });

    const aiResult = await response.json();
    const assistantMessage = aiResult.choices[0].message.content;

    // Store conversation once
    await supabase.from("admin_ai_chats").insert([
      { user_id: user.id, role: "user", content: messages[messages.length - 1].content },
      { user_id: user.id, role: "assistant", content: assistantMessage }
    ]);

    return new Response(JSON.stringify({ content: assistantMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("AI admin assistant error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
