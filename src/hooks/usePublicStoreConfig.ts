import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { StoreHomeSection } from "./useStoreHomeSections";
import type { StoreThemeConfig } from "./useStoreThemeConfig";
import type { StoreMarketingConfig } from "./useStoreMarketingConfig";
import type { StoreProductPageConfig } from "./useStoreProductPageConfig";

export function usePublicHomeSections(storeUserId?: string) {
  return useQuery({
    queryKey: ["public_home_sections", storeUserId],
    enabled: !!storeUserId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_home_sections" as any)
        .select("*")
        .eq("user_id", storeUserId!)
        .eq("enabled", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as StoreHomeSection[];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
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
        .maybeSingle();
      if (error) throw error;
      return data as unknown as StoreThemeConfig | null;
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
}

export function usePublicMarketingConfig(storeUserId?: string) {
  return useQuery({
    queryKey: ["public_marketing_config", storeUserId],
    enabled: !!storeUserId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_marketing_config_public" as any)
        .select("*")
        .eq("user_id", storeUserId!)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as StoreMarketingConfig | null;
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
}

export function usePublicProductPageConfig(storeUserId?: string) {
  return useQuery({
    queryKey: ["public_product_page_config", storeUserId],
    enabled: !!storeUserId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_product_page_config" as any)
        .select("*")
        .eq("user_id", storeUserId!)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as StoreProductPageConfig | null;
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
}
