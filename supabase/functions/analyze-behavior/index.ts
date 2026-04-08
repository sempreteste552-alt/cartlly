import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ABANDONED_CART_MINUTES = 30;
const INACTIVE_HOURS = 24;
const ACTIVE_MIN_SESSIONS = 2;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const now = new Date();
    const abandonedThreshold = new Date(now.getTime() - ABANDONED_CART_MINUTES * 60 * 1000).toISOString();
    const inactiveThreshold = new Date(now.getTime() - INACTIVE_HOURS * 60 * 60 * 1000).toISOString();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

    // 1. Get all distinct customer+store combos with recent events
    const { data: recentEvents, error: evErr } = await supabase
      .from("customer_behavior_events")
      .select("customer_id, user_id, event_type, session_id, created_at")
      .not("customer_id", "is", null)
      .gte("created_at", inactiveThreshold)
      .order("created_at", { ascending: false })
      .limit(1000);

    if (evErr) throw evErr;
    if (!recentEvents || recentEvents.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Group events by customer+store
    const grouped = new Map<string, typeof recentEvents>();
    for (const ev of recentEvents) {
      if (!ev.customer_id) continue;
      const key = `${ev.customer_id}::${ev.user_id}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(ev);
    }

    const upserts: Array<{
      customer_id: string;
      store_user_id: string;
      state: string;
      last_activity_at: string;
      state_changed_at: string;
      metadata: Record<string, unknown>;
    }> = [];

    for (const [key, events] of grouped) {
      const [customerId, storeUserId] = key.split("::");
      const lastEvent = events[0];
      const lastActivityAt = lastEvent.created_at;
      const eventTypes = new Set(events.map((e) => e.event_type));
      const sessionIds = new Set(events.filter((e) => e.session_id).map((e) => e.session_id));

      // Determine state
      let state = "browsing";

      // Check purchase_completed → active
      if (eventTypes.has("purchase_completed")) {
        state = "active";
      }
      // Check abandoned_cart: added to cart but no purchase, last event > 30min ago
      else if (
        eventTypes.has("add_to_cart") &&
        !eventTypes.has("purchase_completed") &&
        lastEvent.created_at < abandonedThreshold
      ) {
        state = "abandoned_cart";
      }
      // Check active user: multiple sessions today
      else if (sessionIds.size >= ACTIVE_MIN_SESSIONS) {
        const todaySessions = events.filter((e) => e.created_at >= todayStart);
        const todaySessionIds = new Set(todaySessions.map((e) => e.session_id));
        if (todaySessionIds.size >= ACTIVE_MIN_SESSIONS) {
          state = "active";
        }
      }
      // Check inactive: last activity older than threshold
      else if (lastEvent.created_at < inactiveThreshold) {
        state = "inactive";
      }

      // Get current state to detect transitions
      const { data: existing } = await supabase
        .from("customer_states")
        .select("state")
        .eq("customer_id", customerId)
        .eq("store_user_id", storeUserId)
        .maybeSingle();

      const stateChanged = !existing || existing.state !== state;

      upserts.push({
        customer_id: customerId,
        store_user_id: storeUserId,
        state,
        last_activity_at: lastActivityAt,
        state_changed_at: stateChanged ? now.toISOString() : (existing ? lastActivityAt : now.toISOString()),
        metadata: {
          event_count: events.length,
          session_count: sessionIds.size,
          event_types: [...eventTypes],
        },
      });
    }

    // Also mark users with NO recent events as inactive
    const { data: staleStates } = await supabase
      .from("customer_states")
      .select("customer_id, store_user_id, state")
      .neq("state", "inactive")
      .lt("last_activity_at", inactiveThreshold)
      .limit(500);

    if (staleStates) {
      for (const s of staleStates) {
        upserts.push({
          customer_id: s.customer_id,
          store_user_id: s.store_user_id,
          state: "inactive",
          last_activity_at: inactiveThreshold,
          state_changed_at: now.toISOString(),
          metadata: { reason: "no_recent_activity" },
        });
      }
    }

    // Batch upsert
    if (upserts.length > 0) {
      const { error: upsertErr } = await supabase
        .from("customer_states")
        .upsert(upserts, { onConflict: "customer_id,store_user_id" });
      if (upsertErr) throw upsertErr;
    }

    console.log(`[analyze-behavior] Processed ${upserts.length} customer states`);

    return new Response(
      JSON.stringify({ processed: upserts.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[analyze-behavior] Error:", err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
