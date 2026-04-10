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
      .map((p: any) => `• ${p.name} — R$${p.price} | Estoque: ${p.stock} | ${p.published ? "Publicado" : "Rascunho"}${p.category ? ` | Cat: ${p.category}` : ""}`)
      .join("\n");

    const ordersInfo = (storeContext?.recentOrders || []).slice(0, 20)
      .map((o: any) => `• #${o.id} — ${o.customer} — R$${o.total} — ${o.status} — ${o.date}`)
      .join("\n");

    const couponsInfo = (storeContext?.coupons || [])
      .map((c: any) => `• ${c.code}: ${c.discount_type === "percentage" ? c.discount_value + "%" : "R$" + c.discount_value} | ${c.active ? "Ativo" : "Inativo"} | Usos: ${c.used_count}/${c.max_uses || "∞"}${c.expires_at ? ` | Expira: ${c.expires_at}` : ""}`)
      .join("\n");

    const aiName = storeContext?.aiName || "Assistente IA";

    const systemPrompt = `Você é "${aiName}", o assistente inteligente COMPLETO da plataforma de e-commerce. Você tem acesso TOTAL aos dados da loja e pode EXECUTAR AÇÕES.

DADOS DA LOJA:
- Nome: ${storeContext?.storeName || "Não definido"}
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

Para enviar push para clientes:
[ACTION_PUSH]{"title": "Título", "body": "Texto da notificação"}[/ACTION_PUSH]

Para criar cupom de desconto:
[ACTION_COUPON]{"code": "CODIGO", "discount_type": "percentage", "discount_value": 10, "max_uses": 100, "min_order_value": 0, "expires_at": null}[/ACTION_COUPON]

Para assinar/trocar plano (gerar QR Code PIX):
[ACTION_SUBSCRIBE]{"plan_id": "UUID_DO_PLANO", "plan_name": "NOME_DO_PLANO"}[/ACTION_SUBSCRIBE]

REGRAS CRÍTICAS:
- NUNCA responda com JSON puro. SEMPRE responda em português do Brasil com texto formatado em Markdown.
- Seja objetivo, profissional e prático nas sugestões.
- Use os dados reais da loja para personalizar as respostas.
- Formate respostas com **negrito**, listas, emojis e markdown rico.
- Quando o lojista pedir para criar um cupom, CONFIRME os detalhes no texto E inclua o bloco [ACTION_COUPON] no final.
- Quando o lojista pedir para enviar promoção/push, gere o texto, mostre ao lojista E inclua o bloco [ACTION_PUSH] no final.
- Quando o lojista pedir para assinar um plano ou fazer upgrade: PERGUNTE o CPF/CNPJ se ainda não souber. Quando já tiver o CPF informado na conversa, inclua o bloco [ACTION_SUBSCRIBE] com o plan_id do plano desejado. O sistema vai pedir o CPF ao usuário e gerar o QR Code PIX automaticamente.
- Os blocos de ação são INVISÍVEIS para o usuário — o sistema os processa automaticamente.
- Para cupons, discount_type pode ser "percentage" ou "fixed".
- O cupom criado ficará visível automaticamente na loja.
- NUNCA use blocos de código (\`\`\`) para as ações. Use APENAS os marcadores [ACTION_PUSH], [ACTION_COUPON] e [ACTION_SUBSCRIBE].
- Após criar cupom, em 5 minutos uma notificação push será enviada automaticamente.

ANÁLISE DE IMAGENS:
- O lojista pode enviar imagens (prints de tela, fotos de produtos, configurações de DNS, etc.).
- Se receber um print de configuração de domínio (Hostinger, GoDaddy, Cloudflare, etc.), analise se os registros DNS estão corretos: A record apontando para 185.158.133.1 e TXT record _lovable com o valor de verificação.
- Se receber uma foto de produto, avalie qualidade, iluminação, composição e sugira melhorias.
- Se receber um print da loja, analise layout, UX e sugira ajustes.
- Sempre descreva o que vê na imagem e dê orientações práticas.`;

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
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA insuficientes." }), {
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
    console.error("AI chat error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
