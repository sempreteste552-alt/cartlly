import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { storeUserId } = await req.json().catch(() => ({ storeUserId: null }));

    if (!storeUserId || typeof storeUserId !== "string") {
      return json({ error: "storeUserId é obrigatório" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await supabase
      .from("coupons")
      .select("code, discount_type, discount_value, expires_at, min_order_value, active, used_count, max_uses, created_at")
      .eq("user_id", storeUserId)
      .eq("active", true)
      .order("created_at", { ascending: false });

    if (error) {
      return json({ error: error.message }, 500);
    }

    const now = Date.now();
    const coupons = (data || [])
      .filter((coupon) => {
        const notExpired = !coupon.expires_at || new Date(coupon.expires_at).getTime() > now;
        const hasAvailability = coupon.max_uses == null || Number(coupon.used_count || 0) < Number(coupon.max_uses);
        return coupon.active && notExpired && hasAvailability;
      })
      .map(({ code, discount_type, discount_value, expires_at, min_order_value }) => ({
        code,
        discount_type,
        discount_value,
        expires_at,
        min_order_value,
      }));

    return json({ coupons, count: coupons.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno";
    return json({ error: message }, 500);
  }
});
