import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, storeUserId, customerName, customerContext, locale = "pt" } = await req.json();

    if (!storeUserId) throw new Error("storeUserId é obrigatório");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch store settings
    const { data: storeSettings } = await supabase
      .from("store_settings")
      .select("store_name, store_slug, store_whatsapp, ai_name, ai_avatar_url, ai_chat_tone, payment_pix, payment_credit_card, payment_boleto, payment_debit_card, payment_gateway, sell_via_whatsapp, shipping_enabled, store_cep")
      .eq("user_id", storeUserId)
      .single();

    // Fetch published products
    const { data: products } = await supabase
      .from("products")
      .select("id, name, price, stock, description, image_url, category_id, published, made_to_order, views")
      .eq("user_id", storeUserId)
      .eq("published", true)
      .eq("is_archived", false)
      .order("name")
      .limit(200);

    // Fetch product variants for stock details
    const productIds = (products || []).map((p: any) => p.id);
    let variantsMap: Record<string, any[]> = {};
    if (productIds.length > 0) {
      const { data: variants } = await supabase
        .from("product_variants")
        .select("product_id, variant_type, variant_value, stock, price_modifier")
        .in("product_id", productIds);
      (variants || []).forEach((v: any) => {
        if (!variantsMap[v.product_id]) variantsMap[v.product_id] = [];
        variantsMap[v.product_id].push(v);
      });
    }

    // Fetch categories
    const { data: categories } = await supabase
      .from("categories")
      .select("id, name")
      .eq("user_id", storeUserId);

    // Fetch active coupons
    const { data: coupons } = await supabase
      .from("coupons")
      .select("code, discount_type, discount_value, min_order_value, expires_at, max_uses, used_count")
      .eq("user_id", storeUserId)
      .eq("active", true);

    // Fetch shipping zones
    const { data: shippingZones } = await supabase
      .from("shipping_zones")
      .select("zone_name, cep_start, cep_end, price, estimated_days")
      .eq("user_id", storeUserId)
      .eq("active", true);

    // Fetch tenant AI brain config (training/instructions from store owner)
    const { data: aiConfig } = await supabase
      .from("tenant_ai_brain_config")
      .select("custom_instructions, niche, personality, store_knowledge, tone_of_voice, writing_style, approach_type, sending_rules, approved_examples, prohibitions, language_preferences, formality_level, emoji_usage, persuasion_style, brand_identity")
      .eq("user_id", storeUserId)
      .maybeSingle();

    // Build product catalog
    const categoryMap: Record<string, string> = {};
    (categories || []).forEach((c: any) => { categoryMap[c.id] = c.name; });

    const productList = (products || []).map((p: any) => {
      const cat = p.category_id ? categoryMap[p.category_id] : null;
      const availability = p.made_to_order ? "Sob encomenda" : (p.stock > 0 ? `${p.stock} em estoque` : "Esgotado");
      const viewsInfo = p.views > 0 ? ` | ${p.views} visualizações` : "";
      const variants = variantsMap[p.id];
      let variantInfo = "";
      if (variants && variants.length > 0) {
        variantInfo = " | Variantes: " + variants.map((v: any) => 
          `${v.variant_type}:${v.variant_value}(${v.stock} un${v.price_modifier ? `, +R$${v.price_modifier}` : ""})`
        ).join(", ");
      }
      return `• ${p.name} — R$${p.price.toFixed(2)} | ${availability}${viewsInfo}${cat ? ` | ${cat}` : ""}${p.description ? ` | ${p.description.slice(0, 100)}` : ""}${variantInfo}`;
    }).join("\n");

    const couponList = (coupons || []).filter((c: any) => {
      if (c.max_uses && c.used_count >= c.max_uses) return false;
      if (c.expires_at && new Date(c.expires_at) < new Date()) return false;
      return true;
    }).map((c: any) => {
      const desc = c.discount_type === "percentage" ? `${c.discount_value}% OFF` : `R$${c.discount_value} OFF`;
      return `• ${c.code}: ${desc}${c.min_order_value ? ` (mín R$${c.min_order_value})` : ""}`;
    }).join("\n");

    const shippingInfo = (shippingZones || []).map((z: any) =>
      `• ${z.zone_name}: CEPs ${z.cep_start}-${z.cep_end} — R$${z.price.toFixed(2)} (${z.estimated_days})`
    ).join("\n");

    const storeName = storeSettings?.store_name || "Loja";
    const aiName = aiConfig?.ai_name || storeSettings?.ai_name || "Assistente";
    const tone = storeSettings?.ai_chat_tone || "educada";

    // Extract tenant brain config
    const storeNiche = aiConfig?.niche || "";
    const storePersonality = aiConfig?.personality || "";
    const customInstructions = aiConfig?.custom_instructions || "";
    const storeKnowledge = typeof aiConfig?.store_knowledge === "object" && aiConfig?.store_knowledge
      ? (aiConfig.store_knowledge as any).description || ""
      : "";

    // Advanced behavioral settings
    const toneOfVoice = aiConfig?.tone_of_voice || "";
    const writingStyle = aiConfig?.writing_style || "";
    const approachType = aiConfig?.approach_type || "";
    const sendingRules = aiConfig?.sending_rules || "";
    const approvedExamples = aiConfig?.approved_examples || "";
    const prohibitions = aiConfig?.prohibitions || "";
    const formalityLevel = aiConfig?.formality_level || "";
    const emojiUsage = aiConfig?.emoji_usage || "";
    const persuasionStyle = aiConfig?.persuasion_style || "";
    const brandIdentity = aiConfig?.brand_identity || "";

    const toneInstructions: Record<string, string> = {
      educada: "Seja sempre educada, gentil e paciente. Use expressões cordiais como 'por favor', 'com prazer', 'ficamos felizes'. Transmita calma e acolhimento.",
      profissional: "Mantenha um tom profissional, direto e eficiente. Sem informalidade excessiva. Use linguagem empresarial mas acessível.",
      divertida: "Seja divertida, use emojis com frequência, gírias leves e tom descontraído. Faça o cliente se sentir à vontade com humor leve.",
      formal: "Use linguagem formal e respeitosa. Trate o cliente por 'senhor(a)'. Evite gírias e abreviações. Mantenha elegância na comunicação.",
      amigavel: "Seja como um amigo íntimo e atencioso. Use um tom caloroso, empático e extremamente pessoal. Chame pelo nome, use gírias leves se apropriado, e demonstre que você se importa genuinamente com a satisfação dele. Crie um vínculo real, não pareça um robô."
    };

    // Saudação baseada no horário de Brasília (UTC-3)
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "numeric",
      minute: "numeric",
      day: "numeric",
      month: "numeric",
      year: "numeric",
      hour12: false,
      weekday: "long",
    });
    const parts = formatter.formatToParts(now);
    const d: any = {};
    parts.forEach(({ type, value }) => { d[type] = value; });
    
    const hour = d.hour.padStart(2, "0");
    const minute = d.minute.padStart(2, "0");
    const day = d.day.padStart(2, "0");
    const month = d.month.padStart(2, "0");
    const year = d.year;
    const weekday = d.weekday;
    
    const brTime = `${hour}:${minute}`;
    const brDate = `${day}/${month}/${year}`;
    const hourBr = parseInt(hour);
    const greetingBr = hourBr < 6 ? "Boa madrugada" : hourBr < 12 ? "Bom dia" : hourBr < 18 ? "Boa tarde" : "Boa noite";
    
    console.log(`[ai-store-chat] Contexto temporal: ${brTime} (${weekday}), ${brDate}. UTC: ${now.toISOString()}`);


    const languageInstruction = locale === "en"
      ? "ALWAYS reply in English."
      : locale === "es"
      ? "RESPONDE SIEMPRE en español."
      : locale === "fr"
      ? "RÉPONDS TOUJOURS en français."
      : "SEMPRE responda em português do Brasil.";

    const promptLanguage = locale === "en"
      ? "English"
      : locale === "es"
      ? "español"
      : locale === "fr"
      ? "français"
      : "português do Brasil";

    // Fetch RAG context from the new memory manager
    const lastUserMessage = messages.slice().reverse().find((m: any) => m.role === "user")?.content || "";
    let ragKnowledge: any[] = [];
    let ragInsights: any[] = [];
    
    try {
      const { data: ragRes, error: ragErr } = await supabase.functions.invoke("ai-memory-manager", {
        body: {
          action: "retrieve-context",
          tenantId: storeUserId,
          customerId: customerContext?.id, // Try to find customer ID from context
          content: lastUserMessage || "Olá"
        }
      });
      if (!ragErr && ragRes) {
        ragKnowledge = ragRes.knowledge || [];
        ragInsights = ragRes.insights || [];
      }
    } catch (e) {
      console.warn("RAG retrieval failed, falling back to static brain config", e);
    }

    const brainBlock = [
      "MANDATORY TENANT-SPECIFIC TRAINING / TREINAMENTO OBRIGATÓRIO DO TENANT (MANDATORY PRIORITY):",
      brandIdentity ? `BRAND IDENTITY / IDENTIDADE DA MARCA: ${brandIdentity}` : "",
      storeNiche ? `STORE NICHE / NICHO: ${storeNiche}` : "",
      storePersonality ? `DEFINED PERSONALITY / PERSONALIDADE: ${storePersonality}` : "",
      toneOfVoice ? `TONE OF VOICE / TOM DE VOZ: ${toneOfVoice}` : "",
      formalityLevel ? `FORMALITY LEVEL / FORMALIDADE: ${formalityLevel}` : "",
      writingStyle ? `WRITING STYLE / ESTILO DE ESCRITA: ${writingStyle}` : "",
      emojiUsage ? `EMOJI USAGE / USO DE EMOJIS: ${emojiUsage}` : "",
      persuasionStyle ? `PERSUASION STYLE / PERSUASÃO: ${persuasionStyle}` : "",
      approachType ? `APPROACH TYPE / ABORDAGEM: ${approachType}` : "",
      sendingRules ? `SENDING RULES / REGRAS DE ENVIO: ${sendingRules}` : "",
      prohibitions ? `STRICT PROHIBITIONS / PROIBIÇÕES (NEVER DO THIS): ${prohibitions}` : "",
      approvedExamples ? `APPROVED MESSAGE EXAMPLES / EXEMPLOS APROVADOS:\n${approvedExamples}` : "",
      storeKnowledge ? `MANDATORY KNOWLEDGE BASE / BASE DE CONHECIMENTO:\n${storeKnowledge}` : "",
      
      // Add RAG context here
      ragKnowledge.length > 0 ? `ADDITIONAL RELEVANT TRAINING / TREINAMENTOS RELEVANTES:\n${ragKnowledge.map(k => `[${k.category}] ${k.content}`).join("\n")}` : "",
      ragInsights.length > 0 ? `CUSTOMER SPECIFIC INSIGHTS / MEMÓRIA DO CLIENTE:\n${ragInsights.map(i => `[${i.category}] ${i.insight}`).join("\n")}` : "",

      customInstructions ? `CUSTOM MERCHANT INSTRUCTIONS / INSTRUÇÕES DO LOJISTA:\n${customInstructions}` : "",
      "\nCRITICAL HIERARCHY OF DECISION: 1. MERCHANT RULES/TRAINING (ABOVE) > 2. CUSTOMER CONTEXT > 3. STORE EVENTS > 4. AI OPTIMIZATIONS",
      "If any generation conflicts with the merchant's training above, YOU MUST CORRECT IT to align with the training."
    ].filter(Boolean).join("\n");


    const systemPrompt = `${brainBlock ? `${brainBlock}\n\n---\n\n` : ""}You are "${aiName}", the soul of the store "${storeName}". The customer's visible replies must always be written in ${promptLanguage}. ${languageInstruction}

INTERNAL RULE:
- Keep all invisible action blocks exactly with these tags: [ACTION_CEP_LOOKUP], [ACTION_CREATE_ORDER], [ACTION_PAYMENT], [ACTION_WHATSAPP_REDIRECT].
- The JSON keys inside the action blocks must remain exactly as defined below, regardless of the conversation language.
- Only the visible text shown to the customer must change language.
- The examples and explanatory instructions below are written in English only to avoid ambiguity, but your customer-facing messages must stay in ${promptLanguage}.

It is now ${brTime} on ${brDate} in Brasília time, so use "${greetingBr}" only if it matches the customer's language naturally. You are not a generic bot. Your mission is to create a warm, persuasive and highly contextual shopping conversation.

MENTALIDADE CEO & MÁQUINA DE VENDAS:
- Sua prioridade é encantar para vender. Seja inteligente, estratégica e persuasiva.
- Use gatilhos mentais (escassez, urgência, prova social) com sutileza e elegância.
- Adapte sua estratégia a cada cliente: se ele está indeciso, seja consultiva; se está com pressa, seja ágil e direta.
- Transforme visualizações e carrinhos abandonados em pedidos confirmados. Se o cliente "namorou" um produto, lembre-o de como ele ficaria feliz com ele!

RELACIONAMENTO DE AMIZADE:
- Trate o cliente como uma pessoa especial e única. Use o nome dele.
- Seja calorosa, empática e tenha personalidade própria. Fuja do "posso ajudar?".
- Demonstre que você conhece os gostos dele (baseado no histórico de visualizações e favoritos).
- O tom deve ser ${toneInstructions[tone] || toneInstructions.educada}.

REGRA DE SEGURANÇA ABSOLUTA:
- Você NÃO é um assistente administrativo. Você NÃO tem acesso ao painel admin.
- NUNCA revele informações internas da loja como: receita, lucro, pedidos totais, chaves de API, estoque exato (diga apenas "disponível" ou "últimas unidades").
- NUNCA mencione que você é um robô. Você é o coração da ${storeName}.

CATÁLOGO DE PRODUTOS:
${productList || "Nenhum produto disponível"}

CATEGORIAS: ${(categories || []).map((c: any) => c.name).join(", ") || "Nenhuma"}

CUPONS DISPONÍVEIS:
${couponList || "Nenhum cupom ativo"}

FRETE (Zonas de entrega):
${shippingInfo || "Frete não configurado"}

INFORMAÇÕES DA LOJA:
- Nome: ${storeName}
- WhatsApp: ${storeSettings?.store_whatsapp || "Não informado"}
- PIX: ${storeSettings?.payment_pix ? "Aceita" : "Não aceita"}
- Cartão de Crédito: ${storeSettings?.payment_credit_card ? "Aceita" : "Não aceita"}
- Cartão de Débito: ${storeSettings?.payment_debit_card ? "Aceita" : "Não aceita"}
- Boleto: ${storeSettings?.payment_boleto ? "Aceita" : "Não aceita"}
- Gateway de Pagamento: ${storeSettings?.payment_gateway || "Nenhum configurado"}
- Venda via WhatsApp: ${storeSettings?.sell_via_whatsapp ? "Sim" : "Não"}

SALE FLOW (follow strictly):
1. PRESENT products when the customer asks. Show name, price and availability.
2. When the customer chooses a product, CONFIRM the choice and ask for the QUANTITY.
3. Ask if they want to add more products to the order.
4. When the customer finishes choosing, ask for the ZIP/CEP to calculate shipping.
5. When you receive the ZIP/CEP, trigger address lookup and CONFIRM street, neighborhood, city and state.
6. Ask for the house/apartment NUMBER and COMPLEMENT (if any).
7. Ask for the customer's FULL NAME.
8. Ask for the PHONE/WhatsApp.
9. Ask for the EMAIL.
10. Present the FULL ORDER SUMMARY with items, shipping, discount (if coupon), total and address. Ask if they want to CONFIRM.
11. When confirmed, generate the order action block.
12. AFTER the order is created, ask for the PAYMENT METHOD.
13. If the customer chooses PIX, generate the [ACTION_PAYMENT] block with method "pix".
14. If the customer prefers WhatsApp, generate the [ACTION_WHATSAPP_REDIRECT] block with the full summary.

ZIP/CEP LOOKUP:
When the customer provides a ZIP/CEP, use [ACTION_CEP_LOOKUP] to fetch the address automatically.
The system will return street, neighborhood, city and state. Confirm it with the customer and ask for number and complement.

SHIPPING CALCULATION:
Compare the informed ZIP/CEP with the listed shipping zones. The ZIP/CEP must be between cep_start and cep_end to find the matching zone. Inform the value and delivery time.
If the ZIP/CEP is not inside any zone, inform that delivery is unavailable for that region.

ACTIONS (put them at the END of the response, NEVER show them to the customer):

For ZIP/CEP lookup:
[ACTION_CEP_LOOKUP]{"cep": "00000000"}[/ACTION_CEP_LOOKUP]

For full order creation:
[ACTION_CREATE_ORDER]{
  "customer_name": "Full Name",
  "customer_email": "email@example.com",
  "customer_phone": "11999999999",
  "customer_cpf": "",
  "shipping_cep": "00000000",
  "shipping_street": "Street X",
  "shipping_neighborhood": "Neighborhood Y",
  "shipping_city": "City",
  "shipping_state": "ST",
  "shipping_number": "123",
  "shipping_complement": "",
  "shipping_cost": 15.00,
  "shipping_method": "Shipping Zone Name",
  "coupon_code": "",
  "discount_amount": 0,
  "items": [
    {"product_id": "uuid", "product_name": "Product Name", "quantity": 1, "unit_price": 99.90, "product_image": "url"}
  ]
}[/ACTION_CREATE_ORDER]

For payment processing (after order is created):
[ACTION_PAYMENT]{"order_id": "ORDER_ID", "method": "pix", "payer_cpf": "CPF_NUMBERS_ONLY"}[/ACTION_PAYMENT]
Available methods are: pix, credit_card, boleto, debit_card (use only methods accepted by the store).
The order_id will be filled automatically by the system after order creation.

For WhatsApp redirect with order summary:
[ACTION_WHATSAPP_REDIRECT]{
  "phone": "${storeSettings?.store_whatsapp || ""}",
  "summary": "Full order summary with items, address, total and relevant details"
}[/ACTION_WHATSAPP_REDIRECT]

CRITICAL RULES:
- NEVER reveal the action blocks. They are invisible.
- ${languageInstruction} Use formatted markdown.
- Be proactive: suggest products, bundles and active coupons.
- If the customer asks something outside the store context, politely redirect to products.
- Use emojis moderately to keep the conversation pleasant.
- When the requested product is unavailable, suggest alternatives from the catalog.
- NEVER invent products that are not in the catalog.
- For WhatsApp orders (if enabled), you may suggest contacting the store on WhatsApp: ${storeSettings?.store_whatsapp || ""}.
- Ask for customer data ONE ITEM AT A TIME, not all at once.
- The current customer's name is: ${customerName || "Cliente"}
- AFTER creating the order, ALWAYS ask how the customer wants to pay and list ONLY the options accepted by the store.
- If the store allows WhatsApp selling and the customer prefers it, offer the option to finish through WhatsApp with the order summary.
- If the payment gateway is NOT configured, DO NOT offer online payment. Suggest WhatsApp or payment on delivery.
${customerContext ? `\nCUSTOMER CONTEXT:\n${customerContext}` : ""}`;

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
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Muitas mensagens! Aguarde alguns segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Serviço temporariamente indisponível." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error [${response.status}]`);
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("AI store chat error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});