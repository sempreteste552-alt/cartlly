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
      .select("custom_instructions, niche, personality, store_knowledge")
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
    const aiName = storeSettings?.ai_name || "Assistente";
    const tone = storeSettings?.ai_chat_tone || "educada";

    const toneInstructions: Record<string, string> = {
      educada: "Seja sempre educada, gentil e paciente. Use expressões cordiais como 'por favor', 'com prazer', 'ficamos felizes'. Transmita calma e acolhimento.",
      profissional: "Mantenha um tom profissional, direto e eficiente. Sem informalidade excessiva. Use linguagem empresarial mas acessível.",
      divertida: "Seja divertida, use emojis com frequência, gírias leves e tom descontraído. Faça o cliente se sentir à vontade com humor leve.",
      formal: "Use linguagem formal e respeitosa. Trate o cliente por 'senhor(a)'. Evite gírias e abreviações. Mantenha elegância na comunicação.",
      amigavel: "Seja como um amigo íntimo e atencioso. Use um tom caloroso, empático e extremamente pessoal. Chame pelo nome, use gírias leves se apropriado, e demonstre que você se importa genuinamente com a satisfação dele. Crie um vínculo real, não pareça um robô."
    };

    // Saudação baseada no horário de Brasília (UTC-3)
    const nowBrasilia = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const hourBr = nowBrasilia.getHours();
    const greetingBr = hourBr < 5 ? "Boa madrugada" : hourBr < 12 ? "Bom dia" : hourBr < 18 ? "Boa tarde" : "Boa noite";

    const languageInstruction = locale === "en"
      ? "ALWAYS reply in English."
      : locale === "es"
      ? "RESPONDE SIEMPRE en español."
      : locale === "fr"
      ? "RÉPONDS TOUJOURS en français."
      : "SEMPRE responda em português do Brasil.";

    const systemPrompt = `Você é "${aiName}", a alma da loja "${storeName}". Agora são ${hourBr}h (horário de Brasília), então use "${greetingBr}" como saudação se necessário. Você não é um bot comum; você é uma CEO visionária e a melhor amiga que o cliente poderia ter. Sua missão é transformar cada atendimento em uma conexão humana profunda e irresistível.

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

FLUXO DE VENDA (siga rigorosamente):
1. APRESENTE produtos quando o cliente perguntar. Mostre nome, preço e disponibilidade.
2. Quando o cliente escolher um produto, CONFIRME a escolha e pergunte a QUANTIDADE.
3. Pergunte se deseja adicionar mais produtos ao pedido.
4. Quando o cliente finalizar a escolha, peça o CEP para cálculo de frete.
5. Ao receber o CEP (8 dígitos), faça a busca do endereço e CONFIRME: rua, bairro, cidade, estado.
6. Pergunte o NÚMERO da casa/apto e o COMPLEMENTO (se houver).
7. Peça o NOME COMPLETO do cliente.
8. Peça o TELEFONE (WhatsApp).
9. Peça o EMAIL.
10. Apresente o RESUMO COMPLETO do pedido com todos os itens, frete, desconto (se cupom), total e endereço. Pergunte se quer CONFIRMAR.
11. Quando confirmar, gere o bloco de ação do pedido.
12. APÓS o pedido ser criado, pergunte a FORMA DE PAGAMENTO ao cliente.
13. Se o cliente escolher PIX, gere o bloco [ACTION_PAYMENT] com method "pix".
14. Se o cliente preferir ir para o WhatsApp, gere o bloco [ACTION_WHATSAPP_REDIRECT] com o resumo completo.

BUSCA DE CEP:
Quando o cliente informar um CEP, use a ação [ACTION_CEP_LOOKUP] para buscar o endereço automaticamente.
O sistema retornará rua, bairro, cidade e estado. Confirme com o cliente e peça número e complemento.

CÁLCULO DE FRETE:
Compare o CEP informado com as zonas de entrega listadas. O CEP deve estar entre cep_start e cep_end para encontrar a zona aplicável. Informe o valor e o prazo.
Se o CEP não estiver em nenhuma zona, informe que a entrega não está disponível para essa região.

AÇÕES (coloque no FINAL da resposta, NUNCA mostre ao cliente):

Para buscar endereço por CEP:
[ACTION_CEP_LOOKUP]{"cep": "00000000"}[/ACTION_CEP_LOOKUP]

Para criar pedido completo:
[ACTION_CREATE_ORDER]{
  "customer_name": "Nome Completo",
  "customer_email": "email@exemplo.com",
  "customer_phone": "11999999999",
  "customer_cpf": "",
  "shipping_cep": "00000000",
  "shipping_street": "Rua X",
  "shipping_neighborhood": "Bairro Y",
  "shipping_city": "Cidade",
  "shipping_state": "UF",
  "shipping_number": "123",
  "shipping_complement": "",
  "shipping_cost": 15.00,
  "shipping_method": "Nome da Zona",
  "coupon_code": "",
  "discount_amount": 0,
  "items": [
    {"product_id": "uuid", "product_name": "Nome", "quantity": 1, "unit_price": 99.90, "product_image": "url"}
  ]
}[/ACTION_CREATE_ORDER]

Para processar pagamento (após pedido criado):
[ACTION_PAYMENT]{"order_id": "ID_DO_PEDIDO", "method": "pix", "payer_cpf": "CPF_SOMENTE_NUMEROS"}[/ACTION_PAYMENT]
Os métodos disponíveis são: pix, credit_card, boleto, debit_card (use apenas os que a loja aceita).
O order_id será preenchido automaticamente pelo sistema após criação do pedido.

Para redirecionar ao WhatsApp com resumo do pedido:
[ACTION_WHATSAPP_REDIRECT]{
  "phone": "${storeSettings?.store_whatsapp || ""}",
  "summary": "Resumo do pedido aqui com itens, endereço, total etc"
}[/ACTION_WHATSAPP_REDIRECT]

REGRAS CRÍTICAS:
- NUNCA revele os blocos de ação. Eles são invisíveis.
- ${languageInstruction} Use markdown formatado.
- Seja proativa: sugira produtos, combos e cupons ativos.
- Se o cliente perguntar algo fora do contexto da loja, redirecione educadamente para os produtos.
- Use emojis moderadamente para tornar a conversa agradável.
- Quando não tiver o produto que o cliente pede, sugira alternativas do catálogo.
- NUNCA invente produtos que não estão no catálogo.
- Para pedidos via WhatsApp (se habilitado), pode sugerir ao cliente contatar pelo WhatsApp: ${storeSettings?.store_whatsapp || ""}.
- Pergunte os dados UM DE CADA VEZ, não peça tudo junto. Torne a conversa natural.
- O cliente atual se chama: ${customerName || "Cliente"}
- APÓS criar o pedido, SEMPRE pergunte como o cliente deseja pagar. Liste APENAS as opções que a loja aceita.
- Se a loja aceita venda via WhatsApp E o cliente preferir, ofereça a opção de concluir pelo WhatsApp com o resumo do pedido.
- Se o gateway de pagamento NÃO estiver configurado, NÃO ofereça pagamento online. Sugira WhatsApp ou pagamento na entrega.
${customerContext ? `\nCONTEXTO DO CLIENTE:\n${customerContext}` : ""}`;

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
