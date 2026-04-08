import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_PUSH_PER_DAY = 3;
const MIN_INTERVAL_MINUTES = 30;

// Delay ranges per state (minutes)
const TRIGGER_DELAYS: Record<string, { min: number; max: number }> = {
  abandoned_cart: { min: 30, max: 30 },
  browsing: { min: 15, max: 45 },   // browsing_exit
  inactive: { min: 120, max: 360 },  // 2–6 hours
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

    // 1. Get all customer states that need action
    const { data: states, error: stErr } = await supabase
      .from("customer_states")
      .select("*")
      .in("state", ["abandoned_cart", "browsing", "inactive"])
      .limit(500);

    if (stErr) throw stErr;
    if (!states || states.length === 0) {
      return json({ processed: 0, message: "No actionable states" });
    }

    // 2. Get today's push executions for rate limiting
    const customerIds = states.map((s: any) => s.customer_id);
    const { data: todayExecs } = await supabase
      .from("automation_executions")
      .select("customer_id, sent_at")
      .in("customer_id", customerIds)
      .gte("sent_at", todayStart)
      .order("sent_at", { ascending: false });

    // Build rate-limit maps
    const dailyCount = new Map<string, number>();
    const lastSentAt = new Map<string, Date>();
    for (const exec of todayExecs || []) {
      const cid = exec.customer_id;
      dailyCount.set(cid, (dailyCount.get(cid) || 0) + 1);
      if (!lastSentAt.has(cid)) lastSentAt.set(cid, new Date(exec.sent_at));
    }

    // 3. Get customer details
    const { data: customers } = await supabase
      .from("customers")
      .select("id, name, auth_user_id, store_user_id")
      .in("id", customerIds);
    const customerMap = new Map((customers || []).map((c: any) => [c.id, c]));

    // 4. Get store names
    const storeIds = [...new Set(states.map((s: any) => s.store_user_id))];
    const { data: storeRows } = await supabase
      .from("store_settings")
      .select("user_id, store_name, store_slug")
      .in("user_id", storeIds);
    const storeMap = new Map((storeRows || []).map((s: any) => [s.user_id, s]));

    // 5. Check push subscriptions exist
    const authUserIds = (customers || []).map((c: any) => c.auth_user_id).filter(Boolean);
    const { data: pushSubs } = await supabase
      .from("push_subscriptions")
      .select("user_id")
      .in("user_id", authUserIds);
    const hasPush = new Set((pushSubs || []).map((s: any) => s.user_id));

    let sent = 0;
    let skipped = 0;

    for (const state of states) {
      const customer = customerMap.get(state.customer_id);
      if (!customer?.auth_user_id || !hasPush.has(customer.auth_user_id)) {
        skipped++;
        continue;
      }

      // Rate limit: max per day
      if ((dailyCount.get(state.customer_id) || 0) >= MAX_PUSH_PER_DAY) {
        skipped++;
        continue;
      }

      // Rate limit: minimum interval
      const last = lastSentAt.get(state.customer_id);
      if (last && (now.getTime() - last.getTime()) < MIN_INTERVAL_MINUTES * 60 * 1000) {
        skipped++;
        continue;
      }

      // Check delay since state change
      const delays = TRIGGER_DELAYS[state.state];
      if (!delays) { skipped++; continue; }

      const stateChangedAt = new Date(state.state_changed_at);
      const elapsedMin = (now.getTime() - stateChangedAt.getTime()) / (60 * 1000);

      // Must wait at least min delay; use random within range for natural feel
      if (elapsedMin < delays.min) { skipped++; continue; }

      // Don't send if way past max (already handled or too late — 3x max)
      if (elapsedMin > delays.max * 3) { skipped++; continue; }

      const store = storeMap.get(state.store_user_id);
      const storeName = store?.store_name || store?.store_slug || "Loja";

      // Generate message
      const hour = now.getHours();
      const greetings = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
      let title = "";
      let body = "";

      if (state.state === "abandoned_cart") {
        title = "🛒 Você esqueceu algo no carrinho!";
        body = `${greetings}! Seus itens ainda estão te esperando na ${storeName}. Finalize sua compra!`;
      } else if (state.state === "browsing") {
        title = "👀 Vimos que você estava olhando...";
        body = `${greetings}! Encontrou algo legal na ${storeName}? Volte e confira nossas novidades!`;
      } else if (state.state === "inactive") {
        title = "💜 Sentimos sua falta!";
        body = `${greetings}! Faz um tempinho que você não passa na ${storeName}. Temos novidades te esperando!`;
      }

      // AI-enhanced message if available
      if (lovableApiKey) {
        try {
          const aiMsg = await generateAIMessage(lovableApiKey, state.state, storeName, customer.name, greetings, now);
          if (aiMsg) { title = aiMsg.title; body = aiMsg.body; }
        } catch (e) { console.error("AI message error:", e); }
      }

      // Send push
      try {
        const pushResp = await fetch(`${supabaseUrl}/functions/v1/send-push-internal`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            target_user_id: customer.auth_user_id,
            title, body,
            url: "/",
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
        });

        if (pushData.sent > 0) sent++; else skipped++;
      } catch (err: any) {
        console.error("Push error:", err.message);
        skipped++;
      }
    }

    console.log(`[push-scheduler] Sent: ${sent}, Skipped: ${skipped}`);
    return json({ processed: states.length, sent, skipped });
  } catch (err: any) {
    console.error("[push-scheduler] Error:", err.message);
    return json({ error: err.message }, 500);
  }
});

async function generateAIMessage(
  apiKey: string,
  state: string,
  storeName: string,
  customerName: string,
  greetings: string,
  now: Date
): Promise<{ title: string; body: string } | null> {
  const dayNames = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
  const dayName = dayNames[now.getDay()];
  const hour = now.getHours();
  const timeCtx = hour < 12 ? "manhã" : hour < 18 ? "tarde" : "noite";

  const stateDescriptions: Record<string, string> = {
    abandoned_cart: `O cliente "${customerName}" adicionou itens ao carrinho na loja "${storeName}" mas não finalizou a compra.`,
    browsing: `O cliente "${customerName}" navegou na loja "${storeName}" mas saiu sem comprar.`,
    inactive: `O cliente "${customerName}" está inativo há algum tempo na loja "${storeName}".`,
  };

  const toneGuide: Record<string, string> = {
    abandoned_cart: "urgência suave, lembrete gentil",
    browsing: "curioso, convidativo, leve",
    inactive: "saudade, carinhoso, acolhedor",
  };

  const systemPrompt = `Você é assistente de marketing da loja "${storeName}".
${stateDescriptions[state] || ""}

REGRAS:
- Responda APENAS com JSON: {"title": "...", "body": "..."}
- title: máx 50 chars, comece com emoji
- body: máx 130 chars, mencione o nome do cliente e da loja "${storeName}"
- Saudação: "${greetings}" (${dayName}, ${timeCtx})
- Tom: ${toneGuide[state] || "amigável"}
- Seed: ${now.toISOString()}-${state}-${customerName}`;

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
        { role: "user", content: `Estado: ${state}, Cliente: ${customerName}, Loja: ${storeName}` },
      ],
      max_tokens: 150,
      temperature: 0.9,
    }),
  });

  if (!resp.ok) return null;
  const data = await resp.json();
  const content = data.choices?.[0]?.message?.content || "";
  const cleaned = content.replace(/```json\n?/g, "").replace(/```/g, "").trim();
  const parsed = JSON.parse(cleaned);
  if (parsed.title && parsed.body) return parsed;
  return null;
}

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
