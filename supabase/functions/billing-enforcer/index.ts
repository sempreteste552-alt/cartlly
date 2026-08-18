import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GRACE_DAYS = 3;
const WARN_DAYS_BEFORE = 3;
const DAY = 24 * 60 * 60 * 1000;

/**
 * Rotina diária de cobrança:
 *  - avisa 3 dias antes do vencimento (push + sino)
 *  - avisa no dia do vencimento / atraso (push + sino, 1x por dia)
 *  - após 3 dias de atraso: bloqueia a loja e o painel (push + sino + auditoria)
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const fnBase = `${Deno.env.get("SUPABASE_URL")}/functions/v1`;

  async function notify(
    userId: string,
    title: string,
    message: string,
    type: string,
    url = "/admin/plano"
  ) {
    // 1) Sino interno (dentro do app)
    await supabase.from("admin_notifications").insert({
      sender_user_id: userId,
      target_user_id: userId,
      title,
      message,
      type,
    });

    // 2) Push fora do app (web push / PWA)
    try {
      await fetch(`${fnBase}/send-push-internal`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
          target_user_id: userId,
          title,
          body: message,
          url,
          type,
          tag: type,
        }),
      });
    } catch (e) {
      console.error("[billing-enforcer] push error", (e as Error).message);
    }
  }

  try {
    const now = new Date();
    const results = { warned: 0, overdue: 0, blocked: 0 };

    const { data: subs, error } = await supabase
      .from("tenant_subscriptions")
      .select("*, tenant_plans(name, price)")
      .in("status", ["active", "trial", "past_due"]);

    if (error) throw error;

    for (const sub of subs || []) {
      const s: any = sub;
      const dueRaw = s.status === "trial" ? s.trial_ends_at : s.current_period_end;
      if (!dueRaw) continue;
      const due = new Date(dueRaw);
      const msToDue = due.getTime() - now.getTime();
      const planName = s.tenant_plans?.name || "seu plano";
      const price = Number(s.custom_price ?? s.tenant_plans?.price ?? 0);
      const valor = price
        ? ` (R$ ${price.toFixed(2).replace(".", ",")})`
        : "";

      // --- A) Aviso antes do vencimento ---
      if (msToDue > 0 && msToDue <= WARN_DAYS_BEFORE * DAY) {
        const lastWarn = s.last_due_warning_at ? new Date(s.last_due_warning_at) : null;
        if (!lastWarn || now.getTime() - lastWarn.getTime() > DAY) {
          const dias = Math.max(1, Math.ceil(msToDue / DAY));
          await notify(
            s.user_id,
            "⏰ Sua assinatura vence em breve",
            `${planName}${valor} vence em ${dias} dia(s). Garanta o pagamento para não perder o acesso à sua loja.`,
            "subscription_due_soon"
          );
          await supabase
            .from("tenant_subscriptions")
            .update({ last_due_warning_at: now.toISOString() })
            .eq("id", s.id);
          results.warned++;
        }
        continue;
      }

      if (msToDue > 0) continue;

      // --- Venceu ---
      const daysLate = Math.floor(-msToDue / DAY);
      const graceEnds = s.grace_ends_at
        ? new Date(s.grace_ends_at)
        : new Date(due.getTime() + GRACE_DAYS * DAY);

      if (!s.grace_ends_at) {
        await supabase
          .from("tenant_subscriptions")
          .update({ grace_ends_at: graceEnds.toISOString() })
          .eq("id", s.id);
      }

      // --- B) Dentro da tolerância: avisa 1x por dia ---
      if (now < graceEnds) {
        const lastNotice = s.last_overdue_notice_at ? new Date(s.last_overdue_notice_at) : null;
        if (!lastNotice || now.getTime() - lastNotice.getTime() > DAY) {
          const restante = Math.max(1, Math.ceil((graceEnds.getTime() - now.getTime()) / DAY));
          await notify(
            s.user_id,
            "🚨 Pagamento em atraso",
            `Seu pagamento de ${planName}${valor} está atrasado há ${daysLate} dia(s). Sua loja será bloqueada em ${restante} dia(s) se o pagamento não for identificado.`,
            "subscription_past_due"
          );
          await supabase
            .from("tenant_subscriptions")
            .update({
              status: s.status === "trial" ? s.status : "past_due",
              last_overdue_notice_at: now.toISOString(),
            })
            .eq("id", s.id);
          results.overdue++;
        }
        continue;
      }

      // --- C) Fim da tolerância: bloqueia loja + painel ---
      if (s.blocked_at) continue;

      const newStatus = s.status === "trial" ? "trial_expired" : "suspended";

      await supabase
        .from("tenant_subscriptions")
        .update({ status: newStatus, blocked_at: now.toISOString() })
        .eq("id", s.id);

      await supabase
        .from("store_settings")
        .update({ store_blocked: true })
        .eq("user_id", s.user_id);

      await supabase
        .from("profiles")
        .update({ status: "inativo" })
        .eq("user_id", s.user_id);

      await notify(
        s.user_id,
        "🔒 Loja bloqueada por falta de pagamento",
        `Sua loja foi bloqueada após ${daysLate} dia(s) de atraso. Regularize o pagamento de ${planName}${valor} para reativar imediatamente.`,
        "subscription_blocked"
      );

      await supabase.from("audit_logs").insert({
        action: "subscription_auto_blocked",
        target_type: "tenant",
        target_id: s.user_id,
        details: {
          subscription_id: s.id,
          due_at: due.toISOString(),
          days_late: daysLate,
          new_status: newStatus,
        },
      });

      results.blocked++;
    }

    console.log("[billing-enforcer]", JSON.stringify(results));
    return new Response(JSON.stringify({ ok: true, ...results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[billing-enforcer] error", (e as Error).message);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
