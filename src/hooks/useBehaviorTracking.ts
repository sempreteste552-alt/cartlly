import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCustomerAuth } from "./useCustomerAuth";

export type BehaviorEventType = 
  | "product_view" 
  | "add_to_cart" 
  | "remove_from_cart" 
  | "add_to_wishlist" 
  | "remove_from_wishlist" 
  | "session_start" 
  | "session_end"
  | "cart_checkout_start";

export function useBehaviorTracking(storeUserId?: string) {
  const { customer } = useCustomerAuth();

  const trackEvent = useCallback(async (eventType: BehaviorEventType, productId?: string, metadata: any = {}) => {
    if (!storeUserId) return;

    try {
      const sessionId = localStorage.getItem("store_session_id") || 
        Math.random().toString(36).substring(2, 15);
      
      if (!localStorage.getItem("store_session_id")) {
        localStorage.setItem("store_session_id", sessionId);
      }

      await supabase.from("customer_behavior_events").insert({
        user_id: storeUserId,
        customer_id: customer?.id || null,
        session_id: sessionId,
        event_type: eventType,
        product_id: productId || null,
        metadata: {
          ...metadata,
          url: window.location.href,
          timestamp: new Date().toISOString(),
        }
      });
    } catch (error) {
      console.error("[useBehaviorTracking] Error tracking event:", error);
    }
  }, [customer?.id, storeUserId]);

  return { trackEvent };
}
