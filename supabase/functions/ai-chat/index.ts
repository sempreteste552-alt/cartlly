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

    const systemPrompt = `Você é o Assistente IA da plataforma de e-commerce. Você ajuda lojistas a gerenciar suas lojas de forma inteligente.

CONTEXTO DA LOJA:
- Nome: ${storeContext?.storeName || "Não definido"}
- Produtos cadastrados: ${storeContext?.totalProducts || 0}
- Pedidos totais: ${storeContext?.totalOrders || 0}
- Receita total: R$ ${storeContext?.totalRevenue?.toFixed(2) || "0.00"}
- Categorias: ${storeContext?.categories?.join(", ") || "Nenhuma"}
- Cupons ativos: ${storeContext?.activeCoupons || 0}

SUAS CAPACIDADES:
1. **Campanhas**: Sugerir campanhas promocionais baseadas no perfil da loja, sazonalidade e histórico
2. **Produtos**: Sugerir novos produtos, melhorias em descrições, estratégias de precificação
3. **Promoções**: Criar estratégias de cupons, descontos progressivos, combos
4. **Marketing**: Ideias de posts para redes sociais, emails de engajamento
5. **Análise**: Interpretar dados de vendas, identificar tendências e oportunidades
6. **Estoque**: Alertar sobre produtos com estoque baixo, sugerir reposição
7. **Fidelização**: Estratégias para reter clientes e aumentar ticket médio

REGRAS:
- Responda sempre em português do Brasil
- Seja objetivo e prático nas sugestões
- Use dados da loja quando disponíveis para personalizar sugestões
- Formate respostas com markdown para melhor legibilidade
- Quando sugerir campanhas, inclua: nome, descrição, público-alvo, desconto sugerido e duração
- Seja proativo: sugira ações mesmo quando não perguntado diretamente`;

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
