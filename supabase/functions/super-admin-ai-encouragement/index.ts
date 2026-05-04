import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { callAI } from "../_shared/ai-service.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Fetch all tenants (excluding super admins)
    const { data: saIds } = await supabase.rpc('get_super_admin_ids');
    const saUserIds = saIds?.map(sa => sa.user_id) || [];
    
    const { data: tenants } = await supabase
      .from("profiles")
      .select("id, user_id, display_name")
      // Filter out super admins if any
      .not("user_id", "in", `(${saUserIds.join(",")})`);

    if (!tenants) throw new Error("No tenants found");

    const processed = [];

    for (const tenant of tenants) {
      // 2. Check sales for the last 24h
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: sales } = await supabase
        .from("orders")
        .select("total_amount")
        .eq("user_id", tenant.user_id)
        .gte("created_at", yesterday);

      const totalSales = sales?.reduce((acc, s) => acc + (s.total_amount || 0), 0) || 0;
      const count = sales?.length || 0;

      // 3. Selective Encouragement: Threshold or probability
      // Only for tenants with > 2 sales OR 10% chance if they have at least 1 sale
      const shouldSend = count > 2 || (count > 0 && Math.random() < 0.1);

      if (shouldSend) {
        // Use AI to generate an encouraging message
        const systemPrompt = `Você é a IA do Super Admin. Sua missão é encorajar os donos de lojas (tenants) que estão tendo sucesso.
Seja breve, amigável e use um tom de "parabéns" e "estamos orgulhosos". 
Use o nome do dono se souber. 
Não seja invasivo, apenas um "mimo" para eles se sentirem valorizados.`;
        
        const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-1.5-flash",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: `Gere uma mensagem curta de encorajamento para ${tenant.display_name || "Lojista"} que teve ${count} vendas hoje, totalizando R$ ${totalSales.toFixed(2)}.` }
            ],
            temperature: 0.8,
          }),
        });

        const aiResult = await aiResponse.json();
        const msg = aiResult.choices[0].message.content;

        // Find a super admin to be the "sender"
        const senderId = saUserIds[0];

        // Send push
        await supabase.functions.invoke("send-push-internal", {
          body: {
            target_user_id: tenant.user_id,
            title: "🎉 Notícia do Super Admin",
            body: msg,
            type: "ceo_encouragement",
            store_user_id: senderId
          }
        });

        // Add in-app notification
        await supabase.from("tenant_messages").insert({
          source_tenant_id: senderId,
          target_user_id: tenant.user_id,
          target_area: "admin_dashboard",
          audience_type: "super_admin_to_tenant",
          title: "Parabéns pelas vendas!",
          body: msg,
          message_type: "info",
          status: "sent",
          channel: "push",
          sender_type: "super_admin",
          sender_user_id: senderId,
          is_global: false,
          target_tenant_id: tenant.user_id
        });

        processed.push({ tenant: tenant.user_id, message: msg });
      }
    }

    return new Response(JSON.stringify({ processed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Super Admin Encouragement Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
