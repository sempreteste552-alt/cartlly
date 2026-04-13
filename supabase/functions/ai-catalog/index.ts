import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { catalogText, catalogImages, existingCategories } = await req.json();

    if ((!catalogText || typeof catalogText !== "string") && (!catalogImages || !Array.isArray(catalogImages) || catalogImages.length === 0)) {
      return new Response(JSON.stringify({ error: "Envie texto ou imagens do catálogo" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `Você é um assistente especializado em e-commerce. Analise o catálogo de produtos fornecido (texto ou imagem) e extraia os produtos estruturados.

Para cada produto encontrado, retorne:
- name: nome do produto
- description: descrição breve
- price: preço em número (se encontrado, senão 0)
- category: nome da categoria sugerida
- stock: quantidade em estoque (se encontrado, senão 10)
- variants: array de variantes encontradas (cor, tamanho, material, etc). Cada variante deve ter:
  - variant_type: tipo da variante (ex: "Cor", "Tamanho", "Material")
  - variant_value: valor da variante (ex: "Preto", "M", "Algodão")
  - stock: estoque desta variante (se encontrado, senão 5)
  - price_modifier: modificador de preço (0 se não houver diferença)

IMPORTANTE: Se o catálogo for de roupas, calçados ou acessórios, SEMPRE extraia as variantes de tamanho e cor disponíveis.
Se um produto tiver múltiplas cores ou tamanhos listados, crie uma variante para cada combinação.

Categorias existentes na loja: ${existingCategories?.join(", ") || "nenhuma"}
Use categorias existentes quando possível, ou sugira novas.

Se a entrada for uma imagem, faça OCR/leitura visual para extrair todos os produtos visíveis (tabelas, listas, cardápios, catálogos impressos, etc).`;

    const userContent: any[] = [];

    if (catalogText) {
      userContent.push({ type: "text", text: `Analise este catálogo e extraia os produtos com todas as variantes (cor, tamanho, etc):\n\n${catalogText}` });
    }

    if (catalogImages && catalogImages.length > 0) {
      userContent.push({ type: "text", text: "Analise as imagens abaixo e extraia todos os produtos visíveis com suas variantes (cor, tamanho, etc):" });
      for (const img of catalogImages) {
        userContent.push({
          type: "image_url",
          image_url: { url: img },
        });
      }
    }

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
          { role: "user", content: userContent },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_products",
              description: "Extract products from catalog text or image, including variants like color and size",
              parameters: {
                type: "object",
                properties: {
                  products: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        description: { type: "string" },
                        price: { type: "number" },
                        category: { type: "string" },
                        stock: { type: "number" },
                        variants: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              variant_type: { type: "string" },
                              variant_value: { type: "string" },
                              stock: { type: "number" },
                              price_modifier: { type: "number" },
                            },
                            required: ["variant_type", "variant_value", "stock", "price_modifier"],
                          },
                        },
                      },
                      required: ["name", "description", "price", "category", "stock"],
                    },
                  },
                },
                required: ["products"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_products" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA insuficientes para esta operação. Verifique seu plano." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error [${response.status}]`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in response");

    const result = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("AI catalog error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
