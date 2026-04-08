import { useState, useCallback, useEffect, useRef } from "react";

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
    // Expire carts older than 7 days
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

  // Re-load when slug changes
  useEffect(() => {
    if (slugRef.current !== slug) {
      slugRef.current = slug;
      setItems(loadCartFromStorage(slug));
    }
  }, [slug]);

  // Persist on every change
  useEffect(() => {
    saveCartToStorage(items, slugRef.current);
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
