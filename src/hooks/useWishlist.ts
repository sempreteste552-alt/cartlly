import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCustomerAuth } from "./useCustomerAuth";
import { toast } from "sonner";
import { useBehaviorTracking } from "./useBehaviorTracking";

function getWishlistKey(customerId?: string) {
  return `wishlist_${customerId || "anon"}`;
}

function loadWishlistCache(customerId?: string): string[] {
  try {
    const raw = localStorage.getItem(getWishlistKey(customerId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveWishlistCache(ids: string[], customerId?: string) {
  try {
    localStorage.setItem(getWishlistKey(customerId), JSON.stringify(ids));
  } catch { /* quota */ }
}

export function useWishlist(storeUserId?: string) {
  const { customer } = useCustomerAuth();
  const [wishlistIds, setWishlistIds] = useState<Set<string>>(() => new Set(loadWishlistCache(customer?.id)));
  const [wishlistProducts, setWishlistProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { trackEvent } = useBehaviorTracking(storeUserId);

  const loadWishlist = useCallback(async () => {
    if (!customer?.id) {
      setWishlistIds(new Set());
      setWishlistProducts([]);
      return;
    }
    const { data } = await supabase
      .from("customer_wishlist" as any)
      .select("product_id")
      .eq("customer_id", customer.id);
    if (data) {
      const ids = (data as any[]).map((d) => d.product_id);
      setWishlistIds(new Set(ids));
      saveWishlistCache(ids, customer.id);
      if (ids.length > 0) {
        const { data: products } = await supabase
          .from("products")
          .select("id, name, price, image_url")
          .in("id", ids);
        setWishlistProducts(products || []);
      } else {
        setWishlistProducts([]);
      }
    }
  }, [customer?.id]);

  useEffect(() => {
    loadWishlist();
  }, [loadWishlist]);

  // Sync cache whenever IDs change
  useEffect(() => {
    if (customer?.id) {
      saveWishlistCache(Array.from(wishlistIds), customer.id);
    }
  }, [wishlistIds, customer?.id]);

  const toggleWishlist = async (productId: string) => {
    if (!customer?.id || !storeUserId) {
      toast.error("Faça login para salvar favoritos ❤️");
      return;
    }
    setLoading(true);
    try {
      if (wishlistIds.has(productId)) {
        await supabase
          .from("customer_wishlist" as any)
          .delete()
          .eq("customer_id", customer.id)
          .eq("product_id", productId);
        setWishlistIds((prev) => {
          const next = new Set(prev);
          next.delete(productId);
          return next;
        });
        await trackEvent("remove_from_wishlist", productId);
        toast.success("Removido dos favoritos");
      } else {
        await supabase
          .from("customer_wishlist" as any)
          .insert({ customer_id: customer.id, product_id: productId, store_user_id: storeUserId } as any);
        setWishlistIds((prev) => new Set(prev).add(productId));
        await trackEvent("add_to_wishlist", productId);
        toast.success("Adicionado aos favoritos ❤️");
      }
    } catch {
      toast.error("Erro ao atualizar favoritos");
    } finally {
      setLoading(false);
    }
  };

  const isWishlisted = (productId: string) => wishlistIds.has(productId);

  return { wishlistIds, wishlistProducts, toggleWishlist, isWishlisted, loading, wishlistCount: wishlistIds.size };
}
