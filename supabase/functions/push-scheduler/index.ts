import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ========== SEQUENCE DEFINITIONS ==========

interface SequenceStep {
  delayMinutes: number;
  intensity: "soft" | "medium" | "aggressive";
  templates: { title: string; body: string }[];
}

const PRODUCT_VIEW_SEQUENCE: SequenceStep[] = [
  {
    delayMinutes: 15,
    intensity: "soft",
    templates: [
      { title: "👀 Ainda pensando em {product}?", body: "{name}, o {product} está esperando por você na {store}! 🛍️" },
      { title: "💭 {product} chamou sua atenção?", body: "Oi {name}! Que tal dar mais uma olhada no {product} na {store}? ✨" },
      { title: "🌟 Você viu o {product}!", body: "{name}, achamos que você adorou o {product}. Volte à {store}! 💜" },
      { title: "✨ {product} esperando você", body: "Oi {name}! O {product} da {store} está te chamando. Dê uma olhadinha! 😊" },
      { title: "💫 Gostou do {product}?", body: "{name}, o {product} ainda está disponível na {store}. Aproveite! 🛒" },
      { title: "😍 {product} combina com você!", body: "{name}, notamos seu interesse no {product} da {store}. Que tal garantir? 💕" },
      { title: "🛍️ {product} te esperando!", body: "Oi {name}! Vimos que você curtiu o {product} na {store}. Volte e confira! ✨" },
      { title: "💜 Olha o {product}!", body: "{name}, o {product} da {store} pode ser seu. Que tal uma espiadinha? 😉" },
      { title: "🎯 {product} marcado pra você", body: "Oi {name}! Reservamos o {product} da {store} no seu radar. Confira! 🌟" },
      { title: "🔖 Salvamos o {product}!", body: "{name}, o {product} que você viu na {store} ainda está aqui! Volte 💫" },
    ],
  },
  {
    delayMinutes: 120,
    intensity: "medium",
    templates: [
      { title: "🔥 {product} quase esgotando!", body: "{name}, o {product} da {store} está voando! Poucas unidades restantes ⚡" },
      { title: "⚡ Não perca o {product}!", body: "{name}! O {product} na {store} está com alta demanda. Garanta o seu! 🏃" },
      { title: "⏰ {product} saindo rápido!", body: "Alerta {name}! O {product} da {store} está com estoque baixo. Corra! 🔥" },
      { title: "🚨 Estoque baixo: {product}", body: "{name}, restam poucas unidades do {product} na {store}! Não fique sem 💨" },
      { title: "📢 Alerta de estoque: {product}", body: "{name}, o {product} da {store} está quase acabando! Garanta agora ⚡" },
      { title: "🏃 Corra! {product} sumindo!", body: "{name}, outras pessoas estão de olho no {product} da {store}. Seja rápido! 🔥" },
      { title: "⚠️ Últimas peças: {product}", body: "{name}! O {product} está saindo da {store}. Não perca essa chance! 💫" },
      { title: "🔥 Alta demanda: {product}!", body: "{name}, o {product} da {store} é um dos mais pedidos hoje! Corre! 🏃" },
      { title: "💥 {product} bombando!", body: "Ei {name}! O {product} é sucesso na {store}. Garanta antes que acabe! ⚡" },
      { title: "🌡️ {product} está quente!", body: "{name}, todo mundo quer o {product} da {store} hoje! Não fique de fora 🔥" },
    ],
  },
  {
    delayMinutes: 480,
    intensity: "aggressive",
    templates: [
      { title: "🚨 ÚLTIMA CHANCE: {product}!", body: "{name}, é agora ou nunca! O {product} da {store} pode acabar a qualquer momento! COMPRE JÁ 🔥" },
      { title: "⛔ {product}: ÚLTIMAS UNIDADES!", body: "ATENÇÃO {name}! O {product} da {store} está nas últimas. Não perca! GARANTA AGORA ⚡" },
      { title: "💣 SÓ HOJE: {product}!", body: "{name}, essa é sua ÚLTIMA CHANCE de garantir o {product} na {store}! VÁ AGORA 🏃" },
      { title: "🔴 ESGOTANDO: {product}!", body: "{name}! O {product} da {store} vai acabar! É AGORA ou nunca. CORRA! 💨" },
      { title: "⏳ TEMPO ESGOTANDO: {product}", body: "{name}, o {product} da {store} não vai durar. APROVEITE AGORA antes que acabe! 🚨" },
      { title: "🆘 NÃO PERCA: {product}!", body: "ÚLTIMA CHAMADA {name}! O {product} da {store} está quase esgotado. COMPRE AGORA! 🔥" },
      { title: "💀 FIM DE ESTOQUE: {product}", body: "{name}, estoque do {product} na {store} está ZERADO quase! CORRA AGORA 🏃💨" },
      { title: "🔥 URGENTE: {product}!", body: "{name}! Poucas horas para garantir o {product} na {store}. NÃO DEIXE ESCAPAR! ⚡" },
      { title: "⚡ AGORA OU NUNCA: {product}", body: "{name}, o {product} da {store} vai esgotar! GARANTA AGORA mesmo! SÓ HOJE 🚨" },
      { title: "🎯 DECISÃO FINAL: {product}", body: "{name}, ÚLTIMA OPORTUNIDADE de levar o {product} da {store}! VÁ AGORA! 💥" },
    ],
  },
];

const CART_ABANDONMENT_SEQUENCE: SequenceStep[] = [
  {
    delayMinutes: 30,
    intensity: "soft",
    templates: [
      { title: "🛒 Esqueceu algo no carrinho?", body: "{name}, seus itens na {store} estão te esperando! Finalize sua compra 😊" },
      { title: "💭 Seu carrinho te espera!", body: "Oi {name}! Você deixou itens especiais no carrinho da {store}. Volte! 🛍️" },
      { title: "🛍️ Itens reservados pra você!", body: "{name}, guardamos seu carrinho na {store}! Que tal finalizar? ✨" },
      { title: "😊 Voltando pra finalizar?", body: "{name}, seu carrinho na {store} está pronto! Só falta clicar em comprar 💜" },
      { title: "🔖 Carrinho salvo, {name}!", body: "Seus itens na {store} estão guardadinhos esperando você finalizar! 🛒" },
      { title: "💫 Falta pouco, {name}!", body: "Seu carrinho na {store} está quase completo. Finalize sua compra! ✨" },
      { title: "🎁 Seus itens te esperam!", body: "{name}, não esquece do seu carrinho na {store}! Está tudo pronto 🛍️" },
      { title: "💜 Guardamos pra você!", body: "Oi {name}! Seu carrinho na {store} está salvo. Volte quando quiser! 😊" },
      { title: "🛒 Carrinho pronto!", body: "{name}, seus produtos na {store} estão prontos para envio! Finalize 💫" },
      { title: "✨ Quase lá, {name}!", body: "Falta só um clique! Seu carrinho na {store} está esperando 🛒💜" },
    ],
  },
  {
    delayMinutes: 120,
    intensity: "medium",
    templates: [
      { title: "⏰ Seu carrinho vai expirar!", body: "{name}, os itens no seu carrinho da {store} podem esgotar! Finalize agora ⚡" },
      { title: "🔥 Itens do carrinho sumindo!", body: "{name}! Outros clientes estão comprando os mesmos itens da {store}. Corra! 🏃" },
      { title: "⚡ Carrinho em risco!", body: "{name}, seu carrinho na {store} tem itens com estoque baixo! Não perca! 🔥" },
      { title: "📢 Alerta: carrinho expirando!", body: "{name}, seus itens na {store} estão com alta procura! Garanta agora ⏰" },
      { title: "🚨 Itens quase esgotados!", body: "{name}! Os produtos do seu carrinho na {store} estão acabando. CORRA! ⚡" },
      { title: "🏃 Seus itens estão voando!", body: "{name}, o estoque dos seus itens na {store} está caindo rápido! Finalize 🔥" },
      { title: "⚠️ Carrinho sob risco!", body: "{name}, não garantimos os itens do seu carrinho na {store} por muito tempo! ⏰" },
      { title: "🔥 Demanda alta no carrinho!", body: "{name}, outros compradores querem seus itens na {store}! Finalize já ⚡" },
      { title: "💨 Carrinho pode esvaziar!", body: "{name}! Itens do seu carrinho na {store} com estoque crítico. Garanta! 🚨" },
      { title: "⏳ Tempo limitado!", body: "{name}, seu carrinho na {store} está com itens quase esgotados. Finalize! 🏃" },
    ],
  },
  {
    delayMinutes: 720,
    intensity: "aggressive",
    templates: [
      { title: "🚨 ÚLTIMA CHANCE: seu carrinho!", body: "{name}, é AGORA ou NUNCA! Seus itens na {store} vão acabar! FINALIZE JÁ 🔥" },
      { title: "⛔ CARRINHO EXPIRANDO!", body: "ATENÇÃO {name}! Seu carrinho na {store} será limpo em breve. COMPRE AGORA! ⚡" },
      { title: "💣 SÓ HOJE: finalize!", body: "{name}, ÚLTIMA OPORTUNIDADE de finalizar seu carrinho na {store}! VÁ AGORA 🏃" },
      { title: "🔴 URGENTE: carrinho!", body: "{name}! Seus itens na {store} estão nas ÚLTIMAS unidades. FINALIZE AGORA! 💨" },
      { title: "⏳ TEMPO ACABANDO!", body: "{name}, seu carrinho na {store} será removido em breve! COMPRE ANTES QUE ACABE! 🚨" },
      { title: "🆘 SALVE SEU CARRINHO!", body: "ÚLTIMA CHAMADA {name}! Finalize agora na {store} ou perca seus itens! 🔥" },
      { title: "💀 CARRINHO EM PERIGO!", body: "{name}, seus itens na {store} estão quase ESGOTADOS! É AGORA! COMPRE JÁ ⚡" },
      { title: "🔥 FINALIZAR AGORA!", body: "{name}! Última chance de salvar seu carrinho na {store}. NÃO PERCA! 🏃💨" },
      { title: "⚡ AGORA OU PERDE TUDO!", body: "{name}, o carrinho na {store} não vai esperar mais! GARANTA SEUS ITENS! 🚨" },
      { title: "🎯 DECISÃO FINAL!", body: "{name}, é sua ÚLTIMA CHANCE na {store}! Finalize ou perca tudo! COMPRE AGORA 💥" },
    ],
  },
];

const INACTIVITY_SEQUENCE: SequenceStep[] = [
  {
    delayMinutes: 120, // 2 hours
    intensity: "soft",
    templates: [
      { title: "👋 Voltou, {name}?", body: "Sentimos sua falta na {store}! Tem novidades te esperando ✨" },
      { title: "😊 Oi, {name}!", body: "Faz um tempinho que não te vemos na {store}. Vem conferir! 🛍️" },
      { title: "💜 Saudades, {name}!", body: "A {store} preparou coisas novas pra você! Venha dar uma olhada 🌟" },
      { title: "🌟 Novidades pra você!", body: "{name}, muita coisa nova chegou na {store}! Confira agora ✨" },
      { title: "🎁 Surpresas na {store}!", body: "Oi {name}! Temos novidades especiais esperando por você 💫" },
      { title: "✨ Coisas novas na {store}!", body: "{name}, a {store} se renovou! Venha ver o que há de novo 🛍️" },
      { title: "💫 {name}, venha ver!", body: "A {store} tem novidades incríveis! Não perca as últimas adições ✨" },
      { title: "🛍️ Produtos fresquinhos!", body: "{name}, a {store} acabou de receber novidades! Dê uma olhada 😊" },
    ],
  },
  {
    delayMinutes: 360, // 6 hours
    intensity: "medium",
    templates: [
      { title: "🔥 {name}, você está perdendo!", body: "Ofertas imperdíveis na {store} agora! Não fique de fora ⚡" },
      { title: "⚡ Promoções rolando!", body: "{name}, a {store} está com ofertas especiais AGORA! Confira antes que acabe 🔥" },
      { title: "📢 Alerta de ofertas!", body: "{name}! A {store} preparou descontos exclusivos. Aproveite! 🏃" },
      { title: "🏷️ Descontos limitados!", body: "{name}, ofertas exclusivas na {store} por TEMPO LIMITADO! Corra! ⚡" },
      { title: "💰 Economia na {store}!", body: "{name}, aproveite as promoções da {store} antes que acabem! 🔥" },
      { title: "🎯 Feito pra você!", body: "{name}, selecionamos ofertas especiais na {store} baseadas no seu gosto! ⚡" },
      { title: "🔥 Está perdendo muito!", body: "{name}! A {store} tem promoções que você NÃO pode perder! Confira 🏃" },
      { title: "⏰ Ofertas expirando!", body: "{name}, as promoções da {store} estão acabando! Aproveite agora 🔥" },
    ],
  },
  {
    delayMinutes: 1440, // 24 hours
    intensity: "aggressive",
    templates: [
      { title: "🚨 ÚLTIMA CHANCE, {name}!", body: "Suas ofertas exclusivas na {store} EXPIRAM HOJE! NÃO PERCA! ACESSE AGORA 🔥" },
      { title: "⛔ EXPIRANDO HOJE!", body: "{name}, ÚLTIMA OPORTUNIDADE na {store}! Ofertas vão embora à meia-noite! VÁ AGORA ⚡" },
      { title: "💣 SÓ HOJE na {store}!", body: "{name}, promoções EXCLUSIVAS na {store} acabam HOJE! APROVEITE AGORA! 🏃" },
      { title: "🔴 URGENTE, {name}!", body: "Ofertas IMPERDÍVEIS na {store} terminam em horas! NÃO DEIXE ESCAPAR! 🚨" },
      { title: "⏳ ÚLTIMAS HORAS!", body: "{name}, as ofertas da {store} acabam HOJE! É agora ou nunca! CORRA! 🔥" },
      { title: "🆘 NÃO PERCA, {name}!", body: "ÚLTIMA CHAMADA! Ofertas exclusivas na {store} expirando! ACESSE AGORA! ⚡" },
      { title: "💥 OFERTA FINAL!", body: "{name}, a {store} fez uma oferta IMPERDÍVEL que acaba HOJE! VÁ AGORA! 🏃" },
      { title: "🎯 AGORA OU NUNCA!", body: "{name}, as melhores ofertas da {store} expiram em breve! GARANTA JÁ! 🚨" },
    ],
  },
];

// ========== MAIN HANDLER ==========

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    const results = {
      product_view: { processed: 0, sent: 0, skipped: 0 },
      cart_abandonment: { processed: 0, sent: 0, skipped: 0 },
      inactivity: { processed: 0, sent: 0, skipped: 0 },
      sequences_created: 0,
      sequences_advanced: 0,
    };

    // ========== 1) PROCESS EXISTING SEQUENCES ==========
    const now = new Date();
    const { data: activeSeqs } = await supabase
      .from("retargeting_sequences")
      .select("*")
      .eq("status", "active")
      .lte("next_push_at", now.toISOString())
      .limit(100);

    if (activeSeqs && activeSeqs.length > 0) {
      const customerIds = [...new Set(activeSeqs.map((s: any) => s.customer_id))];
      const { data: customers } = await supabase
        .from("customers")
        .select("id, name, auth_user_id, store_user_id")
        .in("id", customerIds);
      const customerMap = new Map((customers || []).map((c: any) => [c.id, c]));

      const productIds = [...new Set(activeSeqs.map((s: any) => s.product_id).filter(Boolean))];
      const { data: products } = await supabase
        .from("products")
        .select("id, name, price, image_url")
        .in("id", productIds.length > 0 ? productIds : ["00000000-0000-0000-0000-000000000000"]);
      const productMap = new Map((products || []).map((p: any) => [p.id, p]));

      const storeIds = [...new Set(activeSeqs.map((s: any) => s.store_user_id))];
      const { data: stores } = await supabase
        .from("store_settings")
        .select("user_id, store_name, store_slug")
        .in("user_id", storeIds);
      const storeMap = new Map((stores || []).map((s: any) => [s.user_id, s]));

      // Check daily limits
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { data: todayExecs } = await supabase
        .from("automation_executions")
        .select("customer_id")
        .gte("sent_at", today.toISOString())
        .in("customer_id", customerIds);
      const dailyCounts = new Map<string, number>();
      (todayExecs || []).forEach((e: any) => {
        dailyCounts.set(e.customer_id, (dailyCounts.get(e.customer_id) || 0) + 1);
      });

      // Check if customers purchased the product (stop sequence)
      const { data: recentOrders } = await supabase
        .from("order_items")
        .select("product_id, order_id")
        .in("product_id", productIds.length > 0 ? productIds : ["00000000-0000-0000-0000-000000000000"]);
      const purchasedProducts = new Set((recentOrders || []).map((o: any) => o.product_id));

      for (const seq of activeSeqs) {
        const customer = customerMap.get(seq.customer_id);
        if (!customer?.auth_user_id) {
          await supabase.from("retargeting_sequences").update({ status: "stopped", stopped_reason: "no_auth" }).eq("id", seq.id);
          continue;
        }

        // Daily limit: 3 pushes max
        if ((dailyCounts.get(seq.customer_id) || 0) >= 3) {
          // Reschedule for tomorrow
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          tomorrow.setHours(9, 0, 0, 0);
          await supabase.from("retargeting_sequences").update({ next_push_at: tomorrow.toISOString() }).eq("id", seq.id);
          continue;
        }

        // Check if purchased → stop
        if (seq.product_id && purchasedProducts.has(seq.product_id)) {
          await supabase.from("retargeting_sequences").update({ status: "converted", stopped_reason: "purchased" }).eq("id", seq.id);
          continue;
        }

        // Determine sequence type and get step
        let sequenceDef: SequenceStep[];
        let triggerType: string;
        const seqMeta = seq.metadata as any || {};
        const seqType = seqMeta?.sequence_type || "product_view";

        if (seqType === "cart_abandonment") {
          sequenceDef = CART_ABANDONMENT_SEQUENCE;
          triggerType = "abandoned_cart";
        } else if (seqType === "inactivity") {
          sequenceDef = INACTIVITY_SEQUENCE;
          triggerType = "inactivity";
        } else {
          sequenceDef = PRODUCT_VIEW_SEQUENCE;
          triggerType = "product_view";
        }

        const stepIndex = seq.current_step;
        if (stepIndex >= sequenceDef.length || stepIndex >= seq.max_steps) {
          await supabase.from("retargeting_sequences").update({ status: "completed", stopped_reason: "all_steps_done" }).eq("id", seq.id);
          continue;
        }

        const step = sequenceDef[stepIndex];
        const product = productMap.get(seq.product_id);
        const store = storeMap.get(seq.store_user_id);
        const storeName = store?.store_name || store?.store_slug || "nossa loja";
        const productName = product?.name || "";

        // Pick message
        let msg: { title: string; body: string };

        if (lovableApiKey && (seqType === "product_view" || seqType === "cart_abandonment")) {
          try {
            msg = await generateAISequenceMessage(lovableApiKey, {
              customerName: customer.name,
              productName,
              productPrice: product?.price,
              storeName,
              step: stepIndex + 1,
              totalSteps: seq.max_steps,
              intensity: step.intensity,
              sequenceType: seqType,
            });
          } catch {
            msg = pickRandomMessage(step.templates, customer.name, productName, storeName);
          }
        } else {
          msg = pickRandomMessage(step.templates, customer.name, productName, storeName);
        }

        // Send push
        try {
          const pushResp = await fetch(`${supabaseUrl}/functions/v1/send-push-internal`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              target_user_id: customer.auth_user_id,
              title: msg.title,
              body: msg.body,
              url: "/",
              type: triggerType,
              store_user_id: seq.store_user_id,
            }),
          });
          const pushData = await pushResp.json();

          const wasSent = pushData.sent > 0;

          // Log execution
          await supabase.from("automation_executions").insert({
            user_id: seq.store_user_id,
            customer_id: seq.customer_id,
            trigger_type: triggerType,
            channel: "push",
            message_text: `[Step ${stepIndex + 1}/${seq.max_steps} ${step.intensity}] ${msg.title} — ${msg.body}`,
            ai_generated: !!lovableApiKey,
            status: wasSent ? "sent" : "failed",
            error_message: wasSent ? null : JSON.stringify(pushData).slice(0, 200),
            related_product_id: seq.product_id,
          });

          // Advance sequence
          const nextStep = stepIndex + 1;
          if (nextStep >= sequenceDef.length || nextStep >= seq.max_steps) {
            await supabase.from("retargeting_sequences").update({
              status: "completed",
              stopped_reason: "all_steps_done",
              current_step: nextStep,
              pushes_sent: seq.pushes_sent + 1,
              last_push_at: now.toISOString(),
            }).eq("id", seq.id);
          } else {
            const nextDelay = sequenceDef[nextStep].delayMinutes;
            const nextPushAt = new Date(Date.now() + nextDelay * 60 * 1000).toISOString();
            await supabase.from("retargeting_sequences").update({
              current_step: nextStep,
              pushes_sent: seq.pushes_sent + 1,
              last_push_at: now.toISOString(),
              next_push_at: nextPushAt,
            }).eq("id", seq.id);
          }

          results.sequences_advanced++;
          if (seqType === "product_view") {
            results.product_view.processed++;
            wasSent ? results.product_view.sent++ : results.product_view.skipped++;
          } else if (seqType === "cart_abandonment") {
            results.cart_abandonment.processed++;
            wasSent ? results.cart_abandonment.sent++ : results.cart_abandonment.skipped++;
          } else {
            results.inactivity.processed++;
            wasSent ? results.inactivity.sent++ : results.inactivity.skipped++;
          }
        } catch (err: any) {
          console.error(`Sequence push error ${seq.id}:`, err);
        }
      }
    }

    // ========== 2) CREATE NEW PRODUCT VIEW SEQUENCES ==========
    const pvStart = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const pvEnd = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    const { data: viewEvents } = await supabase
      .from("customer_behavior_events")
      .select("customer_id, product_id, user_id, created_at")
      .eq("event_type", "product_view")
      .gte("created_at", pvStart)
      .lte("created_at", pvEnd)
      .not("customer_id", "is", null)
      .not("product_id", "is", null);

    if (viewEvents && viewEvents.length > 0) {
      const uniqueViews = new Map<string, typeof viewEvents[0]>();
      for (const ev of viewEvents) {
        const key = `${ev.customer_id}:${ev.product_id}`;
        if (!uniqueViews.has(key)) uniqueViews.set(key, ev);
      }

      // Check existing sequences for these customer+product combos
      const custIds = [...new Set([...uniqueViews.values()].map(v => v.customer_id))];
      const { data: existingSeqs } = await supabase
        .from("retargeting_sequences")
        .select("customer_id, product_id, status")
        .in("customer_id", custIds)
        .in("status", ["active", "completed"]);
      const existingKeys = new Set((existingSeqs || []).map((s: any) => `${s.customer_id}:${s.product_id}`));

      // Check purchased products
      const prodIds = [...new Set([...uniqueViews.values()].map(v => v.product_id))];
      const { data: purchasedItems } = await supabase
        .from("order_items")
        .select("product_id")
        .in("product_id", prodIds);
      const purchasedSet = new Set((purchasedItems || []).map((o: any) => o.product_id));

      for (const [key, ev] of uniqueViews) {
        if (existingKeys.has(key)) continue;
        if (purchasedSet.has(ev.product_id)) continue;

        const firstStepDelay = PRODUCT_VIEW_SEQUENCE[0].delayMinutes;
        const nextPushAt = new Date(Date.now() + firstStepDelay * 60 * 1000).toISOString();

        await supabase.from("retargeting_sequences").insert({
          customer_id: ev.customer_id,
          store_user_id: ev.user_id,
          product_id: ev.product_id,
          status: "active",
          current_step: 0,
          max_steps: PRODUCT_VIEW_SEQUENCE.length,
          next_push_at: nextPushAt,
          metadata: { sequence_type: "product_view" },
        });
        results.sequences_created++;
      }
    }

    // ========== 3) CREATE CART ABANDONMENT SEQUENCES ==========
    const cartCutoff = new Date(Date.now() - 25 * 60 * 1000).toISOString();
    const { data: abandonedCarts } = await supabase
      .from("abandoned_carts")
      .select("id, customer_id, user_id, abandoned_at")
      .eq("recovered", false)
      .lt("abandoned_at", cartCutoff)
      .not("customer_id", "is", null)
      .limit(50);

    if (abandonedCarts && abandonedCarts.length > 0) {
      const cartCustIds = abandonedCarts.map((c: any) => c.customer_id);
      const { data: existingCartSeqs } = await supabase
        .from("retargeting_sequences")
        .select("customer_id, status")
        .in("customer_id", cartCustIds)
        .in("status", ["active"])
        .not("product_id", "is", null); // product sequences — we check separately

      // Check for active cart sequences specifically
      const { data: activeCartSeqs } = await supabase
        .from("retargeting_sequences")
        .select("customer_id")
        .in("customer_id", cartCustIds)
        .eq("status", "active");

      // Use metadata to check for cart_abandonment type but since we store in metadata JSON,
      // we just check if customer already has ANY active sequence
      const hasActiveSeq = new Set((activeCartSeqs || []).map((s: any) => s.customer_id));

      for (const cart of abandonedCarts) {
        if (hasActiveSeq.has(cart.customer_id)) continue;

        const firstStepDelay = CART_ABANDONMENT_SEQUENCE[0].delayMinutes;
        const nextPushAt = new Date(Date.now() + firstStepDelay * 60 * 1000).toISOString();

        await supabase.from("retargeting_sequences").insert({
          customer_id: cart.customer_id,
          store_user_id: cart.user_id,
          product_id: null,
          status: "active",
          current_step: 0,
          max_steps: CART_ABANDONMENT_SEQUENCE.length,
          next_push_at: nextPushAt,
          metadata: { sequence_type: "cart_abandonment", cart_id: cart.id },
        });
        results.sequences_created++;
      }
    }

    // ========== 4) CREATE INACTIVITY SEQUENCES ==========
    // Smart tiers: 2h, 6h, 24h
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: inactiveCustomers } = await supabase
      .from("customer_states")
      .select("customer_id, store_user_id, last_activity_at")
      .lt("last_activity_at", twoHoursAgo)
      .gte("last_activity_at", sevenDaysAgo)
      .limit(50);

    if (inactiveCustomers && inactiveCustomers.length > 0) {
      const inactiveCustIds = inactiveCustomers.map((c: any) => c.customer_id);
      const { data: existingInactSeqs } = await supabase
        .from("retargeting_sequences")
        .select("customer_id")
        .in("customer_id", inactiveCustIds)
        .eq("status", "active");
      const hasInactSeq = new Set((existingInactSeqs || []).map((s: any) => s.customer_id));

      // Also check recent completed inactivity sequences (cooldown: 48h)
      const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      const { data: recentCompleted } = await supabase
        .from("retargeting_sequences")
        .select("customer_id")
        .in("customer_id", inactiveCustIds)
        .in("status", ["completed", "stopped"])
        .gte("updated_at", twoDaysAgo);
      const recentlyDone = new Set((recentCompleted || []).map((s: any) => s.customer_id));

      for (const state of inactiveCustomers) {
        if (hasInactSeq.has(state.customer_id)) continue;
        if (recentlyDone.has(state.customer_id)) continue;

        const firstStepDelay = INACTIVITY_SEQUENCE[0].delayMinutes;
        const nextPushAt = new Date(Date.now() + firstStepDelay * 60 * 1000).toISOString();

        await supabase.from("retargeting_sequences").insert({
          customer_id: state.customer_id,
          store_user_id: state.store_user_id,
          product_id: null,
          status: "active",
          current_step: 0,
          max_steps: INACTIVITY_SEQUENCE.length,
          next_push_at: nextPushAt,
          metadata: { sequence_type: "inactivity" },
        });
        results.sequences_created++;
      }
    }

    console.log("[push-scheduler] Results:", JSON.stringify(results));
    return json({ success: true, ...results });
  } catch (error: any) {
    console.error("[push-scheduler] Fatal error:", error);
    return json({ error: error.message }, 500);
  }
});

// ========== HELPERS ==========

function pickRandomMessage(
  templates: { title: string; body: string }[],
  name: string,
  product: string,
  store: string
): { title: string; body: string } {
  const idx = Math.floor(Math.random() * templates.length);
  const t = templates[idx];
  return {
    title: t.title.replace(/\{product\}/g, product).replace(/\{name\}/g, name).replace(/\{store\}/g, store).slice(0, 50),
    body: t.body.replace(/\{product\}/g, product).replace(/\{name\}/g, name).replace(/\{store\}/g, store).slice(0, 130),
  };
}

async function generateAISequenceMessage(
  apiKey: string,
  ctx: {
    customerName: string;
    productName: string;
    productPrice?: number;
    storeName: string;
    step: number;
    totalSteps: number;
    intensity: string;
    sequenceType: string;
  }
): Promise<{ title: string; body: string }> {
  const hour = new Date().getHours();
  const greetings = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const priceFormatted = ctx.productPrice ? `R$ ${Number(ctx.productPrice).toFixed(2)}` : "";
  const seed = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const intensityGuide = {
    soft: "Tom suave e amigável. Sem pressão. Apenas lembre o cliente com carinho.",
    medium: "Tom de urgência moderada. Mencione estoque baixo ou alta demanda. Crie FOMO sutil.",
    aggressive: "Tom MUITO urgente e agressivo. Use CAPS em palavras-chave. CTAs fortes como COMPRE AGORA, ÚLTIMA CHANCE, É AGORA OU NUNCA. Máxima urgência!",
  }[ctx.intensity] || "Tom amigável.";

  const typeGuide = ctx.sequenceType === "cart_abandonment"
    ? `O cliente "${ctx.customerName}" ABANDONOU O CARRINHO na loja "${ctx.storeName}". Traga-o de volta para FINALIZAR A COMPRA.`
    : `O cliente "${ctx.customerName}" visualizou o produto "${ctx.productName}" ${priceFormatted ? `(${priceFormatted})` : ""} na loja "${ctx.storeName}" mas NÃO COMPROU.`;

  const resp = await fetch("https://ai.lovable.dev/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-lite",
      messages: [
        {
          role: "system",
          content: `Você é uma especialista em marketing de conversão da loja "${ctx.storeName}".
${typeGuide}

Esta é a mensagem ${ctx.step} de ${ctx.totalSteps} de uma SEQUÊNCIA de retargeting.
${intensityGuide}

REGRAS RÍGIDAS:
- Responda APENAS com JSON: {"title": "...", "body": "..."}
- title: máximo 50 caracteres, comece com emoji variado
- body: máximo 130 caracteres
- Mencione o nome do cliente "${ctx.customerName}" e a loja "${ctx.storeName}"
${ctx.productName ? `- Mencione o produto "${ctx.productName}"` : ""}
- Saudação: "${greetings}"
- NUNCA repita mensagens. Seed: ${seed}
- ${ctx.intensity === "aggressive" ? "Use CTAs FORTES: COMPRE AGORA, GARANTA JÁ, É AGORA, CORRA, VÁ AGORA" : ""}`,
        },
        {
          role: "user",
          content: `Gere a mensagem push para Step ${ctx.step}/${ctx.totalSteps} (${ctx.intensity}).`,
        },
      ],
      max_tokens: 150,
      temperature: 0.95,
    }),
  });

  if (!resp.ok) throw new Error(`AI API error: ${resp.status}`);

  const data = await resp.json();
  const content = data.choices?.[0]?.message?.content || "";
  const cleaned = content.replace(/```json\n?/g, "").replace(/```/g, "").trim();
  const parsed = JSON.parse(cleaned);

  if (parsed.title && parsed.body) {
    return { title: parsed.title.slice(0, 50), body: parsed.body.slice(0, 130) };
  }
  throw new Error("Invalid AI response");
}
