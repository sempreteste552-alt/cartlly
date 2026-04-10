import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization")!;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) throw new Error("Não autorizado");

    const { messages } = await req.json();

    // 1. Fetch Store Config & Context
    const [
      { data: storeSettings },
      { data: aiConfig },
      { data: recentOrders },
      { data: failedPayments },
      { data: lowStockProducts },
      { data: salesStats }
    ] = await Promise.all([
      supabase.from("store_settings").select("store_name, ai_name, ai_chat_tone").eq("user_id", user.id).single(),
      supabase.from("tenant_ai_brain_config").select("*").eq("user_id", user.id).single(),
      supabase.from("orders").select("id, status, total_amount, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10),
      supabase.from("payments").select("id, order_id, status, amount, created_at").eq("user_id", user.id).eq("status", "failed").order("created_at", { ascending: false }).limit(5),
      supabase.from("products").select("name, stock").eq("user_id", user.id).lt("stock", 5).limit(10),
      supabase.rpc("get_store_sales_stats", { p_user_id: user.id })
    ]);

    const storeName = storeSettings?.store_name || "Sua Loja";
    
    // 2. Build System Prompt (Amiga CEO Mode)
    const systemPrompt = `Você é a "Amiga CEO", o cérebro estratégico e braço direito do dono da loja "${storeName}". 
Sua missão é ser uma "máquina de fazer dinheiro" e um suporte administrativo impecável.

STATUS ATUAL DA LOJA:
- Pedidos Recentes: ${JSON.stringify(recentOrders || [])}
- Pagamentos Falhos: ${JSON.stringify(failedPayments || [])}
- Produtos com Baixo Estoque: ${JSON.stringify(lowStockProducts || [])}
- Vendas Hoje: ${JSON.stringify(salesStats || "N/A")}

INSTRUÇÕES DE PERSONALIDADE:
- Seja proativa, analítica e focada em resultados (vendas e eficiência).
- Use um tom de "amiga CEO" — direta ao ponto, inteligente, encorajadora e extremamente ágil.
- Antecipe problemas e sugira ações lucrativas (ex: "esse produto vende pouco, vamos criar uma promoção?").
- O contexto customizado do seu "cérebro" é: ${aiConfig?.custom_instructions || 'Nenhum'}.

CAPACIDADES ESPECIAIS (AÇÕES):
Você pode realizar ações inserindo blocos JSON específicos no final da sua resposta (invisíveis para o usuário final no frontend, mas processados pelo sistema):

1. AGENDAR TAREFA:
Use para lembretes ou ações futuras (ex: mandar mensagem amanhã).
[ACTION_SCHEDULE_TASK]{
  "task_type": "send_push",
  "scheduled_at": "ISO_TIMESTAMP",
  "payload": { "title": "...", "body": "...", "target_segment": "all" },
  "ai_instruction": "instrução original aqui"
}[/ACTION_SCHEDULE_TASK]

2. ENVIAR ALERTA IMEDIATO:
Use para notificações urgentes ao dono.
[ACTION_SEND_ADMIN_ALERT]{ "type": "urgency", "message": "..." }[/ACTION_SEND_ADMIN_ALERT]

REGRAS:
- Se o usuário pedir para "lembrar" ou "agendar" algo, use obrigatoriamente [ACTION_SCHEDULE_TASK].
- Se identificar um erro crítico de pagamento, avise imediatamente.
- Analise o estoque e sugira estratégias de "queima" ou "reposição".
- Responda sempre em Português do Brasil.`;

    // 3. Call LLM
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
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
        temperature: 0.7,
      }),
    });

    const aiResult = await response.json();
    const assistantMessage = aiResult.choices[0].message.content;

    // 4. Post-process Actions (Extract and Execute)
    const taskRegex = /\[ACTION_SCHEDULE_TASK\]([\s\S]*?)\[\/ACTION_SCHEDULE_TASK\]/g;
    let match;
    while ((match = taskRegex.exec(assistantMessage)) !== null) {
      try {
        const taskData = JSON.parse(match[1]);
        await supabase.from("ai_scheduled_tasks").insert({
          user_id: user.id,
          task_type: taskData.task_type,
          scheduled_at: taskData.scheduled_at,
          payload: taskData.payload,
          ai_instruction: taskData.ai_instruction,
          status: "pending"
        });
      } catch (e) {
        console.error("Error parsing/inserting task:", e);
      }
    }

    // 5. Store conversation
    await supabase.from("admin_ai_chats").insert([
      { user_id: user.id, role: "user", content: messages[messages.length - 1].content },
      { user_id: user.id, role: "assistant", content: assistantMessage }
    ]);

    return new Response(JSON.stringify({ content: assistantMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("AI admin assistant error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
