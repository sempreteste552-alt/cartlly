import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

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

export function useCart(slug?: string) {
  const [items, setItems] = useState<CartItem[]>(() => loadCartFromStorage(slug));
  const slugRef = useRef(slug);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout>>();

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
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

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
    if (!session?.user) return; // Only sync for authenticated users

    const userId = session.user.id;

    // Find the customer record & store owner for this session
    const { data: customerData } = await supabase
      .from("customers")
      .select("id, store_user_id")
      .eq("auth_user_id", userId)
      .limit(1)
      .maybeSingle();

    if (!customerData) return; // Not a customer, skip

    const total = items.reduce((s, i) => s + i.price * i.quantity, 0);
    const sessionId = `${slug || "default"}_${userId}`;

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
