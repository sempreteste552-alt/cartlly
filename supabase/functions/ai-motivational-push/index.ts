import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

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

    const { user_id } = await req.json();
    if (!user_id) throw new Error("user_id required");

    // 1. Check if user is a tenant (not super admin)
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user_id)
      .eq("role", "super_admin")
      .maybeSingle();

    if (roleData) {
      return new Response(JSON.stringify({ skipped: true, reason: "super_admin" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Check how many motivational pushes were sent today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data: todayPushes, error: countErr } = await supabase
      .from("push_logs")
      .select("id")
      .eq("user_id", user_id)
      .eq("event_type", "motivational_push")
      .gte("created_at", todayStart.toISOString());

    if (countErr) throw countErr;

    if ((todayPushes?.length || 0) >= 2) {
      return new Response(JSON.stringify({ skipped: true, reason: "limit_reached" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Get tenant info for personalization
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", user_id)
      .maybeSingle();

    const { data: storeSetting } = await supabase
      .from("store_settings")
      .select("store_name")
      .eq("user_id", user_id)
      .maybeSingle();

    // 4. Get some quick stats for context
    const { data: recentOrders } = await supabase
      .from("orders")
      .select("id, total")
      .eq("user_id", user_id)
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .neq("status", "cancelado");

    const orderCount = recentOrders?.length || 0;
    const revenue = recentOrders?.reduce((s: number, o: any) => s + (o.total || 0), 0) || 0;

    const { count: productCount } = await supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user_id)
      .eq("published", true);

    const { count: customerCount } = await supabase
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("store_user_id", user_id);

    const tenantName = profile?.display_name || storeSetting?.store_name || "Lojista";
    const storeName = storeSetting?.store_name || "sua loja";
    const isFirstPush = (todayPushes?.length || 0) === 0;

    // Read AI brain config for custom instructions
    const { data: aiConfig } = await supabase
      .from("tenant_ai_brain_config")
      .select("custom_instructions")
      .eq("user_id", user_id)
      .maybeSingle();
    const customInstructions = aiConfig?.custom_instructions || "";

    // 5. Get last 15 motivational messages to avoid repetition of themes
    const { data: lastMsgs } = await supabase
      .from("push_logs")
      .select("body, title, created_at")
      .eq("user_id", user_id)
      .eq("event_type", "motivational_push")
      .order("created_at", { ascending: false })
      .limit(15);

    const recentMessages = lastMsgs?.map((m: any) => `[${m.title}] ${m.body}`).filter(Boolean).join("\n") || "Nenhuma mensagem anterior.";

    // 6. Generate AI motivational message
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    // Usa horário de Brasília (UTC-3) para saudação correta
    const nowBrasilia = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const hour = nowBrasilia.getHours();
    const greeting = hour < 6 ? "Boa madrugada" : hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

    // Detect day of week in Brazil
    const dayOfWeek = nowBrasilia.toLocaleDateString("pt-BR", { weekday: "long" });

    // Extract words from previous messages to create a blacklist
    const prevWords = lastMsgs?.flatMap((m: any) => {
      const text = `${m.title} ${m.body}`.toLowerCase();
      return text.split(/\s+/).filter((w: string) => w.length > 3);
    }) || [];
    const wordBlacklist = [...new Set(prevWords)].slice(0, 80).join(", ");

    const systemPrompt = `Você é o assistente motivacional da plataforma Cartlly. Envie UMA mensagem curta, motivacional e persuasiva para o dono da loja.

REGRAS DE FORMATO:
- JSON: {"title": "...", "body": "..."}
- title: máx 40 chars. body: máx 120 chars.
- Emojis: 1-2 máx.
- Horário Brasília: ${hour}h (${dayOfWeek}). Saudação: "${greeting}". NUNCA erre o período do dia.

===== REGRAS ANTI-REPETIÇÃO (CRÍTICO - SIGA À RISCA) =====
Abaixo estão as mensagens anteriores. Sua nova mensagem DEVE ser 100% DIFERENTE:
1. NÃO comece com a mesma palavra ou emoji de NENHUMA mensagem anterior
2. NÃO use o mesmo tema (se falou de vendas, fale de outro assunto)
3. NÃO repita NENHUMA expressão, gíria ou estrutura similar
4. NÃO use referências ao dia da semana se já usou nas últimas 5 mensagens
5. Proibido: repetir qualquer início de frase já usado
6. CADA mensagem deve parecer escrita por uma pessoa DIFERENTE

PALAVRAS PROIBIDAS (já usadas - NÃO repita nenhuma):
${wordBlacklist}

MENSAGENS ANTERIORES (leia TODAS e faça algo COMPLETAMENTE diferente):
${recentMessages}
==========================================================

TEMAS POSSÍVEIS (escolha um que NÃO foi usado recentemente):
- Dica de precificação, organização, atendimento, branding
- Elogio pessoal, frase de empreendedor famoso
- Meta numérica específica, desafio do dia
- Insight de marketing digital, redes sociais
- Curiosidade de mercado, tendência
${customInstructions ? `\nINSTRUÇÕES DO LOJISTA:\n${customInstructions}` : ""}`;

    const userPrompt = `Gere uma mensagem motivacional para ${tenantName} (loja: ${storeName}).
Contexto: ${greeting}, ${isFirstPush ? "primeiro acesso do dia" : "segundo acesso do dia"}.
Pedidos hoje: ${orderCount} (R$ ${revenue.toFixed(2)}).
Produtos ativos: ${productCount || 0}. Clientes cadastrados: ${customerCount || 0}.

MENSAGENS ANTERIORES (NÃO REPITA):
${recentMessages}`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.9,
      }),
    });

    const aiResult = await aiResponse.json();
    const rawContent = aiResult.choices?.[0]?.message?.content || "";

    // Parse JSON from AI response
    let title = "💪 Cartlly";
    let body = `${greeting}, ${tenantName}! Bora vender hoje!`;
    
    try {
      const cleaned = rawContent.replace(/```json\s*/g, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(cleaned);
      if (parsed.title) title = parsed.title.substring(0, 50);
      if (parsed.body) body = parsed.body.substring(0, 150);
    } catch {
      // Use fallback message
      console.warn("Failed to parse AI response, using fallback:", rawContent);
    }

    // 7. Send push notification
    await supabase.functions.invoke("send-push-internal", {
      body: {
        target_user_id: user_id,
        title,
        body,
        type: "motivational_push",
        url: "/admin",
      },
    });

    // 8. Log the push with event_type for dedup
    await supabase.from("push_logs").insert({
      user_id,
      title,
      body,
      event_type: "motivational_push",
      status: "sent",
      trigger_type: "ai_motivational",
    });

    return new Response(JSON.stringify({ sent: true, title, body }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Motivational push error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
