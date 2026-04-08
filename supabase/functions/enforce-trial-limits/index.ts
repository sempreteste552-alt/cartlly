import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const now = new Date();
    const results: string[] = [];

    // ─── 1. Send reminders for active trials approaching expiry (days 5, 6, 7) ──
    const { data: trialSubs, error: trialErr } = await supabase
      .from("tenant_subscriptions")
      .select("id, user_id, status, trial_ends_at, plan_id, plan_reminders_sent, tenant_plans(max_products, name)")
      .eq("status", "trial");

    if (trialErr) throw trialErr;

    for (const sub of trialSubs || []) {
      if (!sub.trial_ends_at) continue;
      const trialEnd = new Date(sub.trial_ends_at);
      const msLeft = trialEnd.getTime() - now.getTime();
      const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
      const remindersSent: number[] = (sub as any).plan_reminders_sent || [];

      // Check if trial has expired
      if (daysLeft <= 0) {
        // Mark as trial_expired
        await supabase
          .from("tenant_subscriptions")
          .update({ status: "trial_expired", downgrade_applied_at: now.toISOString() })
          .eq("id", sub.id);

        // Enforce FREE product limit (10)
        await enforceProductLimit(supabase, sub.user_id, 10);

        // Notify tenant
        await supabase.from("admin_notifications").insert({
          sender_user_id: sub.user_id,
          target_user_id: sub.user_id,
          title: "⏰ Seu período de teste expirou",
          message: "Seu trial Premium de 7 dias terminou. Sua loja agora está limitada ao plano Free (10 produtos). Faça upgrade para recuperar todas as funcionalidades!",
          type: "trial_expired",
        });

        results.push(`Trial expired for user ${sub.user_id}`);
        continue;
      }

      // Send reminders on days 5, 6, 7 (when daysLeft = 2, 1, 0 respectively)
      const reminderDay = 7 - daysLeft; // day 5 = daysLeft 2, day 6 = daysLeft 1, day 7 = daysLeft 0
      const reminderDays = [5, 6, 7];
      
      for (const day of reminderDays) {
        const targetDaysLeft = 7 - day; // day5→2, day6→1, day7→0
        if (daysLeft <= targetDaysLeft + 1 && daysLeft > targetDaysLeft && !remindersSent.includes(day)) {
          const messages: Record<number, { title: string; message: string }> = {
            5: {
              title: "⚡ Seu trial termina em 2 dias!",
              message: "Restam apenas 2 dias do seu trial Premium. Não perca acesso às funcionalidades avançadas — faça upgrade agora!",
            },
            6: {
              title: "⏳ Último dia completo do trial!",
              message: "Amanhã seu trial Premium expira. Faça upgrade hoje para não perder nenhuma funcionalidade!",
            },
            7: {
              title: "🚨 Seu trial expira HOJE!",
              message: "Seu período de teste Premium termina hoje. Após a expiração, sua loja será limitada ao plano Free. Faça upgrade agora!",
            },
          };

          const msg = messages[day];
          if (msg) {
            await supabase.from("admin_notifications").insert({
              sender_user_id: sub.user_id,
              target_user_id: sub.user_id,
              title: msg.title,
              message: msg.message,
              type: "trial_reminder",
            });

            // Update reminders sent
            const newReminders = [...remindersSent, day];
            await supabase
              .from("tenant_subscriptions")
              .update({ plan_reminders_sent: newReminders })
              .eq("id", sub.id);

            results.push(`Sent day ${day} reminder to user ${sub.user_id}`);
          }
        }
      }
    }

    // ─── 2. Enforce limits on already expired subscriptions ──
    const { data: expiredSubs, error: subErr } = await supabase
      .from("tenant_subscriptions")
      .select("user_id, status, plan_id, trial_ends_at, tenant_plans(max_products)")
      .in("status", ["trial_expired", "past_due", "canceled", "suspended"]);

    if (subErr) throw subErr;

    for (const sub of expiredSubs || []) {
      // For expired subscriptions, enforce FREE limit
      await enforceProductLimit(supabase, sub.user_id, 10);
    }

    return new Response(
      JSON.stringify({ success: true, processed: results.length + (expiredSubs?.length ?? 0), details: results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("enforce-trial-limits error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function enforceProductLimit(supabase: any, userId: string, maxProducts: number) {
  // Get all published products ordered by most recent
  const { data: products, error } = await supabase
    .from("products")
    .select("id, name, created_at")
    .eq("user_id", userId)
    .eq("published", true)
    .order("created_at", { ascending: false });

  if (error || !products) return;

  if (products.length > maxProducts) {
    // Unpublish the oldest products that exceed the limit
    const toUnpublish = products.slice(maxProducts);
    const ids = toUnpublish.map((p: any) => p.id);

    await supabase
      .from("products")
      .update({ published: false })
      .in("id", ids);

    // Notify the user
    await supabase.from("admin_notifications").insert({
      sender_user_id: userId,
      target_user_id: userId,
      title: "⚠️ Produtos despublicados",
      message: `${toUnpublish.length} produto(s) foram despublicados pois excedem o limite de ${maxProducts} do seu plano atual. Os ${maxProducts} mais recentes foram mantidos. Faça upgrade para republicá-los.`,
      type: "plan_limit",
    });
  }
}
