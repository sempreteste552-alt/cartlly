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

const PRODUCT_VIEW_MESSAGES = [
  { title: "👀 Ainda pensando em {product}?", body: "O {product} está esperando por você na {store}! Não deixe escapar 🛍️" },
  { title: "🔥 {product} quase esgotando!", body: "Você viu o {product} na {store} e ele está quase acabando! Garanta o seu ⚡" },
  { title: "⚡ Não perca o {product}!", body: "Oi {name}! O {product} que você viu na {store} ainda está disponível. Aproveite!" },
  { title: "💜 Voltou pra ver o {product}?", body: "{name}, sabemos que você amou o {product}! Finalize sua compra na {store} 🛒" },
  { title: "🌟 {product} com seu nome!", body: "Ei {name}, o {product} na {store} está te chamando! Que tal garantir? ✨" },
  { title: "🛍️ Esqueceu do {product}?", body: "{name}, o {product} que chamou sua atenção na {store} ainda está aqui!" },
  { title: "✨ Última chance: {product}", body: "O {product} da {store} pode sair do estoque a qualquer momento. Corra, {name}! 🏃" },
  { title: "💫 {product} esperando você!", body: "Oi {name}! Notamos seu interesse no {product}. A {store} reservou ele pra você 💜" },
];

const INACTIVITY_MESSAGES = [
  { title: "😢 Sentimos sua falta!", body: "Oi {name}, faz tempo que não te vemos na {store}! Temos novidades esperando por você ✨" },
  { title: "🌟 Novidades na {store}!", body: "{name}, muita coisa nova chegou na {store}! Venha conferir 🛍️" },
  { title: "💜 Saudades de você, {name}!", body: "A {store} preparou algo especial. Volte e confira as novidades! 🎁" },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    const results = {
      product_view: { processed: 0, sent: 0, skipped: 0 },
      inactivity: { processed: 0, sent: 0, skipped: 0 },
    };

    // ========== 1) PRODUCT VIEW RETARGETING ==========
    const pvStart = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const pvEnd = new Date(Date.now() - 15 * 60 * 1000).toISOString();

    const { data: viewEvents } = await supabase
      .from("customer_behavior_events")
      .select("customer_id, product_id, user_id, created_at, metadata")
      .eq("event_type", "product_view")
      .gte("created_at", pvStart)
      .lte("created_at", pvEnd)
      .not("customer_id", "is", null)
      .not("product_id", "is", null);

    if (viewEvents && viewEvents.length > 0) {
      const uniqueViews = new Map<string, typeof viewEvents[0]>();
      for (const ev of viewEvents) {
        const key = `${ev.customer_id}:${ev.product_id}`;
        const existing = uniqueViews.get(key);
        if (!existing || new Date(ev.created_at) > new Date(existing.created_at)) {
          uniqueViews.set(key, ev);
        }
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { data: todayExecs } = await supabase
        .from("automation_executions")
        .select("customer_id, message_text")
        .eq("trigger_type", "product_view")
        .gte("sent_at", today.toISOString());

      const alreadySent = new Set((todayExecs || []).map((e: any) => e.customer_id));

      const customerIds = [...new Set([...uniqueViews.values()].map(v => v.customer_id))];
      const { data: customers } = await supabase
        .from("customers")
        .select("id, name, auth_user_id, store_user_id")
        .in("id", customerIds);
      const customerMap = new Map((customers || []).map((c: any) => [c.id, c]));

      const productIds = [...new Set([...uniqueViews.values()].map(v => v.product_id))];
      const { data: products } = await supabase
        .from("products")
        .select("id, name, price, image_url")
        .in("id", productIds);
      const productMap = new Map((products || []).map((p: any) => [p.id, p]));

      const { data: recentOrders } = await supabase
        .from("order_items")
        .select("product_id, order_id")
        .in("product_id", productIds);
      const purchasedProducts = new Set((recentOrders || []).map((o: any) => o.product_id));

      const storeIds = [...new Set([...uniqueViews.values()].map(v => v.user_id))];
      const { data: stores } = await supabase
        .from("store_settings")
        .select("user_id, store_name, store_slug")
        .in("user_id", storeIds);
      const storeMap = new Map((stores || []).map((s: any) => [s.user_id, s]));

      const dailyCounts = new Map<string, number>();
      (todayExecs || []).forEach((e: any) => {
        dailyCounts.set(e.customer_id, (dailyCounts.get(e.customer_id) || 0) + 1);
      });

      for (const [, ev] of uniqueViews) {
        results.product_view.processed++;

        const customer = customerMap.get(ev.customer_id);
        if (!customer?.auth_user_id) { results.product_view.skipped++; continue; }

        if (alreadySent.has(ev.customer_id)) { results.product_view.skipped++; continue; }
        if ((dailyCounts.get(ev.customer_id) || 0) >= 3) { results.product_view.skipped++; continue; }
        if (purchasedProducts.has(ev.product_id)) { results.product_view.skipped++; continue; }

        const product = productMap.get(ev.product_id);
        if (!product) { results.product_view.skipped++; continue; }

        const store = storeMap.get(ev.user_id);
        const storeName = store?.store_name || store?.store_slug || "nossa loja";

        let msg: { title: string; body: string };

        if (lovableApiKey) {
          try {
            msg = await generateAIProductViewMessage(lovableApiKey, {
              customerName: customer.name,
              productName: product.name,
              productPrice: product.price,
              storeName,
            });
          } catch (e) {
            console.error("AI product_view error:", e);
            msg = pickRandomMessage(PRODUCT_VIEW_MESSAGES, customer.name, product.name, storeName);
          }
        } else {
          msg = pickRandomMessage(PRODUCT_VIEW_MESSAGES, customer.name, product.name, storeName);
        }

        try {
          const pushResp = await fetch(`${supabaseUrl}/functions/v1/send-push-internal`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              target_user_id: customer.auth_user_id,
              title: msg.title,
              body: msg.body,
              url: "/",
              type: "product_view",
              store_user_id: customer.store_user_id,
            }),
          });
          const pushData = await pushResp.json();

          await supabase.from("automation_executions").insert({
            user_id: customer.store_user_id,
            customer_id: ev.customer_id,
            trigger_type: "product_view",
            channel: "push",
            message_text: `${msg.title} — ${msg.body}`,
            ai_generated: !!lovableApiKey,
            status: pushData.sent > 0 ? "sent" : "failed",
            error_message: pushData.sent > 0 ? null : JSON.stringify(pushData).slice(0, 200),
            related_product_id: ev.product_id,
          });

          if (pushData.sent > 0) {
            results.product_view.sent++;
          } else {
            results.product_view.skipped++;
          }
        } catch (err: any) {
          results.product_view.skipped++;
        }
      }
    }

    // ========== 2) INACTIVITY RETARGETING ==========
    const inactivityCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const inactivityRecentCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: inactiveCustomers } = await supabase
      .from("customer_states")
      .select("customer_id, store_user_id, last_activity_at, state")
      .lt("last_activity_at", inactivityCutoff)
      .gte("last_activity_at", inactivityRecentCutoff);

    if (inactiveCustomers && inactiveCustomers.length > 0) {
      const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      const inactiveCustomerIds = inactiveCustomers.map((c: any) => c.customer_id);
      const { data: recentInactivityExecs } = await supabase
        .from("automation_executions")
        .select("customer_id")
        .eq("trigger_type", "inactivity")
        .gte("sent_at", twoDaysAgo)
        .in("customer_id", inactiveCustomerIds);

      const recentlySent = new Set((recentInactivityExecs || []).map((e: any) => e.customer_id));

      const { data: inactiveCustomerData } = await supabase
        .from("customers")
        .select("id, name, auth_user_id, store_user_id")
        .in("id", inactiveCustomerIds);
      const inactiveMap = new Map((inactiveCustomerData || []).map((c: any) => [c.id, c]));

      const storeIdsInact = [...new Set(inactiveCustomers.map((c: any) => c.store_user_id))];
      const { data: storesInact } = await supabase
        .from("store_settings")
        .select("user_id, store_name, store_slug")
        .in("user_id", storeIdsInact);
      const storeMapInact = new Map((storesInact || []).map((s: any) => [s.user_id, s]));

      for (const state of inactiveCustomers) {
        results.inactivity.processed++;

        if (recentlySent.has(state.customer_id)) { results.inactivity.skipped++; continue; }

        const customer = inactiveMap.get(state.customer_id);
        if (!customer?.auth_user_id) { results.inactivity.skipped++; continue; }

        const store = storeMapInact.get(state.store_user_id);
        const storeName = store?.store_name || store?.store_slug || "nossa loja";

        const msg = pickRandomMessage(INACTIVITY_MESSAGES, customer.name, "", storeName);

        try {
          const pushResp = await fetch(`${supabaseUrl}/functions/v1/send-push-internal`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              target_user_id: customer.auth_user_id,
              title: msg.title,
              body: msg.body,
              url: "/",
              type: "inactivity",
              store_user_id: customer.store_user_id,
            }),
          });
          const pushData = await pushResp.json();

          await supabase.from("automation_executions").insert({
            user_id: customer.store_user_id,
            customer_id: state.customer_id,
            trigger_type: "inactivity",
            channel: "push",
            message_text: `${msg.title} — ${msg.body}`,
            ai_generated: false,
            status: pushData.sent > 0 ? "sent" : "failed",
            error_message: pushData.sent > 0 ? null : JSON.stringify(pushData).slice(0, 200),
          });

          if (pushData.sent > 0) {
            results.inactivity.sent++;
          } else {
            results.inactivity.skipped++;
          }
        } catch (err: any) {
          results.inactivity.skipped++;
        }
      }
    }

    return json({ success: true, ...results });
  } catch (error: any) {
    return json({ error: error.message }, 500);
  }
});

function pickRandomMessage(
  templates: { title: string; body: string }[],
  name: string,
  product: string,
  store: string
): { title: string; body: string } {
  const idx = Math.floor(Math.random() * templates.length);
  const t = templates[idx];
  return {
    title: t.title.replace("{product}", product).replace("{name}", name).replace("{store}", store).slice(0, 50),
    body: t.body.replace("{product}", product).replace("{name}", name).replace("{store}", store).slice(0, 130),
  };
}

async function generateAIProductViewMessage(
  apiKey: string,
  ctx: { customerName: string; productName: string; productPrice: number; storeName: string }
): Promise<{ title: string; body: string }> {
  const hour = new Date().getHours();
  const greetings = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const priceFormatted = `R$ ${Number(ctx.productPrice).toFixed(2)}`;
  const seed = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

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
          content: `Você é uma assistente de marketing criativa da loja "${ctx.storeName}".
O cliente "${ctx.customerName}" visualizou o produto "${ctx.productName}" (${priceFormatted}) mas saiu sem comprar.
Gere uma notificação push personalizada para trazê-lo de volta.

REGRAS:
- Responda APENAS com JSON: {"title": "...", "body": "..."}
- title: máximo 50 caracteres, comece com emoji variado (👀 🔥 ⚡ 💜 🌟 ✨ 🛍️ 💫 🎁 etc)
- body: máximo 130 caracteres, mencione o nome do cliente e do produto
- Mencione a loja "${ctx.storeName}"
- Tom: amigável, suave, sem pressão excessiva
- Crie FOMO sutil (pode acabar, últimas unidades, etc.)
- Saudação: "${greetings}"
- NUNCA repita mensagens. Seed de variação: ${seed}`,
        },
        {
          role: "user",
          content: `Cliente: ${ctx.customerName}\nProduto: ${ctx.productName}\nPreço: ${priceFormatted}\nLoja: ${ctx.storeName}`,
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

  if (parsed.title && parsed.body) return { title: parsed.title.slice(0, 50), body: parsed.body.slice(0, 130) };
  throw new Error("Invalid AI response");
}
