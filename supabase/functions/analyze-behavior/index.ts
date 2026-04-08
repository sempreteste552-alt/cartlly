import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ABANDONED_CART_MINUTES = 30;
const INACTIVE_HOURS = 24;
const ACTIVE_MIN_SESSIONS = 2;
const BROWSING_EXIT_MINUTES = 15; // User viewed products then left

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
    const browsingExitThreshold = new Date(now.getTime() - BROWSING_EXIT_MINUTES * 60 * 1000).toISOString();
    const inactiveThreshold = new Date(now.getTime() - INACTIVE_HOURS * 60 * 60 * 1000).toISOString();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

    // 1. Get all distinct customer+store combos with recent events
    const { data: recentEvents, error: evErr } = await supabase
      .from("customer_behavior_events")
      .select("customer_id, user_id, event_type, session_id, product_id, created_at")
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

    // Collect retargeting sequence triggers
    const retargetingTriggers: Array<{
      customer_id: string;
      store_user_id: string;
      product_id: string;
    }> = [];

    for (const [key, events] of grouped) {
      const [customerId, storeUserId] = key.split("::");
      const lastEvent = events[0];
      const lastActivityAt = lastEvent.created_at;
      const eventTypes = new Set(events.map((e) => e.event_type));
      const sessionIds = new Set(events.filter((e) => e.session_id).map((e) => e.session_id));

      // Determine state
      let state = "browsing";

      // Check purchase_completed → active (and stop any active retargeting)
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
      // Check browsing_exit: viewed products, no add_to_cart, no purchase, last event > 15min ago
      else if (
        eventTypes.has("product_view") &&
        !eventTypes.has("add_to_cart") &&
        !eventTypes.has("purchase_completed") &&
        lastEvent.created_at < browsingExitThreshold
      ) {
        state = "browsing_exit";

        // Collect viewed product IDs for retargeting sequences
        const viewedProductIds = new Set<string>();
        for (const ev of events) {
          if (ev.event_type === "product_view" && ev.product_id) {
            viewedProductIds.add(ev.product_id);
          }
        }
        // Take last 5 viewed products for retargeting
        const productArr = [...viewedProductIds].slice(0, 5);
        for (const pid of productArr) {
          retargetingTriggers.push({
            customer_id: customerId,
            store_user_id: storeUserId,
            product_id: pid,
          });
        }
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

      // STOP CONDITIONS: If user returned (active/browsing), stop active retargeting sequences
      if (state === "active" || (state === "browsing" && existing?.state !== "browsing")) {
        await supabase
          .from("retargeting_sequences")
          .update({ status: "stopped", stopped_reason: state === "active" ? "purchased" : "user_returned" })
          .eq("customer_id", customerId)
          .eq("store_user_id", storeUserId)
          .eq("status", "active");
      }
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

    // Batch upsert states
    if (upserts.length > 0) {
      const { error: upsertErr } = await supabase
        .from("customer_states")
        .upsert(upserts, { onConflict: "customer_id,store_user_id" });
      if (upsertErr) throw upsertErr;
    }

    // Create retargeting sequences for browsing_exit users
    let sequencesCreated = 0;
    for (const trigger of retargetingTriggers) {
      // Check if active sequence already exists for this customer+product
      const { data: existing } = await supabase
        .from("retargeting_sequences")
        .select("id")
        .eq("customer_id", trigger.customer_id)
        .eq("store_user_id", trigger.store_user_id)
        .eq("product_id", trigger.product_id)
        .eq("status", "active")
        .maybeSingle();

      if (existing) continue; // Already has active sequence

      // Also check if we already sent max pushes for this product (max 3 per product ever)
      const { count } = await supabase
        .from("retargeting_sequences")
        .select("id", { count: "exact", head: true })
        .eq("customer_id", trigger.customer_id)
        .eq("product_id", trigger.product_id)
        .gte("pushes_sent", 3);

      if ((count || 0) > 0) continue; // Already maxed out for this product

      // Random delay for step 1: 15-30 minutes from now
      const delayMinutes = 15 + Math.random() * 15;
      const nextPushAt = new Date(now.getTime() + delayMinutes * 60 * 1000).toISOString();

      const { error: insertErr } = await supabase
        .from("retargeting_sequences")
        .insert({
          customer_id: trigger.customer_id,
          store_user_id: trigger.store_user_id,
          product_id: trigger.product_id,
          current_step: 1,
          max_steps: 3,
          status: "active",
          next_push_at: nextPushAt,
        });

      if (!insertErr) sequencesCreated++;
    }

    console.log(`[analyze-behavior] Processed ${upserts.length} states, created ${sequencesCreated} retargeting sequences`);

    return new Response(
      JSON.stringify({ processed: upserts.length, sequences_created: sequencesCreated }),
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
