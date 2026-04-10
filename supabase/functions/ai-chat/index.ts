import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, storeContext } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Build rich context from all admin data
    const productsInfo = (storeContext?.products || []).slice(0, 50)
      .map((p: any) => `• ${p.name} — R$${p.price} | Estoque: ${p.stock} | 👁 ${p.views || 0} visualizações | ${p.published ? "Publicado" : "Rascunho"}${p.category ? ` | Cat: ${p.category}` : ""}`)
      .join("\n");

    const ordersInfo = (storeContext?.recentOrders || []).slice(0, 20)
      .map((o: any) => `• #${o.id} — ${o.customer} — R$${o.total} — ${o.status} — ${o.date}`)
      .join("\n");

    const couponsInfo = (storeContext?.coupons || [])
      .map((c: any) => `• ${c.code}: ${c.discount_type === "percentage" ? c.discount_value + "%" : "R$" + c.discount_value} | ${c.active ? "Ativo" : "Inativo"} | Usos: ${c.used_count}/${c.max_uses || "∞"}${c.expires_at ? ` | Expira: ${c.expires_at}` : ""}`)
      .join("\n");

    const aiName = storeContext?.aiName || "Assistente IA";
    const aiTone = storeContext?.aiTone || "educada";

    const toneMap: Record<string, string> = {
      educada: "Seja sempre educada, gentil e paciente. Use expressões cordiais.",
      profissional: "Mantenha um tom profissional, direto e eficiente.",
      divertida: "Seja divertida, use emojis e tom descontraído.",
      formal: "Use linguagem formal e respeitosa. Trate por 'senhor(a)'.",
      amigavel: "Seja como um amigo atencioso, caloroso e empático.",
      ceo_profissional: "Você é agora a **Máquina de Inteligência de Vendas e Marketing (Cérebro CEO)**. Seu tom é de um consultor estratégico de elite. Seja direto, focado em ROI, faturamento, conversão e ticket médio. Proponha estratégias de marketing agressivas, analise dados com foco em lucro e fale como um CEO experiente que quer dominar o mercado. Use termos como 'ROI', 'LTV', 'CAC', 'Upsell', 'Cross-sell' e 'Funil de Vendas'. Desenvolva planos de ação detalhados para aquisição de novos clientes, retenção e aumento da frequência de compra. Analise o estoque e sugira promoções relâmpago para produtos com baixo giro. Seja a mente por trás do sucesso financeiro da loja. Se o dono pedir agressividade, crie frases de alto impacto para checkout, banners e descrição da loja que removam objeções e criem urgência (ex: 'Últimas unidades!', 'Oferta exclusiva por tempo limitado!')."
    };

    const systemPrompt = `Você é "${aiName}", o assistente inteligente COMPLETO da plataforma de e-commerce.
${toneMap[aiTone] || toneMap.educada}

DADOS DA LOJA:
- Nome: ${storeContext?.storeName || "Não definido"}
- Descrição: ${storeContext?.storeDescription || "Não definida"}
- Marquee: ${storeContext?.marqueeText || ""}
- Slug: ${storeContext?.storeSlug || ""}
- WhatsApp: ${storeContext?.storeWhatsapp || "Não configurado"}
- Produtos cadastrados: ${storeContext?.totalProducts || 0}
- Pedidos totais: ${storeContext?.totalOrders || 0}
- Receita total: R$ ${storeContext?.totalRevenue?.toFixed(2) || "0.00"}
- Categorias: ${storeContext?.categories?.join(", ") || "Nenhuma"}
- Cupons ativos: ${storeContext?.activeCoupons || 0}
- Venda via WhatsApp: ${storeContext?.sellViaWhatsapp ? "Sim" : "Não"}
- PIX: ${storeContext?.paymentPix ? "Sim" : "Não"}
- Cartão: ${storeContext?.paymentCreditCard ? "Sim" : "Não"}
- Frete: ${storeContext?.shippingEnabled ? "Ativo" : "Inativo"}

PRODUTOS (detalhado):
${productsInfo || "Nenhum produto cadastrado"}

PEDIDOS RECENTES:
${ordersInfo || "Nenhum pedido"}

CUPONS:
${couponsInfo || "Nenhum cupom"}

PLANOS DISPONÍVEIS:
${(storeContext?.plans || []).map((p: any) => `• ${p.name} — R$${p.price?.toFixed(2)}/mês | ID: ${p.id}`).join("\n") || "Nenhum plano configurado"}

ASSINATURA ATUAL:
- Plano: ${storeContext?.currentPlanName || "FREE"}
- Status: ${storeContext?.subscriptionStatus || "Sem assinatura"}
- Trial: ${storeContext?.isTrial ? `Sim (${storeContext?.trialDaysLeft} dias restantes)` : "Não"}

SUAS CAPACIDADES DE AÇÃO:
Quando o lojista pedir para executar uma ação, PRIMEIRO explique o que vai fazer em linguagem natural, depois inclua o bloco de ação INVISÍVEL no final da sua resposta. Os blocos são processados automaticamente e NÃO são mostrados ao lojista.

FORMATOS DE AÇÃO (coloque no FINAL da resposta, após o texto):

1. Enviar push para clientes:
[ACTION_PUSH]{"title": "Título", "body": "Texto da notificação"}[/ACTION_PUSH]

2. Criar cupom de desconto:
[ACTION_COUPON]{"code": "CODIGO", "discount_type": "percentage", "discount_value": 10, "max_uses": 100, "min_order_value": 0, "expires_at": null}[/ACTION_COUPON]

3. Assinar/trocar plano:
[ACTION_SUBSCRIBE]{"plan_id": "UUID_DO_PLANO", "plan_name": "NOME_DO_PLANO", "document": "CPF_OU_CNPJ_SOMENTE_NUMEROS"}[/ACTION_SUBSCRIBE]

4. Atualizar produto:
[ACTION_UPDATE_PRODUCT]{"product_id": "ID_CURTO_DO_PRODUTO", "updates": {"price": 99.90, "stock": 50, "name": "Novo Nome", "description": "Nova descrição", "published": true}}[/ACTION_UPDATE_PRODUCT]

5. Atualizar configurações da loja (Nome, Descrição, Marquee):
[ACTION_UPDATE_SETTINGS]{"store_name": "Novo Nome", "store_description": "Nova Descrição", "marquee_text": "Texto Marquee"}[/ACTION_UPDATE_SETTINGS]

6. Atualizar Marketing/Faixa Promocional (Banner de Anúncio):
[ACTION_MARKETING]{"announcement_bar_enabled": true, "announcement_bar_text": "Frete Grátis acima de R$100!", "announcement_bar_bg_color": "#000000", "announcement_bar_text_color": "#ffffff", "announcement_bar_link": "/produtos"} [/ACTION_MARKETING]

7. Agendar Lembrete para o Dono:
[ACTION_REMINDER]{"title": "Lembrete", "body": "Descrição do que lembrar", "scheduled_at": "ISO_TIMESTAMP"}[/ACTION_REMINDER]

REGRAS CRÍTICAS:
- NUNCA responda com JSON puro. SEMPRE responda em português do Brasil com texto formatado em Markdown.
- Se o dono pedir para ser "agressivo", confirme que ativou o modo de alta conversão e sugira frases fortes. Use [ACTION_UPDATE_SETTINGS] para aplicar essas frases se ele aprovar.
- Se o dono pedir para "lembrar de algo tal dia/hora", use [ACTION_REMINDER].
- Os blocos de ação são INVISÍVEIS para o usuário — o sistema os processa automaticamente.
- NUNCA use blocos de código (\`\`\`) para as ações. Use APENAS os marcadores [ACTION_...].`;

    // Check if any message contains images (multimodal)
    const hasImages = messages.some((m: any) => Array.isArray(m.content) && m.content.some((p: any) => p.type === "image_url"));
    const model = hasImages ? "google/gemini-2.5-flash" : "google/gemini-2.5-flash";

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
    console.error("AI chat error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});