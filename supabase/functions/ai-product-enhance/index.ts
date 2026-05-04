import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { callAI, aiErrorToResponse } from "../_shared/ai-service.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const { action, productName, productDescription, productPrice, productCategory, imageUrl, customPrompt, userId: requestedUserId, platform } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller identity
    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller }, error: callerError } = await callerClient.auth.getUser();
    
    if (callerError || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    // Security check
    let targetUserId = requestedUserId || caller.id;
    if (targetUserId !== caller.id) {
      const adminClient = createClient(supabaseUrl, supabaseKey);
      const { data: roleData } = await adminClient
        .from("user_roles")
        .select("role")
        .eq("user_id", caller.id)
        .eq("role", "super_admin")
        .maybeSingle();

      if (!roleData) {
        return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
      }
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch tenant brain config
    let aiConfig = null;
    const { data } = await supabase
      .from("tenant_ai_brain_config")
      .select("*")
      .eq("user_id", targetUserId)
      .maybeSingle();
    aiConfig = data;


    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    let systemPrompt = "";
    let userContent: any[] = [];
    let toolDef: any = null;
    let toolName = "";

    if (action === "generate_description") {
      systemPrompt = `Você é um especialista em copywriting para e-commerce brasileiro. Gere descrições otimizadas para SEO.
Regras:
- Título SEO com no máximo 70 caracteres
- Descrição rica com benefícios, características e palavras-chave naturais
- Use linguagem persuasiva e profissional em português do Brasil
- Inclua meta description para SEO (max 160 chars)
- Sugira 5 tags/palavras-chave relevantes`;

      userContent = [{ type: "text", text: `Produto: ${productName}\nCategoria: ${productCategory || "Geral"}\nDescrição atual: ${productDescription || "Nenhuma"}\nPreço: R$ ${productPrice || "N/A"}` }];
      toolName = "generate_seo_content";
      toolDef = {
        type: "function",
        function: {
          name: toolName,
          description: "Generate SEO-optimized product content",
          parameters: {
            type: "object",
            properties: {
              seo_title: { type: "string", description: "SEO optimized title (max 70 chars)" },
              description: { type: "string", description: "Rich product description with benefits and features" },
              meta_description: { type: "string", description: "Meta description for SEO (max 160 chars)" },
              tags: { type: "array", items: { type: "string" }, description: "5 relevant SEO keywords/tags" },
            },
            required: ["seo_title", "description", "meta_description", "tags"],
          },
        },
      };
    } else if (action === "suggest_price") {
      systemPrompt = `Você é um consultor de precificação para e-commerce brasileiro. Analise o produto e sugira preços estratégicos.
Considere:
- Faixa de preço típica para a categoria no mercado brasileiro
- Preço sugerido, preço mínimo competitivo e preço premium
- Sugestão de preço promocional com % de desconto
- Margem de lucro recomendada`;

      userContent = [{ type: "text", text: `Produto: ${productName}\nCategoria: ${productCategory || "Geral"}\nDescrição: ${productDescription || "Sem descrição"}\nPreço atual: R$ ${productPrice || "não definido"}` }];
      toolName = "suggest_pricing";
      toolDef = {
        type: "function",
        function: {
          name: toolName,
          description: "Suggest pricing strategy for the product",
          parameters: {
            type: "object",
            properties: {
              suggested_price: { type: "number", description: "Recommended retail price" },
              min_price: { type: "number", description: "Minimum competitive price" },
              premium_price: { type: "number", description: "Premium pricing option" },
              promo_price: { type: "number", description: "Promotional price suggestion" },
              promo_discount_percent: { type: "number", description: "Discount percentage for promo" },
              reasoning: { type: "string", description: "Brief explanation of the pricing strategy in Portuguese" },
            },
            required: ["suggested_price", "min_price", "premium_price", "promo_price", "promo_discount_percent", "reasoning"],
          },
        },
      };
    } else if (action === "analyze_image") {
      if (!imageUrl) {
        return new Response(JSON.stringify({ error: "Envie uma imagem para análise" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      systemPrompt = `Você é um especialista em catalogação de produtos para e-commerce. Analise a imagem do produto e extraia informações detalhadas.
Forneça:
- Nome sugerido para o produto
- Descrição detalhada baseada na imagem
- Categoria sugerida
- Cores identificadas
- Tags/palavras-chave baseadas no visual
- Estimativa de faixa de preço no mercado brasileiro`;

      userContent = [
        { type: "text", text: "Analise esta imagem de produto e extraia todas as informações possíveis:" },
        { type: "image_url", image_url: { url: imageUrl } },
      ];
      toolName = "analyze_product_image";
      toolDef = {
        type: "function",
        function: {
          name: toolName,
          description: "Analyze product image and extract details",
          parameters: {
            type: "object",
            properties: {
              suggested_name: { type: "string", description: "Suggested product name" },
              description: { type: "string", description: "Detailed product description from image" },
              suggested_category: { type: "string", description: "Suggested product category" },
              colors: { type: "array", items: { type: "string" }, description: "Colors identified in the product" },
              tags: { type: "array", items: { type: "string" }, description: "Visual tags/keywords" },
              estimated_price_min: { type: "number", description: "Estimated minimum price in BRL" },
              estimated_price_max: { type: "number", description: "Estimated maximum price in BRL" },
            },
            required: ["suggested_name", "description", "suggested_category", "colors", "tags", "estimated_price_min", "estimated_price_max"],
          },
        },
      };
    } else if (action === "generate_restock_phrases") {
      systemPrompt = `Você é um especialista em marketing de escassez e urgência para e-commerce. Gere frases curtas e persuasivas (badges) para produtos que voltaram ao estoque ou que estão vendendo muito.
      Exemplos: "A queridinha voltou!", "Estoque renovado!", "Últimas peças!", "Sucesso de vendas!".
      Gere 5 opções de frases curtas e impactantes.`;

      userContent = [{ type: "text", text: `Produto: ${productName}\nCategoria: ${productCategory || "Geral"}` }];
      toolName = "generate_restock_badges";
      toolDef = {
        type: "function",
        function: {
          name: toolName,
          description: "Generate catchy restock/sales badges for the product",
          parameters: {
            type: "object",
            properties: {
              phrases: { type: "array", items: { type: "string" }, description: "5 catchy sales/restock phrases" },
            },
            required: ["phrases"],
          },
        },
      };
    } else if (action === "generate_social_post") {
      systemPrompt = `Você é um especialista em social media marketing para o mercado brasileiro. Gere legendas criativas e persuasivas para redes sociais.
Regras:
- Gere uma legenda para Instagram (com emojis e hashtags)
- Gere uma legenda para TikTok/Reels (curta, dinâmica e com call-to-action)
- Forneça uma sugestão detalhada de arte/imagem para o post (o que deve conter na imagem, cores, textos sobrepostos)
- O tom deve ser de acordo com as configurações do cérebro da loja se disponíveis.`;

      userContent = [{ type: "text", text: `Produto: ${productName}\nCategoria: ${productCategory || "Geral"}\nDescrição: ${productDescription || "Sem descrição"}\nPlataforma solicitada: ${platform || "Instagram e TikTok"}` }];
      toolName = "generate_social_content";
      toolDef = {
        type: "function",
        function: {
          name: toolName,
          description: "Generate social media captions and art suggestions",
          parameters: {
            type: "object",
            properties: {
              instagram_caption: { type: "string", description: "Creative caption for Instagram" },
              tiktok_caption: { type: "string", description: "Short, punchy caption for TikTok/Reels" },
              art_suggestion: { type: "string", description: "Detailed suggestion for the post art/visual" },
            },
            required: ["instagram_caption", "tiktok_caption", "art_suggestion"],
          },
        },
      };
    } else {
      return new Response(JSON.stringify({ error: "Ação inválida" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-1.5-flash",
        messages: [
          { role: "system", content: `${systemPrompt}
            ${aiConfig ? `
            TREINAMENTO OBRIGATÓRIO:
            Identidade: ${aiConfig.brand_identity || ""}
            Nicho: ${aiConfig.niche || ""}
            Tom: ${aiConfig.tone_of_voice || ""}
            Escrita: ${aiConfig.writing_style || ""}
            Persuasão: ${aiConfig.persuasion_style || ""}
            Proibições: ${aiConfig.prohibitions || ""}
            Instruções: ${aiConfig.custom_instructions || ""}
            ` : ""}`
          },
          { role: "user", content: userContent },
        ],
        tools: [toolDef],
        tool_choice: { type: "function", function: { name: toolName } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA insuficientes para esta operação." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
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

    return new Response(JSON.stringify({ action, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("AI product enhance error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
