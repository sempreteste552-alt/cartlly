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

    // 1. Fetch Store Config & Context (Expanded)
    const [
      { data: storeSettings },
      { data: aiConfig },
      { data: recentOrders },
      { data: failedPayments },
      { data: lowStockProducts },
      { data: salesStats },
      { data: storePages },
      { data: storeBanners },
      { data: homeSections }
    ] = await Promise.all([
      supabase.from("store_settings").select("*").eq("user_id", user.id).single(),
      supabase.from("tenant_ai_brain_config").select("*").eq("user_id", user.id).single(),
      supabase.from("orders").select("id, status, total_amount, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10),
      supabase.from("payments").select("id, order_id, status, amount, created_at").eq("user_id", user.id).eq("status", "failed").order("created_at", { ascending: false }).limit(5),
      supabase.from("products").select("name, stock, price").eq("user_id", user.id).lt("stock", 5).limit(10),
      supabase.rpc("get_store_sales_stats", { p_user_id: user.id }),
      supabase.from("store_pages").select("title, slug, content").eq("user_id", user.id).limit(5),
      supabase.from("store_banners").select("title, description").eq("user_id", user.id).limit(5),
      supabase.from("store_home_sections").select("title, subtitle, type").eq("user_id", user.id).limit(10)
    ]);

    const storeName = storeSettings?.store_name || "Sua Loja";
    const niche = aiConfig?.niche || "Não definido";
    const chatTone = storeSettings?.ai_chat_tone || "educada";
    
    // 2. Build System Prompt (Enhanced Amiga CEO Mode)
    const systemPrompt = `Você é a "Amiga CEO", o cérebro estratégico e braço direito do dono da loja "${storeName}". 
Sua missão é ser uma "máquina de fazer dinheiro" e um suporte administrativo impecável.

TONALIDADE ATUAL: ${chatTone} (Se for "agressiva", use frases de conversão direta, chamadas para ação fortes e foco total em fechar a venda).

NICHO DA LOJA: ${niche}

CONTEXTO DA LOJA:
- Configurações: ${JSON.stringify(storeSettings || {})}
- Páginas: ${JSON.stringify(storePages || [])}
- Banners: ${JSON.stringify(storeBanners || [])}
- Seções da Home: ${JSON.stringify(homeSections || [])}

STATUS ATUAL:
- Pedidos Recentes: ${JSON.stringify(recentOrders || [])}
- Pagamentos Falhos: ${JSON.stringify(failedPayments || [])}
- Produtos com Baixo Estoque: ${JSON.stringify(lowStockProducts || [])}
- Vendas Hoje: ${JSON.stringify(salesStats || "N/A")}

INSTRUÇÕES DE PERSONALIDADE:
- Seja proativa, analítica e focada em resultados (vendas e eficiência).
- Use um tom de "amiga CEO" — direta ao ponto, inteligente, encorajadora e extremamente ágil.
- Se o dono pedir "agressividade", crie frases de alto impacto para checkout, banners e descrição da loja que removam objeções e criem urgência.
- O contexto customizado do seu "cérebro" é: ${aiConfig?.custom_instructions || 'Nenhum'}.

CAPACIDADES ESPECIAIS (AÇÕES):
Você pode realizar ações inserindo blocos JSON no final da sua resposta:

1. AGENDAR TAREFA (Push para Clientes):
[ACTION_SCHEDULE_TASK]{
  "task_type": "send_push",
  "scheduled_at": "ISO_TIMESTAMP",
  "payload": { "title": "...", "body": "..." },
  "ai_instruction": "descrição da tarefa"
}[/ACTION_SCHEDULE_TASK]

2. LEMBRETE PESSOAL (Push para o Dono):
[ACTION_SCHEDULE_REMINDER]{
  "title": "Lembrete",
  "description": "...",
  "remind_at": "ISO_TIMESTAMP"
}[/ACTION_SCHEDULE_REMINDER]

3. ATUALIZAR CONFIGURAÇÕES DA LOJA:
Use para mudar nome, descrição, marquee_text, etc.
[ACTION_UPDATE_STORE_SETTINGS]{ "store_description": "...", "marquee_text": "...", "store_name": "..." }[/ACTION_UPDATE_STORE_SETTINGS]

4. ATUALIZAR PÁGINA:
[ACTION_UPDATE_PAGE]{ "slug": "sobre-nos", "content": "..." }[/ACTION_UPDATE_PAGE]

REGRAS:
- Responda sempre em Português do Brasil.
- Use as ações JSON apenas quando necessário e no final da resposta.
- Se o usuário pedir para ser "agressivo", confirme que ativou o modo de alta conversão e sugira frases fortes.`;

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

    // 4. Post-process Actions
    
    // --- Update Store Settings ---
    const settingsRegex = /\[ACTION_UPDATE_STORE_SETTINGS\]([\s\S]*?)\[\/ACTION_UPDATE_STORE_SETTINGS\]/g;
    let settingsMatch;
    while ((settingsMatch = settingsRegex.exec(assistantMessage)) !== null) {
      try {
        const updateData = JSON.parse(settingsMatch[1]);
        await supabase.from("store_settings").update({
          ...updateData,
          updated_at: new Date().toISOString()
        }).eq("user_id", user.id);
      } catch (e) {
        console.error("Error updating settings:", e);
      }
    }

    // --- Schedule Reminder (For Admin) ---
    const reminderRegex = /\[ACTION_SCHEDULE_REMINDER\]([\s\S]*?)\[\/ACTION_SCHEDULE_REMINDER\]/g;
    let reminderMatch;
    while ((reminderMatch = reminderRegex.exec(assistantMessage)) !== null) {
      try {
        const reminderData = JSON.parse(reminderMatch[1]);
        await supabase.from("store_ai_reminders").insert({
          user_id: user.id,
          title: reminderData.title,
          description: reminderData.description,
          remind_at: reminderData.remind_at,
          status: "pending"
        });
        
        // Also add to ai_scheduled_tasks for processing
        await supabase.from("ai_scheduled_tasks").insert({
          user_id: user.id,
          task_type: "admin_reminder",
          scheduled_at: reminderData.remind_at,
          payload: { 
            title: reminderData.title, 
            body: reminderData.description 
          },
          status: "pending"
        });
      } catch (e) {
        console.error("Error scheduling reminder:", e);
      }
    }

    // --- Update Page ---
    const pageRegex = /\[ACTION_UPDATE_PAGE\]([\s\S]*?)\[\/ACTION_UPDATE_PAGE\]/g;
    let pageMatch;
    while ((pageMatch = pageRegex.exec(assistantMessage)) !== null) {
      try {
        const pageData = JSON.parse(pageMatch[1]);
        await supabase.from("store_pages").update({
          content: pageData.content,
          updated_at: new Date().toISOString()
        }).eq("user_id", user.id).eq("slug", pageData.slug);
      } catch (e) {
        console.error("Error updating page:", e);
      }
    }

    // --- (Keep existing actions from previous version) ---
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

    // Store conversation
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
