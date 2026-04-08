import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    // Optional: trigger_type from body (abandoned_cart, daily_promo, new_customer)
    let triggerType = "abandoned_cart";
    let manualStoreUserId: string | null = null;
    try {
      const body = await req.json();
      triggerType = body.trigger_type || "abandoned_cart";
      manualStoreUserId = body.store_user_id || null;
    } catch { /* no body = default */ }

    if (triggerType === "new_customer") {
      return await handleNewCustomer(supabase, supabaseUrl, lovableApiKey, manualStoreUserId);
    }

    if (triggerType === "daily_promo") {
      return await handleDailyPromo(supabase, supabaseUrl, lovableApiKey, manualStoreUserId);
    }

    // === ABANDONED CART RECOVERY ===
    const twentyMinAgo = new Date(Date.now() - 20 * 60 * 1000).toISOString();
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    let query = supabase
      .from("abandoned_carts")
      .select("*")
      .eq("recovered", false)
      .lt("abandoned_at", twentyMinAgo)
      .or(`last_reminder_at.is.null,last_reminder_at.lt.${oneHourAgo}`)
      .lt("reminder_sent_count", 5)
      .not("customer_id", "is", null);

    if (manualStoreUserId) {
      query = query.eq("user_id", manualStoreUserId);
    }

    const { data: carts, error: cartErr } = await query;

    if (cartErr) {
      console.error("Query error:", cartErr);
      return json({ error: cartErr.message }, 500);
    }

    if (!carts || carts.length === 0) {
      return json({ processed: 0, message: "No abandoned carts to process" });
    }

    // Fetch customer data
    const customerIds = [...new Set(carts.map(c => c.customer_id).filter(Boolean))];
    const { data: customers } = await supabase
      .from("customers")
      .select("id, name, email, auth_user_id, store_user_id")
      .in("id", customerIds);
    const customerMap = new Map((customers || []).map(c => [c.id, c]));

    // Fetch store settings for all relevant stores
    const storeUserIds = [...new Set(carts.map(c => c.user_id))];
    const storeMap = await getStoreMap(supabase, storeUserIds);

    let sent = 0;
    let skipped = 0;
    const dayOfWeek = new Date().getDay();
    const hour = new Date().getHours();

    for (const cart of carts) {
      try {
        const customer = customerMap.get(cart.customer_id);
        if (!customer?.auth_user_id || !customer?.store_user_id) { skipped++; continue; }

        const store = storeMap.get(cart.user_id);
        const storeName = store?.store_name || "nossa loja";
        const items = Array.isArray(cart.items) ? cart.items : [];
        const itemNames = items.slice(0, 3).map((i: any) => i.name || "Produto").join(", ");
        const totalValue = cart.total || items.reduce((s: number, i: any) => s + ((i.price || 0) * (i.quantity || 1)), 0);

        let title = "🛒 Seus itens estão te esperando!";
        let body = `Olá ${customer.name}! Você deixou ${items.length} item(s) no carrinho na ${storeName}. Finalize sua compra!`;

        if (lovableApiKey) {
          try {
            const aiMsg = await generateAIMessage(lovableApiKey, {
              type: "abandoned_cart",
              customerName: customer.name,
              storeName,
              itemNames,
              totalValue: Number(totalValue).toFixed(2),
              itemCount: items.length,
              reminderCount: cart.reminder_sent_count,
              dayOfWeek,
              hour,
            });
            if (aiMsg) { title = aiMsg.title; body = aiMsg.body; }
          } catch (e) { console.error("AI error:", e); }
        }

        const pushResp = await fetch(`${supabaseUrl}/functions/v1/send-push-internal`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            target_user_id: customer.auth_user_id,
            title, body,
            url: "/",
            type: "abandoned_cart",
            data: { cartId: cart.id, itemCount: items.length },
          }),
        });
        const pushData = await pushResp.json();

        await supabase.from("abandoned_carts").update({
          last_reminder_at: new Date().toISOString(),
          reminder_sent_count: (cart.reminder_sent_count || 0) + 1,
        }).eq("id", cart.id);

        await supabase.from("automation_executions").insert({
          user_id: customer.store_user_id,
          customer_id: cart.customer_id,
          trigger_type: "abandoned_cart",
          channel: "push",
          message_text: `${title} — ${body}`,
          ai_generated: !!lovableApiKey,
          status: pushData.sent > 0 ? "sent" : "failed",
          error_message: pushData.sent > 0 ? null : JSON.stringify(pushData).slice(0, 200),
        });

        if (pushData.sent > 0) sent++; else skipped++;
      } catch (err: any) {
        console.error(`Error processing cart ${cart.id}:`, err);
        skipped++;
      }
    }

    return json({ processed: carts.length, sent, skipped });
  } catch (error: any) {
    console.error("Automation error:", error);
    return json({ error: error.message }, 500);
  }
});

// === NEW CUSTOMER WELCOME ===
async function handleNewCustomer(supabase: any, supabaseUrl: string, lovableApiKey: string | undefined, storeUserId: string | null) {
  // Find customers created in the last 10 minutes that haven't received a welcome push
  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  let query = supabase
    .from("customers")
    .select("id, name, email, auth_user_id, store_user_id, created_at")
    .gte("created_at", tenMinAgo);

  if (storeUserId) query = query.eq("store_user_id", storeUserId);

  const { data: newCustomers } = await query;
  if (!newCustomers || newCustomers.length === 0) {
    return json({ processed: 0, message: "No new customers" });
  }

  // Check which already got a welcome push
  const { data: existingExecs } = await supabase
    .from("automation_executions")
    .select("customer_id")
    .eq("trigger_type", "new_customer")
    .in("customer_id", newCustomers.map((c: any) => c.id));

  const alreadySent = new Set((existingExecs || []).map((e: any) => e.customer_id));
  const storeUserIds = [...new Set(newCustomers.map((c: any) => c.store_user_id))];
  const storeMap = await getStoreMap(supabase, storeUserIds);

  let sent = 0;
  const dayOfWeek = new Date().getDay();

  for (const customer of newCustomers) {
    if (alreadySent.has(customer.id) || !customer.auth_user_id) continue;

    const store = storeMap.get(customer.store_user_id);
    const storeName = store?.store_name || "nossa loja";

    let title = `🎉 Bem-vindo(a), ${customer.name}!`;
    let body = `Que alegria ter você na ${storeName}! Confira nossas ofertas especiais.`;

    if (lovableApiKey) {
      try {
        const aiMsg = await generateAIMessage(lovableApiKey, {
          type: "new_customer",
          customerName: customer.name,
          storeName,
          dayOfWeek,
          hour: new Date().getHours(),
        });
        if (aiMsg) { title = aiMsg.title; body = aiMsg.body; }
      } catch (e) { console.error("AI welcome error:", e); }
    }

    try {
      const pushResp = await fetch(`${supabaseUrl}/functions/v1/send-push-internal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_user_id: customer.auth_user_id,
          title, body, url: "/", type: "new_customer",
        }),
      });
      const pushData = await pushResp.json();

      await supabase.from("automation_executions").insert({
        user_id: customer.store_user_id,
        customer_id: customer.id,
        trigger_type: "new_customer",
        channel: "push",
        message_text: `${title} — ${body}`,
        ai_generated: !!lovableApiKey,
        status: pushData.sent > 0 ? "sent" : "failed",
        error_message: pushData.sent > 0 ? null : JSON.stringify(pushData).slice(0, 200),
      });

      if (pushData.sent > 0) sent++;
    } catch (e: any) {
      console.error("Welcome push error:", e);
    }
  }

  return json({ processed: newCustomers.length, sent });
}

// === DAILY PROMO ===
async function handleDailyPromo(supabase: any, supabaseUrl: string, lovableApiKey: string | undefined, storeUserId: string | null) {
  // Get stores with daily_promo rule enabled
  let rulesQuery = supabase
    .from("automation_rules")
    .select("user_id")
    .eq("trigger_type", "daily_promo")
    .eq("enabled", true);

  if (storeUserId) rulesQuery = rulesQuery.eq("user_id", storeUserId);

  const { data: rules } = await rulesQuery;
  if (!rules || rules.length === 0) return json({ processed: 0, message: "No daily promo rules enabled" });

  const storeIds = [...new Set(rules.map((r: any) => r.user_id))];
  const storeMap = await getStoreMap(supabase, storeIds);

  // Check if already sent today for each store
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  let totalSent = 0;

  for (const sid of storeIds) {
    const { data: todayExecs } = await supabase
      .from("automation_executions")
      .select("id")
      .eq("user_id", sid)
      .eq("trigger_type", "daily_promo")
      .gte("sent_at", todayStart.toISOString())
      .limit(1);

    if (todayExecs && todayExecs.length > 0) continue; // Already sent today

    const store = storeMap.get(sid);
    const storeName = store?.store_name || "Loja";

    // Get customers with push for this store
    const { data: customers } = await supabase
      .from("customers")
      .select("id, name, auth_user_id")
      .eq("store_user_id", sid);

    if (!customers || customers.length === 0) continue;

    const customerUserIds = customers.map((c: any) => c.auth_user_id).filter(Boolean);
    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("user_id")
      .in("user_id", customerUserIds);

    const pushUserIds = [...new Set((subs || []).map((s: any) => s.user_id))];
    if (pushUserIds.length === 0) continue;

    const dayOfWeek = new Date().getDay();
    const hour = new Date().getHours();

    let title = `✨ Novidades na ${storeName}!`;
    let body = `Confira as ofertas especiais de hoje! Temos novidades esperando por você.`;

    if (lovableApiKey) {
      try {
        const aiMsg = await generateAIMessage(lovableApiKey, {
          type: "daily_promo",
          storeName,
          dayOfWeek,
          hour,
          customerCount: pushUserIds.length,
        });
        if (aiMsg) { title = aiMsg.title; body = aiMsg.body; }
      } catch (e) { console.error("AI daily promo error:", e); }
    }

    // Send to all push-enabled customers
    for (const uid of pushUserIds) {
      try {
        const resp = await fetch(`${supabaseUrl}/functions/v1/send-push-internal`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            target_user_id: uid, title, body, url: "/", type: "daily_promo",
          }),
        });
        const data = await resp.json();
        if (data.sent > 0) totalSent++;
      } catch (e) { console.error("Daily promo push error:", e); }
    }

    await supabase.from("automation_executions").insert({
      user_id: sid,
      trigger_type: "daily_promo",
      channel: "push",
      message_text: `${title} — ${body}`,
      ai_generated: !!lovableApiKey,
      status: totalSent > 0 ? "sent" : "failed",
    });
  }

  return json({ processed: storeIds.length, sent: totalSent });
}

// === HELPERS ===

async function getStoreMap(supabase: any, storeUserIds: string[]) {
  const { data: stores } = await supabase
    .from("store_settings")
    .select("user_id, store_name, store_slug")
    .in("user_id", storeUserIds);
  return new Map((stores || []).map((s: any) => [s.user_id, s]));
}

function getSpecialDateContext(): string {
  const now = new Date();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const dayOfWeek = now.getDay();
  const parts: string[] = [];

  // Brazilian holidays & special dates
  const holidays: Record<string, string> = {
    "1-1": "🎆 Ano Novo",
    "2-14": "💕 Dia dos Namorados (internacional)",
    "3-8": "🌸 Dia Internacional da Mulher",
    "4-21": "🇧🇷 Tiradentes",
    "5-1": "👷 Dia do Trabalho",
    "6-12": "💑 Dia dos Namorados",
    "6-24": "🎉 São João",
    "7-20": "👩‍👧 Dia do Amigo",
    "8-11": "👨 Dia dos Pais (próximo)",
    "9-7": "🇧🇷 Independência do Brasil",
    "10-12": "👧 Dia das Crianças / N.S. Aparecida",
    "10-31": "🎃 Halloween",
    "11-15": "🇧🇷 Proclamação da República",
    "11-20": "✊ Dia da Consciência Negra",
    "11-25": "🛍️ Black Friday se aproxima!",
    "11-29": "🛍️ Black Friday!",
    "12-24": "🎄 Véspera de Natal",
    "12-25": "🎄 Natal",
    "12-31": "🎆 Réveillon",
  };

  // Check exact date
  const key = `${month}-${day}`;
  if (holidays[key]) {
    parts.push(`HOJE É ${holidays[key]}`);
  }

  // Check nearby dates (next 3 days)
  for (let offset = 1; offset <= 3; offset++) {
    const future = new Date(now.getTime() + offset * 86400000);
    const fKey = `${future.getMonth() + 1}-${future.getDate()}`;
    if (holidays[fKey]) {
      parts.push(`Em ${offset} dia(s): ${holidays[fKey]}`);
    }
  }

  // Weekend context
  if (dayOfWeek === 6) parts.push("É SÁBADO! Dia de compras e lazer 🛒");
  if (dayOfWeek === 0) parts.push("É DOMINGO! Dia de descanso e presentes 🎁");
  if (dayOfWeek === 5) parts.push("É SEXTA-FEIRA! Fim de semana chegando 🎊");
  if (dayOfWeek === 1) parts.push("É SEGUNDA-FEIRA! Começando a semana com energia ⚡");

  // Month themes
  const monthThemes: Record<number, string> = {
    1: "Mês de recomeço e metas novas",
    2: "Mês do Carnaval 🎭",
    3: "Mês da Mulher 🌸",
    5: "Mês das Mães 💐",
    6: "Mês dos Namorados 💕 e Festas Juninas 🎉",
    8: "Mês dos Pais 👨",
    10: "Mês das Crianças 👧",
    11: "Mês da Black Friday 🛍️",
    12: "Mês do Natal e festas 🎄🎆",
  };
  if (monthThemes[month]) parts.push(`Contexto do mês: ${monthThemes[month]}`);

  return parts.length > 0 ? parts.join("\n") : "Dia comum, sem data especial";
}

async function generateAIMessage(apiKey: string, ctx: any): Promise<{ title: string; body: string } | null> {
  const dayNames = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
  const greetings = ctx.hour < 12 ? "Bom dia" : ctx.hour < 18 ? "Boa tarde" : "Boa noite";
  const dayName = dayNames[ctx.dayOfWeek] || "hoje";
  const seed = `${new Date().toISOString().slice(0, 10)}-${ctx.type}-${ctx.storeName}-${ctx.customerName || ""}`;
  const specialDate = getSpecialDateContext();

  let systemPrompt = "";
  let userPrompt = "";

  const dateInstructions = `
- CONTEXTO DE DATAS ESPECIAIS (USE para personalizar a mensagem!):
${specialDate}
- Se for feriado/data especial, INCORPORE na mensagem (ex: "Neste Natal...", "Aproveite a Black Friday...", "Feliz Sábado...")
- Se for fim de semana, use tom mais descontraído e convidativo
- Se for segunda-feira, use tom motivacional e energético`;

  if (ctx.type === "abandoned_cart") {
    systemPrompt = `Você é uma assistente de marketing MUITO criativa e educada da loja "${ctx.storeName}".
Gere uma notificação push ÚNICA para recuperar um carrinho abandonado. 

REGRAS OBRIGATÓRIAS:
- Responda APENAS com JSON: {"title": "...", "body": "..."}
- title: máximo 50 caracteres, comece com 1 emoji DIFERENTE a cada vez (use emojis variados como 🛍️ 💫 🌟 ✨ 💝 🎁 💜 🔥 🫶 💐 🌸 🎀 etc)
- body: máximo 130 caracteres, mencione o nome do cliente e o nome da loja "${ctx.storeName}"
- Use saudação adequada: "${greetings}" (é ${dayName})
- Tom: amigável, educado, gentil, sem pressão
- NUNCA repita a mesma mensagem. Use frases DIFERENTES a cada envio
- Seed de variação: ${seed}-${Math.random().toString(36).slice(2, 6)}
- Se for o 1º lembrete: tom suave. 2º: um pouco mais direto. 3º+: mencione que os itens podem acabar
${dateInstructions}`;

    userPrompt = `Cliente: ${ctx.customerName}
Loja: ${ctx.storeName}
Produtos: ${ctx.itemNames}
Valor: R$ ${ctx.totalValue}
Itens: ${ctx.itemCount}
Lembrete nº: ${(ctx.reminderCount || 0) + 1}
Dia: ${dayName}
Saudação: ${greetings}
Datas especiais: ${specialDate}`;

  } else if (ctx.type === "new_customer") {
    systemPrompt = `Você é uma assistente de marketing MUITO alegre e educada da loja "${ctx.storeName}".
Gere uma notificação push de BOAS-VINDAS para um novo cliente.

REGRAS OBRIGATÓRIAS:
- Responda APENAS com JSON: {"title": "...", "body": "..."}
- title: máximo 50 caracteres, comece com 1 emoji alegre e festivo (🎉 🥳 🎊 🌟 💫 ✨ 🫶 💜 🎀 🌸 etc)
- body: máximo 130 caracteres, MENCIONE O NOME DO CLIENTE e o nome da loja "${ctx.storeName}"
- Use saudação: "${greetings}" (é ${dayName})
- Tom: MUITO alegre, acolhedor, caloroso, faça o cliente se sentir especial
- NUNCA repita a mesma mensagem
- Seed de variação: ${seed}-${Math.random().toString(36).slice(2, 6)}
${dateInstructions}`;

    userPrompt = `Cliente: ${ctx.customerName}
Loja: ${ctx.storeName}
Dia: ${dayName}
Saudação: ${greetings}
Datas especiais: ${specialDate}`;

  } else if (ctx.type === "daily_promo") {
    systemPrompt = `Você é uma assistente de marketing criativa e animada da loja "${ctx.storeName}".
Gere uma notificação push PROMOCIONAL diária.

REGRAS OBRIGATÓRIAS:
- Responda APENAS com JSON: {"title": "...", "body": "..."}
- title: máximo 50 caracteres, comece com 1 emoji DIFERENTE todo dia (🔥 ✨ 💫 🌟 🎁 💜 🫶 🛍️ 🎀 💐 🌸 🌈 ☀️ etc)
- body: máximo 130 caracteres, MENCIONE O NOME DA LOJA "${ctx.storeName}"
- Use saudação: "${greetings}" (é ${dayName})
- Tom: animado, convidativo, positivo
- Crie uma mensagem que atraia o cliente para visitar a loja
- NUNCA repita a mesma mensagem de dias anteriores
- Seed de variação: ${seed}-${Math.random().toString(36).slice(2, 6)}
${dateInstructions}
- Se for data especial/feriado, FOQUE a mensagem nessa data (ex: "Presente de Natal na ${ctx.storeName}!", "Black Friday imperdível!")
- Se for sábado/domingo, foque em lazer e aproveitamento do fim de semana`;

    userPrompt = `Loja: ${ctx.storeName}
Dia: ${dayName}
Saudação: ${greetings}
Clientes com push: ${ctx.customerCount || "vários"}
Datas especiais: ${specialDate}`;
  }

  if (!systemPrompt) return null;

  const resp = await fetch("https://ai.lovable.dev/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-lite",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 150,
      temperature: 0.95,
    }),
  });

  if (!resp.ok) return null;

  const data = await resp.json();
  const content = data.choices?.[0]?.message?.content || "";
  const cleaned = content.replace(/```json\n?/g, "").replace(/```/g, "").trim();
  const parsed = JSON.parse(cleaned);

  if (parsed.title && parsed.body) return { title: parsed.title, body: parsed.body };
  return null;
}

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}