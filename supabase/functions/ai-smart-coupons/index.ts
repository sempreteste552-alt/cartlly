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

    const { storeContext, action, userId: requestedUserId } = await req.json();

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

    let prompt = "";

    if (action === "suggest_campaigns") {
      prompt = `Analise os dados desta loja e sugira 3 campanhas de cupons inteligentes.

DADOS DA LOJA:
- Nome: ${storeContext?.storeName || "Loja"}
- Total de produtos: ${storeContext?.totalProducts || 0}
- Categorias: ${storeContext?.categories?.join(", ") || "Nenhuma"}
- Pedidos no mês: ${storeContext?.monthlyOrders || 0}
- Receita mensal: R$ ${storeContext?.monthlyRevenue?.toFixed(2) || "0.00"}
- Ticket médio: R$ ${storeContext?.avgTicket?.toFixed(2) || "0.00"}
- Cupons ativos: ${storeContext?.activeCoupons || 0}
- Total de clientes: ${storeContext?.totalCustomers || 0}

Para cada campanha, retorne EXATAMENTE neste formato JSON.`;
    } else {
      prompt = `Sugira 3 cupons de desconto ideais para esta loja.

DADOS DA LOJA:
- Nome: ${storeContext?.storeName || "Loja"}
- Ticket médio: R$ ${storeContext?.avgTicket?.toFixed(2) || "0.00"}
- Categorias: ${storeContext?.categories?.join(", ") || "Nenhuma"}
- Pedidos mensais: ${storeContext?.monthlyOrders || 0}

Retorne cupons práticos e criativos.`;
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
          {
            role: "system",
            content: `Você é um especialista em marketing e e-commerce brasileiro. Responda sempre em português do Brasil. Seja criativo e prático nas sugestões.
            ${aiConfig ? `
            TREINAMENTO OBRIGATÓRIO:
            Identidade: ${aiConfig.brand_identity || ""}
            Nicho: ${aiConfig.niche || ""}
            Tom: ${aiConfig.tone_of_voice || ""}
            Persuasão: ${aiConfig.persuasion_style || ""}
            Proibições: ${aiConfig.prohibitions || ""}
            Instruções: ${aiConfig.custom_instructions || ""}
            ` : ""}`
          },
          { role: "user", content: prompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "suggest_coupons",
              description: "Retorna sugestões de cupons inteligentes",
              parameters: {
                type: "object",
                properties: {
                  suggestions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        campaign_name: { type: "string", description: "Nome da campanha" },
                        code: { type: "string", description: "Código do cupom (sem espaços, maiúsculas, max 20 chars)" },
                        discount_type: { type: "string", enum: ["percentage", "fixed"] },
                        discount_value: { type: "number" },
                        min_order_value: { type: "number" },
                        max_uses: { type: "number" },
                        validity_days: { type: "number", description: "Dias de validade" },
                        target_audience: { type: "string", description: "Público-alvo" },
                        reason: { type: "string", description: "Por que essa campanha é boa" },
                      },
                      required: ["campaign_name", "code", "discount_type", "discount_value", "validity_days", "target_audience", "reason"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["suggestions"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "suggest_coupons" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA insuficientes para esta operação." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI error:", response.status, errorText);
      throw new Error(`AI error [${response.status}]`);
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in response");

    const suggestions = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(suggestions), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Smart coupons error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
