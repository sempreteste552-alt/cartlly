import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function usePublicProducts(storeUserId?: string) {
  return useQuery({
    queryKey: ["public_products", storeUserId],
    enabled: !!storeUserId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*, categories(name)")
        .eq("published", true)
        .eq("user_id", storeUserId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function usePublicStoreSettings() {
  return useQuery({
    queryKey: ["public_store_settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_settings_public" as any)
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function usePublicStoreBySlug(slug: string | undefined) {
  return useQuery({
    queryKey: ["public_store_settings_slug", slug],
    enabled: !!slug,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_settings_public" as any)
        .select("*")
        .eq("store_slug", slug!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function usePublicCategories(storeUserId?: string) {
  return useQuery({
    queryKey: ["public_categories", storeUserId],
    enabled: !!storeUserId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .eq("user_id", storeUserId!)
        .order("name");
      if (error) throw error;
      return data;
    },
  });
}

// Bulk reviews for star ratings on product cards
export function useAllProductReviews(productIds: string[]) {
  return useQuery({
    queryKey: ["all_product_reviews", productIds],
    enabled: productIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_reviews")
        .select("product_id, rating")
        .in("product_id", productIds);
      if (error) throw error;
      const map: Record<string, { sum: number; count: number }> = {};
      data?.forEach((r: any) => {
        if (!map[r.product_id]) map[r.product_id] = { sum: 0, count: 0 };
        map[r.product_id].sum += r.rating;
        map[r.product_id].count += 1;
      });
      const result: Record<string, { average: number; count: number }> = {};
      Object.entries(map).forEach(([pid, { sum, count }]) => {
        result[pid] = { average: sum / count, count };
      });
      return result;
    },
  });
}
