import { useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export type TrackableEvent =
  | "app_open"
  | "session_start"
  | "session_end"
  | "product_view"
  | "category_view"
  | "add_to_cart"
  | "remove_from_cart"
  | "checkout_started"
  | "purchase_completed"
  | "search"
  | "inactivity_detected";

interface EventMetadata {
  product_id?: string;
  category_id?: string;
  cart_value?: number;
  search_term?: string;
  order_id?: string;
  [key: string]: unknown;
}

function getSessionId(): string {
  let sid = sessionStorage.getItem("tracker_session_id");
  if (!sid) {
    sid = crypto.randomUUID();
    sessionStorage.setItem("tracker_session_id", sid);
  }
  return sid;
}

/**
 * Lightweight event tracker for storefront user behavior.
 * Stores events in customer_behavior_events table.
 * Includes session tracking and inactivity detection.
 */
export function useEventTracker(storeUserId?: string) {
  const sessionId = useRef(getSessionId());
  const inactivityTimer = useRef<ReturnType<typeof setTimeout>>();
  const sessionStarted = useRef(false);
  const INACTIVITY_MINUTES = 10;

  // Flush event to DB – fire-and-forget
  const track = useCallback(
    (eventType: TrackableEvent, metadata?: EventMetadata) => {
      if (!storeUserId) return;

      const payload: Record<string, unknown> = {
        user_id: storeUserId,
        event_type: eventType,
        session_id: sessionId.current,
        metadata: metadata ?? {},
      };

      if (metadata?.product_id) payload.product_id = metadata.product_id;
      if (metadata?.category_id) payload.category_id = metadata.category_id;

      // Get customer_id if authenticated
      supabase.auth.getUser().then(({ data }) => {
        if (data?.user) {
          (payload as any).customer_id = null; // will be resolved by the query below
          supabase
            .from("customers")
            .select("id")
            .eq("auth_user_id", data.user.id)
            .eq("store_user_id", storeUserId)
            .maybeSingle()
            .then(({ data: cust }) => {
              if (cust) payload.customer_id = cust.id;
              supabase.from("customer_behavior_events").insert(payload as any).then(() => {});
            });
        } else {
          supabase.from("customer_behavior_events").insert(payload as any).then(() => {});
        }
      });
    },
    [storeUserId]
  );

  // --- Inactivity detection ---
  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    inactivityTimer.current = setTimeout(() => {
      track("inactivity_detected", { minutes: INACTIVITY_MINUTES });
    }, INACTIVITY_MINUTES * 60 * 1000);
  }, [track]);

  // --- Session lifecycle ---
  useEffect(() => {
    if (!storeUserId || sessionStarted.current) return;
    sessionStarted.current = true;

    track("app_open");
    track("session_start");
    resetInactivityTimer();

    // Activity listeners
    const onActivity = () => resetInactivityTimer();
    const events = ["click", "scroll", "keydown", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));

    // Session end on tab close / navigate away
    const onEnd = () => track("session_end");
    window.addEventListener("beforeunload", onEnd);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") onEnd();
      if (document.visibilityState === "visible") {
        track("app_open");
        resetInactivityTimer();
      }
    });

    return () => {
      events.forEach((e) => window.removeEventListener(e, onActivity));
      window.removeEventListener("beforeunload", onEnd);
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    };
  }, [storeUserId, track, resetInactivityTimer]);

  return { track };
}
