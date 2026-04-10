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

    let triggerType = "abandoned_cart";
    let manualStoreUserId: string | null = null;
    let requestBody: any = {};
    try {
      requestBody = await req.json();
      triggerType = requestBody.trigger_type || "abandoned_cart";
      manualStoreUserId = requestBody.store_user_id || null;
    } catch { /* no body = default */ }

    if (triggerType === "new_customer") {
      return await handleNewCustomer(supabase, supabaseUrl, lovableApiKey, manualStoreUserId);
    }
    if (triggerType === "daily_promo") {
      return await handleDailyPromo(supabase, supabaseUrl, lovableApiKey, manualStoreUserId);
    }
    if (triggerType === "review_thankyou") {
      return await handleReviewThankyou(supabase, supabaseUrl, lovableApiKey, requestBody);
    }
    if (triggerType === "new_product") {
      return await handleNewProduct(supabase, supabaseUrl, lovableApiKey, requestBody);
    }
    if (triggerType === "new_coupon") {
      return await handleNewCoupon(supabase, supabaseUrl, lovableApiKey, requestBody);
    }
    if (triggerType === "product_view") {
      return await handleProductView(supabase, supabaseUrl, lovableApiKey, requestBody);
    }
    if (triggerType === "product_view_10x") {
      return await handleProductView10x(supabase, supabaseUrl, lovableApiKey, requestBody);
    }

    // === ABANDONED CART RECOVERY ===
    // Fetch the store's abandoned_cart rule to get timing settings
    let ruleQuery = supabase
      .from("automation_rules")
      .select("user_id, wait_minutes, cooldown_minutes, max_sends_per_day, enabled, offer_discount, discount_code, discount_percentage")
      .eq("trigger_type", "abandoned_cart")
      .eq("enabled", true);

    if (manualStoreUserId) ruleQuery = ruleQuery.eq("user_id", manualStoreUserId);

    const { data: cartRules } = await ruleQuery;
    if (!cartRules || cartRules.length === 0) {
      return json({ processed: 0, message: "No abandoned_cart rules enabled" });
    }

    // Build a map of store settings
    const ruleMap = new Map(cartRules.map((r: any) => [r.user_id, r]));
    const storeIds = cartRules.map((r: any) => r.user_id);

    // Use shortest wait_minutes across stores for initial query, but filter per-store later
    const minWait = Math.min(...cartRules.map((r: any) => r.wait_minutes || 20));
    const cutoff = new Date(Date.now() - minWait * 60 * 1000).toISOString();

    let query = supabase
      .from("abandoned_carts")
      .select("*")
      .eq("recovered", false)
      .lt("abandoned_at", cutoff)
      .lt("reminder_sent_count", 5)
      .not("customer_id", "is", null)
      .in("user_id", storeIds);

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

    const storeUserIds = [...new Set(carts.map(c => c.user_id))];
    const storeMap = await getStoreMap(supabase, storeUserIds);

    // Check today's executions for dedup
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { data: todayExecs } = await supabase
      .from("automation_executions")
      .select("customer_id, message_text, sent_at")
      .eq("trigger_type", "abandoned_cart")
      .gte("sent_at", todayStart.toISOString())
      .in("user_id", storeIds);

    const todayMessages = new Set((todayExecs || []).map((e: any) => `${e.customer_id}:${e.message_text?.slice(0, 60)}`));
    const todayCountByCustomer = new Map<string, number>();
    (todayExecs || []).forEach((e: any) => {
      const cid = e.customer_id || "";
      todayCountByCustomer.set(cid, (todayCountByCustomer.get(cid) || 0) + 1);
    });

    let sent = 0;
    let skipped = 0;
    const dayOfWeek = new Date().getDay();
    const hour = new Date().getHours();

    for (const cart of carts) {
      try {
        const customer = customerMap.get(cart.customer_id);
        if (!customer?.store_user_id) { skipped++; continue; }

        const rule = ruleMap.get(cart.user_id);
        if (!rule) { skipped++; continue; }

        // Check per-store wait time
        const waitMs = (rule.wait_minutes || 20) * 60 * 1000;
        if (Date.now() - new Date(cart.abandoned_at).getTime() < waitMs) { skipped++; continue; }

        // Check cooldown
        const cooldownMs = (rule.cooldown_minutes || 60) * 60 * 1000;
        if (cart.last_reminder_at && (Date.now() - new Date(cart.last_reminder_at).getTime()) < cooldownMs) { skipped++; continue; }

        // Check max sends per day for this customer
        const maxSends = rule.max_sends_per_day || 5;
        const custTodayCount = todayCountByCustomer.get(cart.customer_id) || 0;
        if (custTodayCount >= maxSends) { skipped++; continue; }

        const store = storeMap.get(cart.user_id);
        const storeName = store?.store_name || "nossa loja";
        const items = Array.isArray(cart.items) ? cart.items : [];
        const itemNames = items.slice(0, 3).map((i: any) => i.name || "Produto").join(", ");
        const totalValue = cart.total || items.reduce((s: number, i: any) => s + ((i.price || 0) * (i.quantity || 1)), 0);

        // Discount context
        const discountCtx = rule.offer_discount && rule.discount_code
          ? { hasDiscount: true, code: rule.discount_code, percentage: rule.discount_percentage || 10 }
          : { hasDiscount: false, code: "", percentage: 0 };

        const abandonedCartFallbacks = [
          { title: "🛒 Seus itens estão te esperando!", body: `Olá ${customer.name}! Você deixou ${items.length} item(s) no carrinho na ${storeName}. Finalize sua compra!` },
          { title: "🛍️ Não esqueça seu carrinho!", body: `${customer.name}, temos novidades sobre os itens que você viu na ${storeName}.` },
          { title: "✨ Que tal finalizar seu pedido?", body: `Oi ${customer.name}! Os produtos na ${storeName} estão acabando. Garanta os seus!` },
          { title: "💖 Preparamos tudo com carinho", body: `Só falta você finalizar a compra na ${storeName}. Vamos nessa?` }
        ];
        const randomACFallback = abandonedCartFallbacks[Math.floor(Math.random() * abandonedCartFallbacks.length)];
        let title = randomACFallback.title;
        let body = randomACFallback.body;

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
              ...discountCtx,
            });
            if (aiMsg) {
              // Dedup: check if same message already sent today
              const dedupKey = `${cart.customer_id}:${aiMsg.title} — ${aiMsg.body}`.slice(0, 60 + cart.customer_id.length + 1);
              if (!todayMessages.has(dedupKey.slice(0, `${cart.customer_id}:`.length + 60))) {
                title = aiMsg.title;
                body = aiMsg.body;
              }
            }
          } catch (e) { console.error("AI error:", e); }
        }

        const pushResp = await fetch(`${supabaseUrl}/functions/v1/send-push-internal`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            target_user_id: customer.auth_user_id,
            customer_id: cart.customer_id,
            title, body,
            url: "/",
            type: "abandoned_cart",
            store_user_id: customer.store_user_id,
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

    const welcomeFallbacks = [
      { title: `🎉 Bem-vindo(a), ${customer.name}!`, body: `Que alegria ter você na ${storeName}! Confira nossas ofertas especiais.` },
      { title: `✨ Boas notícias na ${storeName}`, body: `Olá ${customer.name}! Obrigado por se cadastrar. Veja as novidades!` },
      { title: `🎁 Um presente de boas-vindas`, body: `Oi ${customer.name}! Explore a ${storeName} e descubra produtos incríveis.` },
      { title: `💜 Você agora faz parte da ${storeName}`, body: `Seja muito bem-vindo(a)! Temos ofertas exclusivas esperando por você.` }
    ];
    const randomWelcomeFallback = welcomeFallbacks[Math.floor(Math.random() * welcomeFallbacks.length)];
    let title = randomWelcomeFallback.title;
    let body = randomWelcomeFallback.body;

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

  const currentHourStart = new Date();
  currentHourStart.setMinutes(0, 0, 0);

  let totalSent = 0;

  for (const sid of storeIds) {
    const { data: hourExecs } = await supabase
      .from("automation_executions")
      .select("id")
      .eq("user_id", sid)
      .eq("trigger_type", "daily_promo")
      .gte("sent_at", currentHourStart.toISOString())
      .limit(1);

    if (hourExecs && hourExecs.length > 0) continue;

    const store = storeMap.get(sid);
    const storeName = store?.store_name || "Loja";

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
    let body = `Temos ofertas incríveis preparadas para você hoje na ${storeName}. Venha conferir!`;

    const fallbackMessages = [
      { title: `🎁 Presente para você na ${storeName}`, body: `Preparamos uma seleção exclusiva de produtos que você vai amar. Confira!` },
      { title: `✨ Brilhe com a ${storeName}`, body: `Novidades fresquinhas acabaram de chegar. Não perca as ofertas de hoje!` },
      { title: `🛍️ Sua sacola te espera`, body: `Que tal dar uma olhadinha no que temos de novo na ${storeName} hoje?` },
      { title: `🔥 Tendências na ${storeName}`, body: `Veja o que está fazendo sucesso na nossa loja agora mesmo!` }
    ];
    
    const randomFallback = fallbackMessages[Math.floor(Math.random() * fallbackMessages.length)];
    title = randomFallback.title;
    body = randomFallback.body;

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

// === REVIEW THANKYOU ===
async function handleReviewThankyou(supabase: any, supabaseUrl: string, lovableApiKey: string | undefined, body: any) {
  const { store_user_id, customer_name, rating, comment, product_id } = body;
  if (!store_user_id || !customer_name || !rating) {
    return json({ error: "Missing required fields" }, 400);
  }

  const { data: customers } = await supabase
    .from("customers")
    .select("id, auth_user_id, name")
    .eq("store_user_id", store_user_id)
    .ilike("name", customer_name);

  const customer = customers?.[0];
  if (!customer?.auth_user_id) {
    return json({ processed: 0, message: "Customer not found or no auth_user_id" });
  }

  const storeMap = await getStoreMap(supabase, [store_user_id]);
  const store = storeMap.get(store_user_id);
  const storeName = store?.store_name || "nossa loja";

  const { data: product } = await supabase
    .from("products").select("name").eq("id", product_id).single();
  const productName = product?.name || "produto";

  const isGoodReview = rating >= 4;
  const dayNames = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
  const hour = new Date().getHours();
  const greetings = hour < 6 ? "Boa madrugada" : hour < 18 ? "Bom dia" : "Boa noite";
  const dayName = dayNames[new Date().getDay()];

  let title = "";
  let msgBody = "";

  if (isGoodReview) {
    title = `💛 Obrigado pela avaliação, ${customer_name}!`;
    msgBody = `${greetings}! Ficamos felizes com sua avaliação de "${productName}" na ${storeName}. Volte sempre! 🛍️`;
  } else {
    title = `🙏 Agradecemos seu feedback, ${customer_name}`;
    msgBody = `${greetings}! Recebemos sua avaliação de "${productName}" na ${storeName}. Vamos melhorar! Obrigado pela sinceridade. 💜`;
  }

  if (lovableApiKey) {
    try {
      const specialDate = getSpecialDateContext();
      const seed = `${new Date().toISOString().slice(0, 10)}-review-${storeName}-${customer_name}`;

      const systemPrompt = isGoodReview
        ? `Você é uma assistente MUITO educada e grata da loja "${storeName}".
O cliente "${customer_name}" deixou uma avaliação POSITIVA (${rating}/5 estrelas) sobre o produto "${productName}".
${comment ? `Comentário: "${comment}"` : ""}

REGRAS:
- Responda APENAS com JSON: {"title": "...", "body": "..."}
- title: máximo 50 caracteres, comece com emoji de gratidão (💛 🙏 ⭐ 🌟 ✨ 💜 🫶 etc)
- body: máximo 130 caracteres, AGRADEÇA pelo nome, mencione o produto e a loja "${storeName}"
- Tom: MUITO grato, carinhoso, incentive o cliente a comprar mais
- Mencione a saudação: "${greetings}" (é ${dayName})
- ${specialDate}
- Seed: ${seed}-${Math.random().toString(36).slice(2, 6)}`
        : `Você é uma assistente MUITO educada e empática da loja "${storeName}".
O cliente "${customer_name}" deixou uma avaliação NEGATIVA (${rating}/5 estrelas) sobre o produto "${productName}".
${comment ? `Comentário: "${comment}"` : ""}

REGRAS:
- Responda APENAS com JSON: {"title": "...", "body": "..."}
- title: máximo 50 caracteres, comece com emoji empático (🙏 💜 🫶 💙 etc)
- body: máximo 130 caracteres, PEÇA DESCULPAS pelo nome, diga que vai melhorar, mencione a loja "${storeName}"
- Tom: empático, humilde, sincero, mostre que se importa
- NUNCA seja defensivo ou culpe o cliente
- Mencione a saudação: "${greetings}" (é ${dayName})
- ${specialDate}
- Seed: ${seed}-${Math.random().toString(36).slice(2, 6)}`;

      const aiMsg = await generateAIMessage(lovableApiKey, {
        type: "review_thankyou",
        _customSystemPrompt: systemPrompt,
        _customUserPrompt: `Cliente: ${customer_name}\nProduto: ${productName}\nEstrelas: ${rating}/5\nComentário: ${comment || "nenhum"}\nLoja: ${storeName}\nDia: ${dayName}\nSaudação: ${greetings}`,
      });
      if (aiMsg) { title = aiMsg.title; msgBody = aiMsg.body; }
    } catch (e) { console.error("AI review error:", e); }
  }

  try {
    const pushResp = await fetch(`${supabaseUrl}/functions/v1/send-push-internal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        target_user_id: customer.auth_user_id,
        title,
        body: msgBody,
        url: "/",
        type: "review_thankyou",
      }),
    });
    const pushData = await pushResp.json();

    await supabase.from("automation_executions").insert({
      user_id: store_user_id,
      customer_id: customer.id,
      trigger_type: "review_thankyou",
      channel: "push",
      message_text: `${title} — ${msgBody}`,
      ai_generated: !!lovableApiKey,
      status: pushData.sent > 0 ? "sent" : "failed",
      error_message: pushData.sent > 0 ? null : JSON.stringify(pushData).slice(0, 200),
    });

    return json({ processed: 1, sent: pushData.sent > 0 ? 1 : 0 });
  } catch (e: any) {
    console.error("Review push error:", e);
    return json({ processed: 1, sent: 0, error: e.message });
  }
}

// === NEW PRODUCT PUSH ===
async function handleNewProduct(supabase: any, supabaseUrl: string, lovableApiKey: string | undefined, body: any) {
  const { store_user_id, product_id, product_name, product_price } = body;
  if (!store_user_id || !product_id) {
    return json({ error: "Missing store_user_id or product_id" }, 400);
  }

  // Check if rule enabled for this store
  const { data: rule } = await supabase
    .from("automation_rules")
    .select("enabled")
    .eq("user_id", store_user_id)
    .eq("trigger_type", "new_product")
    .eq("enabled", true)
    .limit(1)
    .maybeSingle();

  // If no rule or disabled, still send (default behavior from trigger)
  // But check dedup - don't send for same product twice
  const { data: existingExec } = await supabase
    .from("automation_executions")
    .select("id")
    .eq("user_id", store_user_id)
    .eq("trigger_type", "new_product")
    .ilike("message_text", `%${product_name?.slice(0, 30)}%`)
    .limit(1);

  if (existingExec && existingExec.length > 0) {
    return json({ processed: 0, message: "Already sent for this product" });
  }

  const storeMap = await getStoreMap(supabase, [store_user_id]);
  const store = storeMap.get(store_user_id);
  const storeName = store?.store_name || "nossa loja";

  // Get customers with push
  const { data: customers } = await supabase
    .from("customers")
    .select("id, name, auth_user_id")
    .eq("store_user_id", store_user_id);

  if (!customers || customers.length === 0) {
    return json({ processed: 0, message: "No customers" });
  }

  const customerUserIds = customers.map((c: any) => c.auth_user_id).filter(Boolean);
  if (customerUserIds.length === 0) return json({ processed: 0, message: "No customer auth ids" });

  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("user_id")
    .in("user_id", customerUserIds);

  const pushUserIds = [...new Set((subs || []).map((s: any) => s.user_id))];
  if (pushUserIds.length === 0) return json({ processed: 0, message: "No push subscriptions" });

  const dayOfWeek = new Date().getDay();
  const hour = new Date().getHours();
  const priceFormatted = product_price ? `R$ ${Number(product_price).toFixed(2)}` : "";

  let title = `🆕 Novidade na ${storeName}!`;
  let msgBody = `Acabou de chegar: ${product_name || "novo produto"}${priceFormatted ? ` por ${priceFormatted}` : ""}. Confira! 🛍️`;

  if (lovableApiKey) {
    try {
      const aiMsg = await generateAIMessage(lovableApiKey, {
        type: "new_product",
        storeName,
        productName: product_name || "novo produto",
        productPrice: priceFormatted,
        dayOfWeek,
        hour,
      });
      if (aiMsg) { title = aiMsg.title; msgBody = aiMsg.body; }
    } catch (e) { console.error("AI new product error:", e); }
  }

  let sent = 0;
  for (const uid of pushUserIds) {
    try {
      const resp = await fetch(`${supabaseUrl}/functions/v1/send-push-internal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_user_id: uid, title, body: msgBody, url: "/", type: "new_product",
        }),
      });
      const data = await resp.json();
      if (data.sent > 0) sent++;
    } catch (e) { console.error("New product push error:", e); }
  }

  await supabase.from("automation_executions").insert({
    user_id: store_user_id,
    trigger_type: "new_product",
    channel: "push",
    message_text: `${title} — ${msgBody}`,
    ai_generated: !!lovableApiKey,
    status: sent > 0 ? "sent" : "failed",
  });

  return json({ processed: pushUserIds.length, sent });
}

// === NEW COUPON PUSH ===
async function handleNewCoupon(supabase: any, supabaseUrl: string, lovableApiKey: string | undefined, body: any) {
  const { store_user_id, coupon_code, discount_type, discount_value } = body;
  if (!store_user_id || !coupon_code) {
    return json({ error: "Missing store_user_id or coupon_code" }, 400);
  }

  // Dedup
  const { data: existingExec } = await supabase
    .from("automation_executions")
    .select("id")
    .eq("user_id", store_user_id)
    .eq("trigger_type", "new_coupon")
    .ilike("message_text", `%${coupon_code}%`)
    .limit(1);

  if (existingExec && existingExec.length > 0) {
    return json({ processed: 0, message: "Already sent for this coupon" });
  }

  const storeMap = await getStoreMap(supabase, [store_user_id]);
  const store = storeMap.get(store_user_id);
  const storeName = store?.store_name || "nossa loja";

  const { data: customers } = await supabase
    .from("customers")
    .select("id, name, auth_user_id")
    .eq("store_user_id", store_user_id);

  if (!customers || customers.length === 0) {
    return json({ processed: 0, message: "No customers" });
  }

  const customerUserIds = customers.map((c: any) => c.auth_user_id).filter(Boolean);
  if (customerUserIds.length === 0) return json({ processed: 0, message: "No customer auth ids" });

  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("user_id")
    .in("user_id", customerUserIds);

  const pushUserIds = [...new Set((subs || []).map((s: any) => s.user_id))];
  if (pushUserIds.length === 0) return json({ processed: 0, message: "No push subscriptions" });

  const discountText = discount_type === "percentage" 
    ? `${discount_value}% de desconto` 
    : `R$ ${Number(discount_value).toFixed(2)} de desconto`;

  let title = `🎟️ Cupom novo na ${storeName}!`;
  let msgBody = `Use o cupom ${coupon_code} e ganhe ${discountText}! Aproveite! 🛍️`;

  if (lovableApiKey) {
    try {
      const dayOfWeek = new Date().getDay();
      const hour = new Date().getHours();
      const aiMsg = await generateAIMessage(lovableApiKey, {
        type: "new_coupon",
        storeName,
        couponCode: coupon_code,
        discountText,
        dayOfWeek,
        hour,
      });
      if (aiMsg) { title = aiMsg.title; msgBody = aiMsg.body; }
    } catch (e) { console.error("AI new coupon error:", e); }
  }

  let sent = 0;
  for (const uid of pushUserIds) {
    try {
      const resp = await fetch(`${supabaseUrl}/functions/v1/send-push-internal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_user_id: uid, title, body: msgBody, url: "/", type: "new_coupon",
        }),
      });
      const data = await resp.json();
      if (data.sent > 0) sent++;
    } catch (e) { console.error("New coupon push error:", e); }
  }

  await supabase.from("automation_executions").insert({
    user_id: store_user_id,
    trigger_type: "new_coupon",
    channel: "push",
    message_text: `${title} — ${msgBody}`,
    ai_generated: !!lovableApiKey,
    status: sent > 0 ? "sent" : "failed",
  });

  return json({ processed: pushUserIds.length, sent });
}

// === PRODUCT VIEW RECOVERY ===
async function handleProductView(supabase: any, supabaseUrl: string, lovableApiKey: string | undefined, body: any) {
  const { store_user_id, customer_id, product_id } = body;
  if (!store_user_id || !customer_id) return json({ error: "Missing store_user_id or customer_id" }, 400);

  // Check if rule enabled
  const { data: rule } = await supabase
    .from("automation_rules")
    .select("enabled")
    .eq("user_id", store_user_id)
    .eq("trigger_type", "product_view")
    .eq("enabled", true)
    .maybeSingle();

  // If no rule or disabled, we still send if it was manually triggered or as a default behavior
  // But check cooldown to avoid spamming
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const { data: existingExec } = await supabase
    .from("automation_executions")
    .select("id")
    .eq("customer_id", customer_id)
    .eq("trigger_type", "product_view")
    .gte("sent_at", todayStart.toISOString())
    .limit(1);

  if (existingExec && existingExec.length > 0) {
    return json({ processed: 0, message: "Already sent for this product view today" });
  }

  const { data: customer } = await supabase
    .from("customers")
    .select("id, name, auth_user_id")
    .eq("id", customer_id)
    .single();

  if (!customer) return json({ processed: 0, message: "Customer not found" });

  const { data: product } = await supabase
    .from("products")
    .select("name, price")
    .eq("id", product_id)
    .single();

  const storeMap = await getStoreMap(supabase, [store_user_id]);
  const storeName = storeMap.get(store_user_id)?.store_name || "nossa loja";
  const productName = product?.name || "um produto";

  const productViewFallbacks = [
    { title: `👀 Você deu uma olhadinha...`, body: `Oi ${customer.name}! Notamos que você gostou de "${productName}" na ${storeName}. Aproveite para garantir o seu!` },
    { title: `✨ O que achou do item?`, body: `${customer.name}, vimos seu interesse em "${productName}" na ${storeName}. Ainda temos em estoque!` },
    { title: `💖 Uma escolha excelente!`, body: `Oi ${customer.name}, o produto "${productName}" combina muito com você. Que tal levar para casa?` },
    { title: `🎁 Temos novidades pra você`, body: `Notamos que você viu "${productName}" na ${storeName}. Confira se ainda temos sua numeração/cor!` }
  ];
  const randomPVFallback = productViewFallbacks[Math.floor(Math.random() * productViewFallbacks.length)];
  let title = randomPVFallback.title;
  let msgBody = randomPVFallback.body;

  if (lovableApiKey) {
    try {
      const aiMsg = await generateAIMessage(lovableApiKey, {
        type: "product_view",
        customerName: customer.name,
        storeName,
        productName,
        dayOfWeek: new Date().getDay(),
        hour: new Date().getHours(),
      });
      if (aiMsg) { title = aiMsg.title; msgBody = aiMsg.body; }
    } catch (e) { console.error("AI product view error:", e); }
  }

  const pushResp = await fetch(`${supabaseUrl}/functions/v1/send-push-internal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      target_user_id: customer.auth_user_id,
      customer_id: customer_id,
      title, body: msgBody,
      url: "/",
      type: "product_view",
      store_user_id: store_user_id,
    }),
  });
  const pushData = await pushResp.json();

  await supabase.from("automation_executions").insert({
    user_id: store_user_id,
    customer_id: customer_id,
    trigger_type: "product_view",
    channel: "push",
    message_text: `${title} — ${msgBody}`,
    ai_generated: !!lovableApiKey,
    status: pushData.sent > 0 ? "sent" : "failed",
  });

  return json({ processed: 1, sent: pushData.sent > 0 ? 1 : 0 });
}

// === HELPERS ===

async function getStoreMap(supabase: any, storeUserIds: string[]) {
  const { data: stores } = await supabase
    .from("store_settings")
    .select("user_id, store_name, store_slug, store_category")
    .in("user_id", storeUserIds);
  return new Map((stores || []).map((s: any) => {
    // Use store_name if set, otherwise derive from slug (capitalize first letter)
    const slug = s.store_slug || "";
    const nameFromSlug = slug ? slug.charAt(0).toUpperCase() + slug.slice(1) : "";
    const resolvedName = s.store_name?.trim() || nameFromSlug || "nossa loja";
    return [s.user_id, { ...s, store_name: resolvedName, category: s.store_category }];
  }));
}

function getSpecialDateContext(): string {
  const now = new Date();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const dayOfWeek = now.getDay();
  const parts: string[] = [];

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

  const key = `${month}-${day}`;
  if (holidays[key]) parts.push(`HOJE É ${holidays[key]}`);

  for (let offset = 1; offset <= 3; offset++) {
    const future = new Date(now.getTime() + offset * 86400000);
    const fKey = `${future.getMonth() + 1}-${future.getDate()}`;
    if (holidays[fKey]) parts.push(`Em ${offset} dia(s): ${holidays[fKey]}`);
  }

  if (dayOfWeek === 6) parts.push("É SÁBADO! Dia de compras e lazer 🛒");
  if (dayOfWeek === 0) parts.push("É DOMINGO! Dia de descanso e presentes 🎁");
  if (dayOfWeek === 5) parts.push("É SEXTA-FEIRA! Fim de semana chegando 🎊");
  if (dayOfWeek === 1) parts.push("É SEGUNDA-FEIRA! Começando a semana com energia ⚡");

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
  const seed = `${new Date().toISOString().slice(0, 10)}-${ctx.type}-${ctx.storeName}-${ctx.customerName || ""}-${Date.now()}`;
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
    const discountLine = ctx.hasDiscount
      ? `\n- INCLUA O CUPOM DE DESCONTO "${ctx.code}" (${ctx.percentage}% OFF) na mensagem! Exemplo: "Use o cupom ${ctx.code} e ganhe ${ctx.percentage}% de desconto!"`
      : "";

    systemPrompt = `Você é uma assistente de marketing MUITO criativa e educada da loja "${ctx.storeName}".
Gere uma notificação push ÚNICA para recuperar um carrinho abandonado. 

REGRAS OBRIGATÓRIAS:
- Responda APENAS com JSON: {"title": "...", "body": "..."}
- title: máximo 50 caracteres, comece com 1 emoji DIFERENTE a cada vez (use emojis variados como 🛍️ 💫 🌟 ✨ 💝 🎁 💜 🔥 🫶 💐 🌸 🎀 etc)
- body: máximo 130 caracteres, mencione o nome do cliente e o nome da loja "${ctx.storeName}"
- Use saudação adequada: "${greetings}" (é ${dayName})
- Tom: amigável, educado, gentil, sem pressão
- NUNCA repita a mesma mensagem. Use frases COMPLETAMENTE DIFERENTES a cada envio
- Seed de variação (use para criar mensagem única): ${seed}
- Se for o 1º lembrete: tom suave. 2º: um pouco mais direto. 3º+: mencione que os itens podem acabar${discountLine}
${dateInstructions}`;

    userPrompt = `Cliente: ${ctx.customerName}
Loja: ${ctx.storeName}
Produtos: ${ctx.itemNames}
Valor: R$ ${ctx.totalValue}
Itens: ${ctx.itemCount}
Lembrete nº: ${(ctx.reminderCount || 0) + 1}
Dia: ${dayName}
Saudação: ${greetings}
Datas especiais: ${specialDate}
${ctx.hasDiscount ? `CUPOM: ${ctx.code} (${ctx.percentage}% OFF)` : "Sem desconto"}`;

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
- Seed de variação: ${seed}
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
- Seed de variação: ${seed}
${dateInstructions}
- Se for data especial/feriado, FOQUE a mensagem nessa data (ex: "Presente de Natal na ${ctx.storeName}!", "Black Friday imperdível!")
- Se for sábado/domingo, foque em lazer e aproveitamento do fim de semana`;

    userPrompt = `Loja: ${ctx.storeName}
Dia: ${dayName}
Saudação: ${greetings}
Clientes com push: ${ctx.customerCount || "vários"}
Datas especiais: ${specialDate}`;

  } else if (ctx.type === "new_product") {
    systemPrompt = `Você é uma assistente de marketing EMPOLGADA da loja "${ctx.storeName}".
Um NOVO PRODUTO acabou de ser adicionado à loja!

REGRAS OBRIGATÓRIAS:
- Responda APENAS com JSON: {"title": "...", "body": "..."}
- title: máximo 50 caracteres, comece com 1 emoji de novidade (🆕 ✨ 🔥 🎁 💎 🌟 🛍️ etc)
- body: máximo 130 caracteres, MENCIONE o nome do produto e da loja "${ctx.storeName}"
- ${ctx.productPrice ? `Mencione o preço: ${ctx.productPrice}` : ""}
- Use saudação: "${greetings}" (é ${dayName})
- Tom: empolgado, convidativo, crie FOMO (medo de ficar sem)
- NUNCA repita a mesma mensagem
- Seed: ${seed}
${dateInstructions}`;

    userPrompt = `Loja: ${ctx.storeName}
    Produto: ${ctx.productName}
    Preço: ${ctx.productPrice || "não informado"}
    Dia: ${dayName}
    Saudação: ${greetings}`;

  } else if (ctx.type === "product_view") {
    systemPrompt = `Você é uma assistente de marketing MUITO atenta e gentil da loja "${ctx.storeName}".
Gere uma notificação push para um cliente que visualizou um produto.

REGRAS OBRIGATÓRIAS:
- Responda APENAS com JSON: {"title": "...", "body": "..."}
- title: máximo 50 caracteres, comece com 1 emoji de atenção (👀 ✨ 🛍️ 💫 💝 etc)
- body: máximo 130 caracteres, mencione o nome do cliente, o produto e a loja "${ctx.storeName}"
- Tom: amigável, sutil, convidativo, sem ser invasivo
- Use saudação: "${greetings}" (é ${dayName})
- Seed: ${seed}
${dateInstructions}`;

    userPrompt = `Cliente: ${ctx.customerName}
Produto: ${ctx.productName}
Loja: ${ctx.storeName}
Dia: ${dayName}
Saudação: ${greetings}`;

  } else if (ctx.type === "review_thankyou" && ctx._customSystemPrompt) {
    systemPrompt = ctx._customSystemPrompt;
    userPrompt = ctx._customUserPrompt || "";

  } else if (ctx.type === "new_coupon") {
    systemPrompt = `Você é uma assistente de marketing ANIMADA da loja "${ctx.storeName}".
Um NOVO CUPOM de desconto foi criado!

REGRAS OBRIGATÓRIAS:
- Responda APENAS com JSON: {"title": "...", "body": "..."}
- title: máximo 50 caracteres, comece com 1 emoji de desconto (🎟️ 🏷️ 💰 🔥 ✨ 🎁 💸 etc)
- body: máximo 130 caracteres, MENCIONE o código do cupom "${ctx.couponCode}" e o desconto "${ctx.discountText}" e a loja "${ctx.storeName}"
- Use saudação: "${greetings}" (é ${dayName})
- Tom: empolgado, urgente, convidativo, crie senso de oportunidade
- NUNCA repita a mesma mensagem
- Seed: ${seed}
${dateInstructions}`;

    userPrompt = `Loja: ${ctx.storeName}
Cupom: ${ctx.couponCode}
Desconto: ${ctx.discountText}
Dia: ${dayName}
Saudação: ${greetings}`;
  }

  if (!systemPrompt) return null;

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
