import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCustomerAuth } from "./useCustomerAuth";
import { toast } from "sonner";

export function useWishlist(storeUserId?: string) {
  const { customer } = useCustomerAuth();
  const [wishlistIds, setWishlistIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const loadWishlist = useCallback(async () => {
    if (!customer?.id) {
      setWishlistIds(new Set());
      return;
    }
    const { data } = await supabase
      .from("customer_wishlist" as any)
      .select("product_id")
      .eq("customer_id", customer.id);
    if (data) {
      setWishlistIds(new Set((data as any[]).map((d) => d.product_id)));
    }
  }, [customer?.id]);

  useEffect(() => {
    loadWishlist();
  }, [loadWishlist]);

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
        toast.success("Removido dos favoritos");
      } else {
        await supabase
          .from("customer_wishlist" as any)
          .insert({ customer_id: customer.id, product_id: productId, store_user_id: storeUserId } as any);
        setWishlistIds((prev) => new Set(prev).add(productId));
        toast.success("Adicionado aos favoritos ❤️");
      }
    } catch {
      toast.error("Erro ao atualizar favoritos");
    } finally {
      setLoading(false);
    }
  };

  const isWishlisted = (productId: string) => wishlistIds.has(productId);

  return { wishlistIds, toggleWishlist, isWishlisted, loading, wishlistCount: wishlistIds.size };
}
