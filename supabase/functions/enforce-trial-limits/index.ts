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

    // Find all trial_expired or expired subscriptions
    const { data: expiredSubs, error: subErr } = await supabase
      .from("tenant_subscriptions")
      .select("user_id, status, plan_id, trial_ends_at, tenant_plans(max_products)")
      .in("status", ["trial_expired", "expired"]);

    if (subErr) throw subErr;

    // Also check active trials that have actually expired by date
    const { data: trialSubs, error: trialErr } = await supabase
      .from("tenant_subscriptions")
      .select("id, user_id, status, trial_ends_at, plan_id, tenant_plans(max_products)")
      .eq("status", "trial");

    if (trialErr) throw trialErr;

    const now = new Date();
    const results: string[] = [];

    // Mark expired trials
    for (const sub of trialSubs || []) {
      if (sub.trial_ends_at && new Date(sub.trial_ends_at) < now) {
        await supabase
          .from("tenant_subscriptions")
          .update({ status: "trial_expired" })
          .eq("id", sub.id);

        results.push(`Marked trial expired for user ${sub.user_id}`);

        // Process product limits for this newly expired trial
        await enforceProductLimit(supabase, sub.user_id, 10);
      }
    }

    // Enforce product limits on already expired subscriptions
    for (const sub of expiredSubs || []) {
      const maxProducts = (sub as any).tenant_plans?.max_products ?? 10;
      const effectiveLimit = Math.max(maxProducts, 10); // at minimum FREE limit
      await enforceProductLimit(supabase, sub.user_id, effectiveLimit);
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
    .order("created_at", { ascending: true });

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
      message: `${toUnpublish.length} produto(s) foram despublicados pois excedem o limite de ${maxProducts} do seu plano atual. Faça upgrade para republicá-los.`,
      type: "plan_limit",
    });
  }
}
