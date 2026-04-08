import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_PUSH_PER_DAY = 3;
const MIN_INTERVAL_MINUTES = 30;

// Step delays for multi-step retargeting sequences
const STEP_CONFIG: Record<number, { delayRange: [number, number]; tone: string }> = {
  1: { delayRange: [15, 30], tone: "soft" },
  2: { delayRange: [60, 180], tone: "urgent" },
  3: { delayRange: [360, 720], tone: "aggressive" },
};

// Randomized delay ranges for behavior-based pushes
const TRIGGER_DELAYS: Record<string, { min: number; max: number }> = {
  abandoned_cart: { min: 20, max: 45 },
  browsing: { min: 12, max: 50 },
  browsing_exit: { min: 15, max: 30 },
  inactive: { min: 90, max: 420 },
};

function randomDelayInRange(min: number, max: number, seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  const ratio = (Math.abs(hash) % 1000) / 1000;
  return min + ratio * (max - min);
}

// ── Templates ───────────────────────────────────────────────────────
const TEMPLATES: Record<string, { title: string; body: string }[]> = {
  abandoned_cart: [
    { title: "🛒 Seu carrinho está te esperando!", body: "{greetings}, {name}! Seus itens na {store} estão quase esgotando." },
    { title: "⏳ Não perca seus itens!", body: "{name}, finalize sua compra na {store} antes que acabe!" },
    { title: "🔥 Última chance!", body: "Os produtos no seu carrinho da {store} podem sair do estoque, {name}!" },
    { title: "💛 Esqueceu de algo?", body: "{greetings}, {name}! Volte e finalize na {store}." },
    { title: "🛍️ Falta pouco!", body: "{name}, seu carrinho na {store} está pronto. Só falta confirmar!" },
    { title: "⚡ Corre que dá tempo!", body: "{greetings}! {name}, seus produtos na {store} ainda estão lá." },
    { title: "🎯 Seus favoritos esperam", body: "{name}, os itens que você escolheu na {store} continuam disponíveis!" },
    { title: "💸 Feche o pedido!", body: "{greetings}, {name}! Não deixe escapar da {store}." },
    { title: "🚀 Finalize agora!", body: "{name}, aproveite enquanto seus itens da {store} ainda estão no carrinho." },
    { title: "🔔 Lembrete amigável", body: "{greetings}, {name}! Seu carrinho da {store} quer atenção." },
  ],
  browsing: [
    { title: "👀 Vimos você olhando!", body: "{greetings}, {name}! Encontrou algo na {store}? Volte e confira!" },
    { title: "🔍 Achou algo legal?", body: "{name}, a {store} tem novidades esperando por você!" },
    { title: "✨ Novidades pra você!", body: "{greetings}! {name}, confira o que há de novo na {store}." },
    { title: "🌟 Destaque do dia!", body: "{name}, a {store} separou produtos especiais. Dê uma olhada!" },
    { title: "🎯 Produtos pra você!", body: "{greetings}, {name}! A {store} tem sugestões baseadas no seu gosto." },
    { title: "💡 Inspiração!", body: "{name}, volte à {store} e descubra tendências incríveis!" },
    { title: "🔥 Produtos quentes!", body: "{greetings}! {name}, veja o que está bombando na {store}." },
    { title: "🛍️ Hora de comprar!", body: "{name}, a {store} tem ofertas imperdíveis agora." },
  ],
  browsing_exit: [
    { title: "👀 Ainda pensando?", body: "{greetings}, {name}! Vimos que você saiu da {store}. Volte e confira!" },
    { title: "🔍 Encontrou o que queria?", body: "{name}, a {store} ainda tem aqueles itens que você viu!" },
    { title: "✨ Não vá sem conferir!", body: "{greetings}! {name}, os produtos que viu na {store} esperam por você." },
    { title: "💭 Pensando no assunto?", body: "{name}, seus favoritos da {store} continuam disponíveis!" },
    { title: "🛍️ Voltou a tempo!", body: "{greetings}, {name}! Os itens que navegou na {store} ainda estão lá." },
    { title: "🌟 Sem pressa, mas...", body: "{name}, os produtos que viu na {store} estão saindo rápido!" },
  ],
  inactive: [
    { title: "💜 Sentimos sua falta!", body: "{greetings}, {name}! Faz tempo que não passa na {store}. Novidades te esperam!" },
    { title: "🌟 Voltou? Que bom!", body: "{name}, a {store} tem novidades desde sua última visita!" },
    { title: "😊 Oi, sumido!", body: "{greetings}! {name}, a {store} sente sua falta. Venha conferir!" },
    { title: "🎁 Presente de volta!", body: "{name}, a {store} preparou algo especial pra sua volta!" },
    { title: "💕 Saudades de você!", body: "{greetings}, {name}! A {store} tem novidades incríveis." },
    { title: "🔔 Temos novidades!", body: "{name}, muita coisa nova na {store} desde sua última visita!" },
  ],
};

// Product-aware templates by tone
const PRODUCT_TEMPLATES: Record<string, { title: string; body: string }[]> = {
  soft: [
    { title: "👀 Ainda pensando no \"{product}\"?", body: "{greetings}, {name}! O \"{product}\" da {store} combina com você!" },
    { title: "✨ \"{product}\" te esperando!", body: "{name}, volte e garanta o \"{product}\" na {store}!" },
    { title: "💜 Gostou do \"{product}\"?", body: "{name}, o \"{product}\" da {store} está disponível. Aproveite!" },
    { title: "🛍️ Seu item está lá!", body: "{greetings}! {name}, o \"{product}\" continua na {store}." },
    { title: "💭 Pensando no \"{product}\"?", body: "{name}, reserve o \"{product}\" antes que saia da {store}!" },
  ],
  urgent: [
    { title: "🔥 \"{product}\" quase esgotando!", body: "{greetings}! {name}, corre que o \"{product}\" está acabando na {store}!" },
    { title: "⏳ Últimas unidades do \"{product}\"!", body: "{name}, o \"{product}\" da {store} tem poucas unidades!" },
    { title: "⚡ Não perca o \"{product}\"!", body: "{greetings}, {name}! O \"{product}\" pode sair do estoque da {store}!" },
    { title: "🚨 Estoque baixo: \"{product}\"", body: "{name}, o \"{product}\" está com estoque limitado na {store}!" },
    { title: "💨 \"{product}\" voando!", body: "{greetings}! {name}, o \"{product}\" está vendendo rápido na {store}!" },
  ],
  aggressive: [
    { title: "🔥 ÚLTIMA CHANCE: \"{product}\"!", body: "{name}, AGORA ou NUNCA! O \"{product}\" está quase esgotado na {store}!" },
    { title: "😱 POUQUÍSSIMAS UNIDADES!", body: "{greetings}! {name}, CORRA! O \"{product}\" da {store} pode acabar!" },
    { title: "⚡ VAI PERDER? \"{product}\"", body: "{name}, o \"{product}\" da {store} não vai esperar! GARANTA JÁ!" },
    { title: "🚀 CORRA AGORA!", body: "{greetings}, {name}! O \"{product}\" da {store} está nas últimas unidades!" },
    { title: "💥 ALERTA: \"{product}\"!", body: "{name}, última oportunidade de garantir o \"{product}\" na {store}!" },
  ],
  // Low stock urgency (triggered by stock level)
  low_stock: [
    { title: "🚨 \"{product}\" — QUASE ESGOTADO!", body: "{name}, restam pouquíssimas unidades do \"{product}\" na {store}!" },
    { title: "⚡ ÚLTIMAS UNIDADES: \"{product}\"!", body: "{greetings}! {name}, o \"{product}\" está acabando NA {store}!" },
    { title: "😱 SÓ RESTAM POUCAS!", body: "{name}, o \"{product}\" da {store} pode acabar a qualquer momento!" },
  ],
  // Discount highlight templates
  discount: [
    { title: "🏷️ DESCONTO no \"{product}\"!", body: "{greetings}, {name}! O \"{product}\" está com desconto especial na {store}! Aproveite!" },
    { title: "💰 OFERTA: \"{product}\"!", body: "{name}, o \"{product}\" da {store} está em promoção! Corra antes que acabe!" },
    { title: "🎁 PROMOÇÃO: \"{product}\"!", body: "{greetings}! {name}, desconto imperdível no \"{product}\" da {store}!" },
  ],
  // Generic product for states
  abandoned_cart: [
    { title: "🛒 \"{product}\" espera por você!", body: "{greetings}, {name}! O \"{product}\" ainda está no seu carrinho na {store}." },
    { title: "⏳ Ainda pensando no \"{product}\"?", body: "{name}, garanta o \"{product}\" antes que acabe na {store}!" },
    { title: "🔥 \"{product}\" quase esgotando!", body: "{greetings}! {name}, corre que o \"{product}\" está acabando na {store}!" },
  ],
  browsing: [
    { title: "👀 Curtiu o \"{product}\"?", body: "{greetings}, {name}! O \"{product}\" da {store} combina com você!" },
    { title: "✨ \"{product}\" te esperando!", body: "{name}, volte e garanta o \"{product}\" na {store}!" },
    { title: "🔥 \"{product}\" é tendência!", body: "{greetings}! {name}, o \"{product}\" está bombando na {store}." },
  ],
  browsing_exit: [
    { title: "👀 Curtiu o \"{product}\"?", body: "{greetings}, {name}! O \"{product}\" da {store} ainda espera por você!" },
    { title: "💭 Pensando no \"{product}\"?", body: "{name}, o \"{product}\" da {store} continua disponível!" },
    { title: "🌟 \"{product}\" combina com você!", body: "{greetings}! {name}, que tal levar o \"{product}\" da {store}?" },
  ],
  inactive: [
    { title: "💜 Lembra do \"{product}\"?", body: "{greetings}, {name}! O \"{product}\" da {store} ainda espera por você." },
    { title: "🌟 \"{product}\" com novidades!", body: "{name}, o \"{product}\" que você viu na {store} pode ter preço novo!" },
    { title: "🔔 \"{product}\" disponível!", body: "{greetings}! {name}, o \"{product}\" da {store} está te chamando." },
  ],
};

function pickTemplate(
  state: string,
  hasProduct: boolean,
  opts?: { tone?: string; lowStock?: boolean; discount?: boolean }
): { title: string; body: string } {
  // Priority: low_stock > discount > tone > state product > state generic
  if (hasProduct && opts?.lowStock && PRODUCT_TEMPLATES.low_stock?.length) {
    const pool = PRODUCT_TEMPLATES.low_stock;
    return pool[Math.floor(Math.random() * pool.length)];
  }
  if (hasProduct && opts?.discount && PRODUCT_TEMPLATES.discount?.length && Math.random() < 0.5) {
    const pool = PRODUCT_TEMPLATES.discount;
    return pool[Math.floor(Math.random() * pool.length)];
  }
  if (hasProduct && opts?.tone && PRODUCT_TEMPLATES[opts.tone]?.length) {
    const pool = PRODUCT_TEMPLATES[opts.tone];
    return pool[Math.floor(Math.random() * pool.length)];
  }
  if (hasProduct && PRODUCT_TEMPLATES[state]?.length && Math.random() < 0.7) {
    const pool = PRODUCT_TEMPLATES[state];
    return pool[Math.floor(Math.random() * pool.length)];
  }
  const pool = TEMPLATES[state];
  if (!pool || pool.length === 0) return { title: "🔔 Novidade!", body: "Confira as novidades da loja!" };
  return pool[Math.floor(Math.random() * pool.length)];
}

function fillTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] || "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const hour = now.getHours();
    const greetings = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

    // ═══════════════════════════════════════════════════════════════════
    // PART 1: Multi-step retargeting sequences
    // ═══════════════════════════════════════════════════════════════════
    const { data: activeSequences } = await supabase
      .from("retargeting_sequences")
      .select("*")
      .eq("status", "active")
      .lte("next_push_at", now.toISOString())
      .limit(200);

    let retargetingSent = 0;
    let retargetingSkipped = 0;

    if (activeSequences && activeSequences.length > 0) {
      const seqCustomerIds = [...new Set(activeSequences.map((s: any) => s.customer_id))];
      const seqProductIds = [...new Set(activeSequences.map((s: any) => s.product_id).filter(Boolean))];
      const seqStoreIds = [...new Set(activeSequences.map((s: any) => s.store_user_id))];

      const { data: seqCustomers } = await supabase
        .from("customers").select("id, name, auth_user_id, store_user_id").in("id", seqCustomerIds);
      const seqCustomerMap = new Map((seqCustomers || []).map((c: any) => [c.id, c]));

      // Product info with stock for urgency
      const seqProductMap = new Map<string, { name: string; stock: number; price: number }>();
      if (seqProductIds.length > 0) {
        const { data: products } = await supabase.from("products").select("id, name, stock, price").in("id", seqProductIds);
        for (const p of products || []) seqProductMap.set(p.id, { name: p.name, stock: p.stock, price: p.price });
      }

      const { data: seqStoreRows } = await supabase
        .from("store_settings").select("user_id, store_name, store_slug").in("user_id", seqStoreIds);
      const seqStoreMap = new Map((seqStoreRows || []).map((s: any) => [s.user_id, s]));

      // Discount availability per store
      const seqStoreDiscounts = new Set<string>();
      const { data: seqCoupons } = await supabase
        .from("coupons").select("user_id").eq("active", true).in("user_id", seqStoreIds).limit(100);
      for (const c of seqCoupons || []) seqStoreDiscounts.add(c.user_id);

      const seqAuthUserIds = (seqCustomers || []).map((c: any) => c.auth_user_id).filter(Boolean);
      const { data: seqPushSubs } = await supabase
        .from("push_subscriptions").select("user_id").in("user_id", seqAuthUserIds);
      const seqHasPush = new Set((seqPushSubs || []).map((s: any) => s.user_id));

      // Customer intent levels
      const { data: seqStates } = await supabase
        .from("customer_states").select("customer_id, intent_level").in("customer_id", seqCustomerIds);
      const seqIntentMap = new Map((seqStates || []).map((s: any) => [s.customer_id, s.intent_level]));

      const { data: seqTodayExecs } = await supabase
        .from("automation_executions")
        .select("customer_id")
        .in("customer_id", seqCustomerIds)
        .gte("sent_at", todayStart);
      const seqDailyCount = new Map<string, number>();
      for (const exec of seqTodayExecs || []) {
        seqDailyCount.set(exec.customer_id, (seqDailyCount.get(exec.customer_id) || 0) + 1);
      }

      // Stop condition checks
      const { data: returnEvents } = await supabase
        .from("customer_behavior_events")
        .select("customer_id, event_type, created_at")
        .in("customer_id", seqCustomerIds)
        .in("event_type", ["purchase_completed", "app_open", "session_start"])
        .gte("created_at", new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString())
        .order("created_at", { ascending: false })
        .limit(500);

      const customerPurchased = new Set<string>();
      const customerReturnedAt = new Map<string, string>();
      for (const ev of returnEvents || []) {
        if (ev.event_type === "purchase_completed") {
          customerPurchased.add(ev.customer_id);
        } else if (!customerReturnedAt.has(ev.customer_id)) {
          customerReturnedAt.set(ev.customer_id, ev.created_at);
        }
      }

      // Sort by intent level (high first for priority delivery)
      const sortedSequences = [...activeSequences].sort((a: any, b: any) => {
        const intentOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
        const aIntent = seqIntentMap.get(a.customer_id) || "low";
        const bIntent = seqIntentMap.get(b.customer_id) || "low";
        return (intentOrder[aIntent] ?? 2) - (intentOrder[bIntent] ?? 2);
      });

      for (const seq of sortedSequences) {
        const customer = seqCustomerMap.get(seq.customer_id);
        if (!customer?.auth_user_id || !seqHasPush.has(customer.auth_user_id)) {
          retargetingSkipped++; continue;
        }

        // STOP: User purchased
        if (customerPurchased.has(seq.customer_id)) {
          await supabase.from("retargeting_sequences")
            .update({ status: "stopped", stopped_reason: "purchased" })
            .eq("id", seq.id);
          retargetingSkipped++; continue;
        }

        // STOP: User returned (app_open after sequence created)
        const returnedAt = customerReturnedAt.get(seq.customer_id);
        if (returnedAt && new Date(returnedAt) > new Date(seq.created_at)) {
          await supabase.from("retargeting_sequences")
            .update({ status: "stopped", stopped_reason: "user_returned" })
            .eq("id", seq.id);
          retargetingSkipped++; continue;
        }

        // Rate limit
        if ((seqDailyCount.get(seq.customer_id) || 0) >= MAX_PUSH_PER_DAY) {
          retargetingSkipped++; continue;
        }

        // Max pushes per product
        if (seq.pushes_sent >= 3) {
          await supabase.from("retargeting_sequences")
            .update({ status: "completed", stopped_reason: "max_reached" })
            .eq("id", seq.id);
          retargetingSkipped++; continue;
        }

        const store = seqStoreMap.get(seq.store_user_id);
        const storeName = store?.store_name || store?.store_slug || "Loja";
        const productInfo = seq.product_id ? seqProductMap.get(seq.product_id) : undefined;
        const productName = productInfo?.name;
        const isLowStock = productInfo ? productInfo.stock <= 5 && productInfo.stock > 0 : false;
        const hasDiscount = seqStoreDiscounts.has(seq.store_user_id);
        const stepConfig = STEP_CONFIG[seq.current_step] || STEP_CONFIG[3];
        const intentLevel = seqIntentMap.get(seq.customer_id) || "low";

        // Pick template — prioritize low stock and discount signals
        const tpl = pickTemplate("browsing_exit", !!productName, {
          tone: stepConfig.tone,
          lowStock: isLowStock,
          discount: hasDiscount,
        });
        const vars: Record<string, string> = {
          greetings, name: customer.name || "cliente",
          store: storeName, product: productName || "",
        };
        let title = fillTemplate(tpl.title, vars);
        let body = fillTemplate(tpl.body, vars);

        // AI rewrite with full context (higher chance for high-intent users)
        const aiChance = intentLevel === "high" ? 0.8 : intentLevel === "medium" ? 0.6 : 0.4;
        if (lovableApiKey && Math.random() < aiChance) {
          try {
            const toneDesc = stepConfig.tone === "soft" ? "gentil e curioso"
              : stepConfig.tone === "urgent" ? "urgente e persuasivo com escassez"
              : "agressivo e direto, use CAPS, adicione ÚLTIMA CHANCE / CORRA AGORA";
            const extraCtx: string[] = [];
            if (productName) extraCtx.push(`Produto: "${productName}"`);
            if (isLowStock) extraCtx.push(`ESTOQUE BAIXO (${productInfo!.stock} unidades)`);
            if (hasDiscount) extraCtx.push("Loja tem DESCONTO ativo - destaque isso!");
            if (productInfo?.price) extraCtx.push(`Preço: R$${productInfo.price.toFixed(2)}`);
            extraCtx.push(`Passo ${seq.current_step}/${seq.max_steps}. Tom: ${toneDesc}.`);
            extraCtx.push(`Intent do cliente: ${intentLevel}`);

            const aiMsg = await aiRewrite(lovableApiKey, title, body, "retargeting", storeName, customer.name, greetings, extraCtx.join(" | "));
            if (aiMsg) { title = aiMsg.title; body = aiMsg.body; }
          } catch (e) { console.error("AI retargeting error:", e); }
        }

        // Send push with deep link
        try {
          const pushResp = await fetch(`${supabaseUrl}/functions/v1/send-push-internal`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              target_user_id: customer.auth_user_id,
              title, body,
              url: seq.product_id ? `/produto/${seq.product_id}` : "/",
              type: `retargeting_step_${seq.current_step}`,
              store_user_id: seq.store_user_id,
            }),
          });
          const pushData = await pushResp.json();

          await supabase.from("automation_executions").insert({
            user_id: seq.store_user_id,
            customer_id: seq.customer_id,
            trigger_type: `retargeting_step_${seq.current_step}`,
            channel: "push",
            message_text: `${title} — ${body}`,
            ai_generated: !!lovableApiKey,
            status: pushData.sent > 0 ? "sent" : "failed",
            error_message: pushData.sent > 0 ? null : JSON.stringify(pushData).slice(0, 200),
            related_product_id: seq.product_id || null,
          });

          if (pushData.sent > 0) {
            retargetingSent++;
            const nextStep = seq.current_step + 1;
            if (nextStep > seq.max_steps) {
              await supabase.from("retargeting_sequences")
                .update({ status: "completed", stopped_reason: "max_reached", last_push_at: now.toISOString(), pushes_sent: seq.pushes_sent + 1 })
                .eq("id", seq.id);
            } else {
              const nextConfig = STEP_CONFIG[nextStep] || STEP_CONFIG[3];
              const [minD, maxD] = nextConfig.delayRange;
              // High-intent users get shorter delays
              const intentMultiplier = intentLevel === "high" ? 0.7 : intentLevel === "medium" ? 0.85 : 1.0;
              const nextDelay = (minD + Math.random() * (maxD - minD)) * intentMultiplier;
              const nextPushAt = new Date(now.getTime() + nextDelay * 60 * 1000).toISOString();

              await supabase.from("retargeting_sequences")
                .update({ current_step: nextStep, last_push_at: now.toISOString(), next_push_at: nextPushAt, pushes_sent: seq.pushes_sent + 1 })
                .eq("id", seq.id);
            }
          } else {
            retargetingSkipped++;
          }
        } catch (err: any) {
          console.error("Retargeting push error:", err.message);
          retargetingSkipped++;
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // PART 2: Behavior-based pushes (with intent priority)
    // ═══════════════════════════════════════════════════════════════════
    const { data: states, error: stErr } = await supabase
      .from("customer_states")
      .select("*")
      .in("state", ["abandoned_cart", "browsing", "browsing_exit", "inactive"])
      .order("intent_level", { ascending: true }) // high first (alphabetically: high < inactive < low < medium)
      .limit(500);

    if (stErr) throw stErr;

    let behaviorSent = 0, behaviorSkipped = 0;

    if (states && states.length > 0) {
      // Sort by intent: high > medium > low
      const intentOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
      const sortedStates = [...states].sort((a: any, b: any) =>
        (intentOrder[a.intent_level] ?? 2) - (intentOrder[b.intent_level] ?? 2)
      );

      const customerIds = sortedStates.map((s: any) => s.customer_id);
      const { data: todayExecs } = await supabase
        .from("automation_executions")
        .select("customer_id, sent_at")
        .in("customer_id", customerIds)
        .gte("sent_at", todayStart)
        .order("sent_at", { ascending: false });

      const dailyCount = new Map<string, number>();
      const lastSentAt = new Map<string, Date>();
      for (const exec of todayExecs || []) {
        const cid = exec.customer_id;
        dailyCount.set(cid, (dailyCount.get(cid) || 0) + 1);
        if (!lastSentAt.has(cid)) lastSentAt.set(cid, new Date(exec.sent_at));
      }

      const { data: customers } = await supabase.from("customers").select("id, name, auth_user_id, store_user_id").in("id", customerIds);
      const customerMap = new Map((customers || []).map((c: any) => [c.id, c]));

      const storeIds = [...new Set(sortedStates.map((s: any) => s.store_user_id))];
      const { data: storeRows } = await supabase.from("store_settings").select("user_id, store_name, store_slug").in("user_id", storeIds);
      const storeMap = new Map((storeRows || []).map((s: any) => [s.user_id, s]));

      const authUserIds = (customers || []).map((c: any) => c.auth_user_id).filter(Boolean);
      const { data: pushSubs } = await supabase.from("push_subscriptions").select("user_id").in("user_id", authUserIds);
      const hasPush = new Set((pushSubs || []).map((s: any) => s.user_id));

      // Skip customers with active retargeting
      const customersWithActiveSeq = new Set<string>();
      if (activeSequences) {
        for (const seq of activeSequences) customersWithActiveSeq.add(seq.customer_id);
      }

      for (const state of sortedStates) {
        const customer = customerMap.get(state.customer_id);
        if (!customer?.auth_user_id || !hasPush.has(customer.auth_user_id)) { behaviorSkipped++; continue; }
        if ((dailyCount.get(state.customer_id) || 0) >= MAX_PUSH_PER_DAY) { behaviorSkipped++; continue; }
        if (customersWithActiveSeq.has(state.customer_id)) { behaviorSkipped++; continue; }

        const last = lastSentAt.get(state.customer_id);
        // High-intent users get shorter cooldowns
        const cooldown = state.intent_level === "high" ? MIN_INTERVAL_MINUTES * 0.6
          : state.intent_level === "medium" ? MIN_INTERVAL_MINUTES * 0.8
          : MIN_INTERVAL_MINUTES;
        if (last && (now.getTime() - last.getTime()) < cooldown * 60 * 1000) { behaviorSkipped++; continue; }

        const delays = TRIGGER_DELAYS[state.state];
        if (!delays) { behaviorSkipped++; continue; }

        const targetDelay = randomDelayInRange(delays.min, delays.max, state.customer_id);
        const stateChangedAt = new Date(state.state_changed_at);
        const elapsedMin = (now.getTime() - stateChangedAt.getTime()) / (60 * 1000);
        if (elapsedMin < targetDelay) { behaviorSkipped++; continue; }
        if (elapsedMin > delays.max * 3) { behaviorSkipped++; continue; }

        const store = storeMap.get(state.store_user_id);
        const storeName = store?.store_name || store?.store_slug || "Loja";
        const productName = state.last_product_name || undefined;
        const productId = state.last_product_id || undefined;

        const tpl = pickTemplate(state.state, !!productName, {
          lowStock: state.low_stock,
          discount: state.discount_available,
        });
        const vars: Record<string, string> = {
          greetings, name: customer.name || "cliente",
          store: storeName, product: productName || "",
        };
        let title = fillTemplate(tpl.title, vars);
        let body = fillTemplate(tpl.body, vars);

        // AI rewrite
        const aiChance = state.intent_level === "high" ? 0.7 : 0.5;
        if (lovableApiKey && Math.random() < aiChance) {
          try {
            const extraCtx: string[] = [];
            if (productName) extraCtx.push(`Produto: "${productName}"`);
            if (state.low_stock) extraCtx.push("ESTOQUE BAIXO");
            if (state.discount_available) extraCtx.push("DESCONTO disponível - destaque!");
            extraCtx.push(`Intent: ${state.intent_level}`);

            const aiMsg = await aiRewrite(lovableApiKey, title, body, state.state, storeName, customer.name, greetings, extraCtx.join(" | "));
            if (aiMsg) { title = aiMsg.title; body = aiMsg.body; }
          } catch (e) { console.error("AI rewrite error:", e); }
        }

        try {
          const pushResp = await fetch(`${supabaseUrl}/functions/v1/send-push-internal`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              target_user_id: customer.auth_user_id,
              title, body,
              url: productId ? `/produto/${productId}` : "/",
              type: `behavior_${state.state}`,
              store_user_id: state.store_user_id,
            }),
          });
          const pushData = await pushResp.json();

          await supabase.from("automation_executions").insert({
            user_id: state.store_user_id,
            customer_id: state.customer_id,
            trigger_type: `behavior_${state.state}`,
            channel: "push",
            message_text: `${title} — ${body}`,
            ai_generated: !!lovableApiKey,
            status: pushData.sent > 0 ? "sent" : "failed",
            error_message: pushData.sent > 0 ? null : JSON.stringify(pushData).slice(0, 200),
            related_product_id: productId || null,
          });

          if (pushData.sent > 0) behaviorSent++; else behaviorSkipped++;
        } catch (err: any) {
          console.error("Push error:", err.message);
          behaviorSkipped++;
        }
      }
    }

    // Expire old sequences
    const expireCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    await supabase.from("retargeting_sequences")
      .update({ status: "stopped", stopped_reason: "expired" })
      .eq("status", "active")
      .lt("created_at", expireCutoff);

    console.log(`[push-scheduler] Retargeting: sent=${retargetingSent} skip=${retargetingSkipped} | Behavior: sent=${behaviorSent} skip=${behaviorSkipped}`);
    return json({
      retargeting: { sent: retargetingSent, skipped: retargetingSkipped },
      behavior: { sent: behaviorSent, skipped: behaviorSkipped },
    });
  } catch (err: any) {
    console.error("[push-scheduler] Error:", err.message);
    return json({ error: err.message }, 500);
  }
});

async function aiRewrite(
  apiKey: string, baseTitle: string, baseBody: string,
  state: string, storeName: string, customerName: string, greetings: string,
  productContext = ""
): Promise<{ title: string; body: string } | null> {
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-lite",
      messages: [
        {
          role: "system",
          content: `Reescreva esta notificação push para a loja "${storeName}". Foco em CONVERSÃO e RECEITA.
${productContext ? `CONTEXTO: ${productContext}` : ""}
REGRAS: Responda APENAS JSON: {"title":"...","body":"..."}
- title: máx 50 chars, comece com emoji
- body: máx 120 chars
- Use tom ${state === "abandoned_cart" ? "urgente mas gentil" : state === "retargeting" ? "persuasivo, escassez e urgência" : state === "browsing_exit" ? "curioso e FOMO" : state === "inactive" ? "carinhoso com novidade" : "convidativo"}
- Se ESTOQUE BAIXO: adicione urgência real
- Se DESCONTO: destaque a economia
- Se intent HIGH: seja mais direto e agressivo
- Frases de alta conversão: ÚLTIMA CHANCE, SÓ HOJE, QUASE ESGOTADO, CORRA AGORA
- Varie dos originais
- Saudação: "${greetings}"`,
        },
        { role: "user", content: `Original: title="${baseTitle}" body="${baseBody}". Cliente: ${customerName}` },
      ],
      max_tokens: 150,
      temperature: 1.0,
    }),
  });

  if (!resp.ok) return null;
  const data = await resp.json();
  const content = data.choices?.[0]?.message?.content || "";
  const cleaned = content.replace(/```json\n?/g, "").replace(/```/g, "").trim();

  const jsonStart = cleaned.search(/\{/);
  const jsonEnd = cleaned.lastIndexOf("}");
  if (jsonStart === -1 || jsonEnd === -1) return null;

  try {
    const parsed = JSON.parse(cleaned.substring(jsonStart, jsonEnd + 1));
    if (parsed.title && parsed.body) return parsed;
  } catch {
    try {
      const fixed = cleaned.substring(jsonStart, jsonEnd + 1)
        .replace(/,\s*}/g, "}").replace(/[\x00-\x1F\x7F]/g, "");
      const parsed = JSON.parse(fixed);
      if (parsed.title && parsed.body) return parsed;
    } catch { /* fall through */ }
  }
  return null;
}

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
