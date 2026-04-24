import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useBehaviorTracking } from "./useBehaviorTracking";

export interface CartItem {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  quantity: number;
}

interface CartState {
  items: CartItem[];
  updatedAt: number;
}

function getStorageKey(slug?: string) {
  return `cart_${slug || "default"}`;
}

function loadCartFromStorage(slug?: string): CartItem[] {
  try {
    const raw = localStorage.getItem(getStorageKey(slug));
    if (!raw) return [];
    const state: CartState = JSON.parse(raw);
    if (Date.now() - state.updatedAt > 7 * 24 * 60 * 60 * 1000) {
      localStorage.removeItem(getStorageKey(slug));
      return [];
    }
    return state.items || [];
  } catch {
    return [];
  }
}

function saveCartToStorage(items: CartItem[], slug?: string) {
  try {
    const state: CartState = { items, updatedAt: Date.now() };
    localStorage.setItem(getStorageKey(slug), JSON.stringify(state));
  } catch { /* quota exceeded */ }
}

export function useCart(slug?: string, storeUserId?: string) {
  const [items, setItems] = useState<CartItem[]>(() => loadCartFromStorage(slug));
  const slugRef = useRef(slug);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const { trackEvent } = useBehaviorTracking(storeUserId);

  useEffect(() => {
    if (slugRef.current !== slug) {
      slugRef.current = slug;
      setItems(loadCartFromStorage(slug));
    }
  }, [slug]);

  // Persist to localStorage + sync abandoned cart to DB (debounced)
  useEffect(() => {
    saveCartToStorage(items, slugRef.current);

    // Debounce DB sync by 5 seconds
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    if (items.length > 0) {
      syncTimerRef.current = setTimeout(() => {
        syncAbandonedCart(items, slugRef.current);
      }, 5000);
    }

    return () => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
  }, [items]);

  const addItem = useCallback((product: Omit<CartItem, "quantity">) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.id === product.id);
      if (existing) {
        return prev.map((i) => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { ...product, quantity: 1 }];
    });
    trackEvent("add_to_cart", product.id, { name: product.name, price: product.price });
  }, [trackEvent]);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    trackEvent("remove_from_cart", id);
  }, [trackEvent]);

  const updateQuantity = useCallback((id: string, quantity: number) => {
    if (quantity <= 0) {
      setItems((prev) => prev.filter((i) => i.id !== id));
      return;
    }
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, quantity } : i));
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const count = items.reduce((sum, i) => sum + i.quantity, 0);

  return { items, addItem, removeItem, updateQuantity, clearCart, total, count };
}

/** Sync cart to abandoned_carts table for recovery automation */
async function syncAbandonedCart(items: CartItem[], slug?: string) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const sessionId = localStorage.getItem("store_session_id") || `cart_${Math.random().toString(36).substring(2, 15)}`;
    if (!localStorage.getItem("store_session_id")) localStorage.setItem("store_session_id", sessionId);

    const authUserId = session?.user?.id;
    let customerId = null;
    let storeOwnerId = storeUserId;

    // Find the customer record for this session if authenticated
    if (authUserId) {
      const { data: customerData } = await supabase
        .from("customers")
        .select("id, store_user_id")
        .eq("auth_user_id", authUserId)
        .limit(1)
        .maybeSingle();
      
      if (customerData) {
        customerId = customerData.id;
        storeOwnerId = customerData.store_user_id;
      }
    }

    if (!storeOwnerId) return; // Need a store context to sync

    const total = items.reduce((s, i) => s + i.price * i.quantity, 0);
    const uniqueSessionKey = `${slug || "default"}_${authUserId || sessionId}`;

    // Upsert: update existing or create new abandoned cart
    await supabase.from("abandoned_carts").upsert(
      {
        user_id: customerData.store_user_id,
        customer_id: customerData.id,
        session_id: sessionId,
        items: items.map(i => ({ id: i.id, name: i.name, price: i.price, quantity: i.quantity, image_url: i.image_url })),
        total,
        abandoned_at: new Date().toISOString(),
        recovered: false,
      },
      { onConflict: "session_id" }
    );
  } catch (err) {
    // Silent fail - don't disrupt shopping experience
    console.error("Abandoned cart sync error:", err);
  }
}
