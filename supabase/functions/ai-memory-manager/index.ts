import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { action, tenantId, customerId, content, category, metadata = {} } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Helper to generate embeddings
    const generateEmbedding = async (text: string) => {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "openai/text-embedding-3-small",
          input: text,
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`AI gateway error: ${err}`);
      }

      const data = await response.json();
      return data.data[0].embedding;
    };

    if (action === "ingest-tenant") {
      const embedding = await generateEmbedding(content);
      const { data, error } = await supabase.from("tenant_ai_knowledge").insert({
        tenant_id: tenantId, content, category, embedding, metadata
      }).select().single();
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data }), { headers: corsHeaders });
    }

    if (action === "ingest-customer") {
      const embedding = await generateEmbedding(content);
      const { data, error } = await supabase.from("customer_ai_insights").insert({
        tenant_id: tenantId, customer_id: customerId, insight: content, insight_vector: embedding, category: category || "behavior", metadata
      }).select().single();
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data }), { headers: corsHeaders });
    }

    if (action === "retrieve-context") {
      const queryEmbedding = await generateEmbedding(content);
      const [knowledgeRes, insightsRes] = await Promise.all([
        supabase.rpc("match_tenant_knowledge", {
          query_embedding: queryEmbedding,
          p_tenant_id: tenantId,
          match_threshold: 0.3,
          match_count: 8
        }),
        customerId ? supabase.rpc("match_customer_insights", {
          query_embedding: queryEmbedding,
          p_customer_id: customerId,
          p_tenant_id: tenantId,
          match_threshold: 0.3,
          match_count: 4
        }) : Promise.resolve({ data: [] })
      ]);
      return new Response(JSON.stringify({ knowledge: knowledgeRes.data || [], insights: insightsRes.data || [] }), { headers: corsHeaders });
    }

    if (action === "learn-from-purchase") {
      const { orderId, amount, products } = metadata;
      const insightText = `Cliente realizou uma compra de R$ ${amount}. Produtos: ${products}. Comportamento: Cliente de alto valor que responde bem a ofertas diretas.`;
      const embedding = await generateEmbedding(insightText);
      
      const { error } = await supabase.from("customer_ai_insights").insert({
        tenant_id: tenantId,
        customer_id: customerId,
        insight: insightText,
        insight_vector: embedding,
        category: "buying_pattern",
        relevance_score: 1.5,
        metadata: { orderId, amount }
      });
      if (error) throw error;

      await supabase.from("ai_feedback_loop").insert({
        tenant_id: tenantId,
        customer_id: customerId,
        action_type: "purchase",
        insight_generated: insightText,
        is_processed: true
      });

      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    throw new Error("Invalid action");
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});
