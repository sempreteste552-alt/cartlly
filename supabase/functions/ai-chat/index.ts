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

    const productsInfo = (storeContext?.products || [])
      .slice(0, 50)
      .map(
        (p: any) =>
          `• ID curto: ${p.id || "N/A"} | Nome: ${p.name} | Preço: R$${p.price} | Estoque: ${p.stock} | 👁 ${p.views || 0} visualizações | ${p.published ? "Publicado" : "Rascunho"}${p.category ? ` | Categoria: ${p.category}` : ""}`
      )
      .join("\n");

    const ordersInfo = (storeContext?.recentOrders || [])
      .slice(0, 20)
      .map((o: any) => `• #${o.id} — ${o.customer} — R$${o.total} — ${o.status} — ${o.date}`)
      .join("\n");

    const couponsInfo = (storeContext?.coupons || [])
      .map(
        (c: any) =>
          `• ${c.code}: ${c.discount_type === "percentage" ? c.discount_value + "%" : "R$" + c.discount_value} | ${c.active ? "Ativo" : "Inativo"} | Usos: ${c.used_count}/${c.max_uses || "∞"}${c.expires_at ? ` | Expira: ${c.expires_at}` : ""}`
      )
      .join("\n");

    const aiName = storeContext?.aiName || "Assistente IA";
    const aiTone = storeContext?.aiTone || "educada";

    const toneMap: Record<string, string> = {
      educada: "Seja sempre educada, gentil e paciente. Use expressões cordiais.",
      profissional: "Mantenha um tom profissional, direto e eficiente.",
      divertida: "Seja divertida, use emojis e tom descontraído.",
      formal: "Use linguagem formal e respeitosa. Trate por 'senhor(a)'.",
      amigavel: "Seja como um amigo atencioso, caloroso e empático.",
      ceo_profissional:
        "Você é agora a Máquina de Inteligência de Vendas e Marketing (Cérebro CEO). Seu tom é de um consultor estratégico de elite. Seja direto, focado em ROI, faturamento, conversão e ticket médio. Proponha estratégias de marketing agressivas, analise dados com foco em lucro e fale como um CEO experiente que quer dominar o mercado.",
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
- Pedidos aprovados: ${storeContext?.approvedOrders || 0}
- Pedidos cancelados/recusados: ${storeContext?.cancelledOrders || 0}
- Pedidos pendentes: ${storeContext?.pendingOrders || 0}
- Faturamento APROVADO (só pedidos válidos): R$ ${storeContext?.totalRevenue?.toFixed(2) || "0.00"}
- Ticket médio (aprovados): R$ ${storeContext?.avgTicket?.toFixed(2) || "0.00"}
- Categorias: ${storeContext?.categories?.join(", ") || "Nenhuma"}
- Cupons ativos: ${storeContext?.activeCoupons || 0}
- Venda via WhatsApp: ${storeContext?.sellViaWhatsapp ? "Sim" : "Não"}
- PIX: ${storeContext?.paymentPix ? "Sim" : "Não"}
- Cartão: ${storeContext?.paymentCreditCard ? "Sim" : "Não"}

IMPORTANTE SOBRE MÉTRICAS:
- "Faturamento" e "Receita" = APENAS pedidos aprovados (não inclui cancelados, recusados ou expirados)
- "Ticket médio" = Faturamento aprovado / Número de pedidos aprovados
- Nunca misture pedidos cancelados/recusados com faturamento real
- Frete: ${storeContext?.shippingEnabled ? "Ativo" : "Inativo"}

PRODUTOS (use exatamente estes nomes e IDs curtos quando editar):
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
- Quando o lojista pedir para executar algo, explique em linguagem natural e coloque o bloco de ação INVISÍVEL no final da resposta.
- Se faltarem detalhes (como texto, cor, link ou produto exato), pergunte antes de executar.
- Para faixa promocional, banner de aviso no topo, letreiro e ações de marketing textual, use ACTION_MARKETING.
- Para editar produto, SEMPRE envie product_id e product_name usando exatamente os dados da lista acima. Nunca invente ID ou nome.
- Para estoque, você pode fazer 2 tipos de ação:
  1. definir estoque final com updates.stock
  2. ajustar relativamente com updates.stock_delta
- Exemplos:
  - “abaixar 2 do estoque” => "updates": { "stock_delta": -2 }
  - “repor 5 unidades” => "updates": { "stock_delta": 5 }
  - “definir estoque para 20” => "updates": { "stock": 20 }

FORMATOS DE AÇÃO (coloque no FINAL da resposta, após o texto):

1. Enviar push para clientes:
[ACTION_PUSH]{"title": "Título", "body": "Texto da notificação"}[/ACTION_PUSH]

2. Criar cupom de desconto:
[ACTION_COUPON]{"code": "CODIGO", "discount_type": "percentage", "discount_value": 10, "max_uses": 100, "min_order_value": 0, "expires_at": null}[/ACTION_COUPON]

3. Assinar/trocar plano:
[ACTION_SUBSCRIBE]{"plan_id": "UUID_DO_PLANO", "plan_name": "NOME_DO_PLANO", "document": "CPF_OU_CNPJ_SOMENTE_NUMEROS"}[/ACTION_SUBSCRIBE]

4. Atualizar produto:
[ACTION_UPDATE_PRODUCT]{"product_id": "ID_CURTO_DO_PRODUTO", "product_name": "NOME_EXATO_DO_PRODUTO", "updates": {"price": 99.90, "stock": 50, "stock_delta": -2, "name": "Novo Nome", "description": "Nova descrição", "published": true}}[/ACTION_UPDATE_PRODUCT]

5. Atualizar configurações da loja:
[ACTION_UPDATE_SETTINGS]{"store_name": "Novo Nome", "store_description": "Nova Descrição", "marquee_text": "Texto Marquee"}[/ACTION_UPDATE_SETTINGS]

6. Atualizar banner/faixa/marketing:
[ACTION_MARKETING]{"announcement_bar_enabled": true, "announcement_bar_text": "Texto", "announcement_bar_bg_color": "#000000", "announcement_bar_text_color": "#ffffff", "announcement_bar_link": "/url", "popup_coupon_enabled": false, "countdown_enabled": false, "free_shipping_bar_enabled": false, "free_shipping_threshold": 100}[/ACTION_MARKETING]

7. Agendar lembrete para o dono:
[ACTION_REMINDER]{"title": "Lembrete", "body": "Descrição do que lembrar", "scheduled_at": "ISO_TIMESTAMP"}[/ACTION_REMINDER]

REGRAS CRÍTICAS:
- Responda sempre em português do Brasil.
- NUNCA responda com JSON puro.
- NUNCA use blocos de código para as ações.
- SEMPRE coloque os blocos de ação no final da resposta.
- Se o lojista pedir para ativar letreiro ou abrir/fechar loja, use ACTION_UPDATE_SETTINGS.
- Se o lojista pedir banner/faixa promocional textual, use ACTION_MARKETING.
- Se for editar produto, use o nome exato e o ID curto do produto listado no contexto.
- Se o pedido envolver abaixar, retirar, vender, repor, somar ou adicionar estoque, prefira updates.stock_delta.
- Nunca gere estoque negativo.`;

    const hasImages = messages.some(
      (m: any) => Array.isArray(m.content) && m.content.some((p: any) => p.type === "image_url")
    );

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: hasImages ? "google/gemini-2.5-flash" : "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        stream: true,
        temperature: 0.7,
        max_tokens: 2500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);

      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de uso da IA atingido no momento. Tente novamente em instantes." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Os créditos do Lovable AI acabaram. Adicione créditos no workspace para continuar." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: `Erro da IA (${response.status})` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("AI chat error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
