import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isPlatformHost, normalizeDomain } from "@/lib/storeDomain";

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
        .from("store_settings_public")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function usePublicThemeConfig(storeUserId?: string) {
  return useQuery({
    queryKey: ["public_theme_config", storeUserId],
    enabled: !!storeUserId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_theme_config" as any)
        .select("*")
        .eq("user_id", storeUserId!)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });
}

export function usePublicStoreBySlug(slug: string | undefined) {
  return useQuery({
    queryKey: ["public_store_settings_slug", slug],
    enabled: !!slug,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_settings_public")
        .select("*")
        .eq("store_slug", slug!)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useResolvedPublicStore(slug?: string) {
  const hostname = typeof window !== "undefined" ? normalizeDomain(window.location.hostname) : "";
  const shouldResolveByDomain = !slug && hostname && !isPlatformHost(hostname);

  return useQuery({
    queryKey: ["public_store_settings_resolved", slug, hostname],
    enabled: !!slug || shouldResolveByDomain,
    queryFn: async () => {
      // 1. Resolve by slug (explicit)
      if (slug) {
        const { data, error } = await supabase
          .from("store_settings_public")
          .select("*")
          .eq("store_slug", slug)
          .maybeSingle();
        if (error) throw error;
        return data;
      }

      // 2. Resolve by custom domain (store_domains table)
      if (shouldResolveByDomain) {
        // First try the new store_domains table
        const { data: domainData, error: domainError } = await supabase
          .from("store_domains")
          .select("store_id, is_primary")
          .eq("hostname", hostname)
          .maybeSingle();

        if (domainError) throw domainError;

        if (domainData) {
          const { data: storeData, error: storeError } = await supabase
            .from("store_settings_public")
            .select("*")
            .eq("id", domainData.store_id)
            .maybeSingle();
          
          if (storeError) throw storeError;
          return storeData;
        }

        // Fallback to legacy custom_domain in store_settings (for backward compatibility)
        const { data: legacyData, error: legacyError } = await supabase
          .from("store_settings_public")
          .select("*")
          .eq("custom_domain", hostname)
          .eq("domain_status", "verified")
          .maybeSingle();

        if (legacyError) throw legacyError;
        return legacyData;
      }

      return null;
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

export function useBestSellingProducts(storeUserId?: string) {
  return useQuery({
    queryKey: ["best_selling_products", storeUserId],
    enabled: !!storeUserId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_best_selling_products", {
        _store_user_id: storeUserId!,
        _limit: 10,
      });
      if (error) throw error;
      return new Set((data as any[])?.map((d: any) => d.product_id) ?? []);
    },
  });
}

export function usePublicProductPageConfig(storeUserId?: string) {
  return useQuery({
    queryKey: ["public_product_page_config", storeUserId],
    enabled: !!storeUserId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_product_page_config")
        .select("*")
        .eq("user_id", storeUserId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}
