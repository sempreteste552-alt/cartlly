import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ABANDONED_CART_MINUTES = 30;
const INACTIVE_HOURS = 24;
const ACTIVE_MIN_SESSIONS = 2;
const BROWSING_EXIT_MINUTES = 15;
const LOW_STOCK_THRESHOLD = 5;

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

    // 1. Get recent events
    const { data: recentEvents, error: evErr } = await supabase
      .from("customer_behavior_events")
      .select("customer_id, user_id, event_type, session_id, product_id, created_at")
      .not("customer_id", "is", null)
      .gte("created_at", inactiveThreshold)
      .order("created_at", { ascending: false })
      .limit(1000);

    if (evErr) throw evErr;
    if (!recentEvents || recentEvents.length === 0) {
      return respond({ processed: 0 });
    }

    // Group events by customer+store
    const grouped = new Map<string, typeof recentEvents>();
    for (const ev of recentEvents) {
      if (!ev.customer_id) continue;
      const key = `${ev.customer_id}::${ev.user_id}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(ev);
    }

    // Collect all product IDs for stock/discount lookups
    const allProductIds = new Set<string>();
    for (const events of grouped.values()) {
      for (const ev of events) {
        if (ev.product_id) allProductIds.add(ev.product_id);
      }
    }

    // Batch lookup products for stock info
    const productInfoMap = new Map<string, { name: string; stock: number; price: number }>();
    if (allProductIds.size > 0) {
      const { data: products } = await supabase
        .from("products")
        .select("id, name, stock, price")
        .in("id", [...allProductIds]);
      for (const p of products || []) {
        productInfoMap.set(p.id, { name: p.name, stock: p.stock, price: p.price });
      }
    }

    // Batch lookup active coupons per store
    const allStoreIds = new Set<string>();
    for (const events of grouped.values()) {
      if (events[0]) allStoreIds.add(events[0].user_id);
    }
    const storeHasDiscount = new Set<string>();
    if (allStoreIds.size > 0) {
      const { data: activeCoupons } = await supabase
        .from("coupons")
        .select("user_id")
        .eq("active", true)
        .in("user_id", [...allStoreIds])
        .limit(100);
      for (const c of activeCoupons || []) {
        storeHasDiscount.add(c.user_id);
      }
    }

    const upserts: Array<Record<string, unknown>> = [];
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

      // ── Intent detection ──────────────────────────────────────────
      let intentLevel = "low";

      // Count product views per product
      const productViewCounts = new Map<string, number>();
      for (const ev of events) {
        if (ev.event_type === "product_view" && ev.product_id) {
          productViewCounts.set(ev.product_id, (productViewCounts.get(ev.product_id) || 0) + 1);
        }
      }
      const hasMultipleViews = [...productViewCounts.values()].some((c) => c >= 2);

      if (eventTypes.has("checkout_started") || eventTypes.has("add_to_cart")) {
        intentLevel = "high";
      } else if (hasMultipleViews || sessionIds.size >= 2) {
        intentLevel = "medium";
      }

      // Returning user detection
      if (sessionIds.size >= 3) {
        intentLevel = "high";
      }

      // ── Last viewed/carted product ────────────────────────────────
      let lastProductId: string | undefined;
      for (const ev of events) {
        if ((ev.event_type === "add_to_cart" || ev.event_type === "product_view") && ev.product_id) {
          lastProductId = ev.product_id;
          break;
        }
      }
      const lastProductInfo = lastProductId ? productInfoMap.get(lastProductId) : undefined;
      const isLowStock = lastProductInfo ? lastProductInfo.stock <= LOW_STOCK_THRESHOLD && lastProductInfo.stock > 0 : false;
      const hasDiscount = storeHasDiscount.has(storeUserId);

      // ── State detection ───────────────────────────────────────────
      let state = "browsing";

      if (eventTypes.has("purchase_completed")) {
        state = "active";
        intentLevel = "high"; // Buyers are high intent
      } else if (
        eventTypes.has("add_to_cart") &&
        !eventTypes.has("purchase_completed") &&
        lastEvent.created_at < abandonedThreshold
      ) {
        state = "abandoned_cart";
      } else if (
        eventTypes.has("product_view") &&
        !eventTypes.has("add_to_cart") &&
        !eventTypes.has("purchase_completed") &&
        lastEvent.created_at < browsingExitThreshold
      ) {
        state = "browsing_exit";

        // Collect viewed products for retargeting
        const viewedProductIds = new Set<string>();
        for (const ev of events) {
          if (ev.event_type === "product_view" && ev.product_id) {
            viewedProductIds.add(ev.product_id);
          }
        }
        for (const pid of [...viewedProductIds].slice(0, 5)) {
          retargetingTriggers.push({
            customer_id: customerId,
            store_user_id: storeUserId,
            product_id: pid,
          });
        }
      } else if (sessionIds.size >= ACTIVE_MIN_SESSIONS) {
        const todaySessions = events.filter((e) => e.created_at >= todayStart);
        const todaySessionIds = new Set(todaySessions.map((e) => e.session_id));
        if (todaySessionIds.size >= ACTIVE_MIN_SESSIONS) {
          state = "active";
        }
      } else if (lastEvent.created_at < inactiveThreshold) {
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
        intent_level: intentLevel,
        low_stock: isLowStock,
        discount_available: hasDiscount,
        last_product_id: lastProductId || null,
        last_product_name: lastProductInfo?.name || null,
        last_activity_at: lastActivityAt,
        state_changed_at: stateChanged ? now.toISOString() : lastActivityAt,
        metadata: {
          event_count: events.length,
          session_count: sessionIds.size,
          event_types: [...eventTypes],
          product_view_counts: Object.fromEntries(productViewCounts),
        },
      });

      // STOP CONDITIONS: If user returned/purchased, stop retargeting
      if (state === "active" || (state === "browsing" && existing?.state !== "browsing")) {
        await supabase
          .from("retargeting_sequences")
          .update({ status: "stopped", stopped_reason: state === "active" ? "purchased" : "user_returned" })
          .eq("customer_id", customerId)
          .eq("store_user_id", storeUserId)
          .eq("status", "active");
      }
    }

    // Mark stale users as inactive
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
          intent_level: "low",
          low_stock: false,
          discount_available: false,
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
        .upsert(upserts as any[], { onConflict: "customer_id,store_user_id" });
      if (upsertErr) throw upsertErr;
    }

    // Create retargeting sequences for browsing_exit users
    let sequencesCreated = 0;
    for (const trigger of retargetingTriggers) {
      const { data: existing } = await supabase
        .from("retargeting_sequences")
        .select("id")
        .eq("customer_id", trigger.customer_id)
        .eq("store_user_id", trigger.store_user_id)
        .eq("product_id", trigger.product_id)
        .eq("status", "active")
        .maybeSingle();

      if (existing) continue;

      const { count } = await supabase
        .from("retargeting_sequences")
        .select("id", { count: "exact", head: true })
        .eq("customer_id", trigger.customer_id)
        .eq("product_id", trigger.product_id)
        .gte("pushes_sent", 3);

      if ((count || 0) > 0) continue;

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

    console.log(`[analyze-behavior] Processed ${upserts.length} states, ${sequencesCreated} sequences, intents: ${upserts.filter(u => u.intent_level === 'high').length} high`);

    return respond({ processed: upserts.length, sequences_created: sequencesCreated });
  } catch (err: any) {
    console.error("[analyze-behavior] Error:", err.message);
    return respond({ error: err.message }, 500);
  }
});

function respond(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
