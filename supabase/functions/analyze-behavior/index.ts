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

/**
 * analyze-behavior: Processes customer_behavior_events and updates customer_states.
 * Runs every 5 minutes via cron.
 * 
 * This function:
 * 1. Reads recent behavior events (last 10 min)
 * 2. Updates customer_states with latest activity, intent level, etc.
 * 3. Detects inactivity and marks customers accordingly
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    // 1. Get recent behavior events
    const { data: events, error: evErr } = await supabase
      .from("customer_behavior_events")
      .select("customer_id, user_id, event_type, product_id, metadata, created_at")
      .gte("created_at", tenMinAgo)
      .not("customer_id", "is", null)
      .order("created_at", { ascending: false });

    if (evErr) {
      console.error("[analyze-behavior] Query error:", evErr);
      return json({ error: evErr.message }, 500);
    }

    if (!events || events.length === 0) {
      console.log("[analyze-behavior] No recent events");
      return json({ processed: 0, message: "No recent events" });
    }

    // 2. Group events by customer
    const customerEvents = new Map<string, typeof events>();
    for (const ev of events) {
      if (!ev.customer_id) continue;
      const existing = customerEvents.get(ev.customer_id) || [];
      existing.push(ev);
      customerEvents.set(ev.customer_id, existing);
    }

    let updated = 0;

    for (const [customerId, evts] of customerEvents) {
      const latestEvent = evts[0]; // already sorted desc
      const storeUserId = latestEvent.user_id;
      const eventTypes = evts.map(e => e.event_type);

      // Determine intent level
      let intentLevel = "low";
      if (eventTypes.includes("add_to_cart")) {
        intentLevel = "high";
      } else if (eventTypes.filter(t => t === "product_view").length >= 3) {
        intentLevel = "high";
      } else if (eventTypes.includes("product_view")) {
        intentLevel = "medium";
      }

      // Determine state
      let state = "browsing";
      if (eventTypes.includes("add_to_cart")) {
        state = "cart_active";
      } else if (eventTypes.includes("session_end")) {
        state = "session_ended";
      }

      // Get last viewed product
      const lastProductView = evts.find(e => e.event_type === "product_view" && e.product_id);
      const lastProductId = lastProductView?.product_id || null;

      // Get product name if available
      let lastProductName: string | null = null;
      if (lastProductId) {
        const { data: product } = await supabase
          .from("products")
          .select("name")
          .eq("id", lastProductId)
          .single();
        lastProductName = product?.name || null;
      }

      // Upsert customer state
      const { error: upsertErr } = await supabase
        .from("customer_states")
        .upsert({
          customer_id: customerId,
          store_user_id: storeUserId,
          state,
          intent_level: intentLevel,
          last_activity_at: latestEvent.created_at,
          state_changed_at: new Date().toISOString(),
          last_product_id: lastProductId,
          last_product_name: lastProductName,
          metadata: {
            recent_events: eventTypes.slice(0, 10),
            event_count: evts.length,
          },
        }, { onConflict: "customer_id,store_user_id" });

      // Update customer view stats for product_view events
      if (lastProductId && eventTypes.includes("product_view")) {
        try {
          const { error: statsErr } = await supabase.rpc("increment_customer_view_count", {
            p_customer_id: customerId,
            p_product_id: lastProductId
          });
          
          if (statsErr) console.error(`[analyze-behavior] Stats error for ${customerId}:`, statsErr);
          
          // Check if view count reached 10
          const { data: stats } = await supabase
            .from("customer_view_stats")
            .select("view_count")
            .eq("customer_id", customerId)
            .eq("product_id", lastProductId)
            .maybeSingle();

          if (stats && stats.view_count >= 10) {
            intentLevel = "very_high";
            // Trigger 10x view special discount
            await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/recover-abandoned-carts`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
              },
              body: JSON.stringify({
                trigger_type: "product_view_10x",
                customer_id: customerId,
                store_user_id: storeUserId,
                product_id: lastProductId,
              }),
            });
            console.log(`[analyze-behavior] Triggered product_view_10x for ${customerId}`);
          } else if (intentLevel === "high") {
            // Standard recovery
            await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/recover-abandoned-carts`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
              },
              body: JSON.stringify({
                trigger_type: "product_view",
                customer_id: customerId,
                store_user_id: storeUserId,
                product_id: lastProductId,
              }),
            });
            console.log(`[analyze-behavior] Triggered product_view recovery for ${customerId}`);
          }
        } catch (err) {
          console.error(`[analyze-behavior] Failed to process views for ${customerId}:`, err);
        }
      }

      if (upsertErr) {
        console.error(`[analyze-behavior] Upsert error for ${customerId}:`, upsertErr);
      } else {
        updated++;
      }
    }

    // 3. Mark inactive customers (no events in 24h but had events in last 7d)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { error: inactiveErr } = await supabase
      .from("customer_states")
      .update({
        state: "inactive",
        state_changed_at: new Date().toISOString(),
      })
      .lt("last_activity_at", oneDayAgo)
      .neq("state", "inactive");

    if (inactiveErr) {
      console.error("[analyze-behavior] Inactive update error:", inactiveErr);
    }

    console.log(`[analyze-behavior] Updated ${updated} customer states from ${events.length} events`);
    return json({ processed: events.length, updated });
  } catch (error: any) {
    console.error("[analyze-behavior] Fatal error:", error);
    return json({ error: error.message }, 500);
  }
});
