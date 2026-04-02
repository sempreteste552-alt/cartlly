import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface StoreProductPageConfig {
  id: string;
  user_id: string;
  enable_video_gallery: boolean;
  enable_image_zoom: boolean;
  enable_sticky_add_to_cart: boolean;
  enable_reviews: boolean;
  enable_faq: boolean;
  enable_size_guide: boolean;
  size_guide_content: string | null;
  enable_related_products: boolean;
  enable_buy_together: boolean;
  enable_recently_viewed: boolean;
  enable_category_best_sellers: boolean;
  enable_stock_urgency: boolean;
  stock_urgency_threshold: number;
  enable_delivery_estimation: boolean;
  delivery_estimation_text: string;
  enable_trust_badges: boolean;
  created_at: string;
  updated_at: string;
}

export function useStoreProductPageConfig() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["store_product_page_config", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_product_page_config" as any)
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      if (!data && user) {
        const { data: created, error: createErr } = await supabase
          .from("store_product_page_config" as any)
          .insert({ user_id: user.id })
          .select()
          .single();
        if (createErr) throw createErr;
        return created as unknown as StoreProductPageConfig;
      }
      return data as unknown as StoreProductPageConfig;
    },
  });
}

export function useUpdateStoreProductPageConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<StoreProductPageConfig> & { id: string }) => {
      const { data, error } = await supabase
        .from("store_product_page_config" as any)
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store_product_page_config"] });
      toast.success("Configurações do produto salvas!");
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });
}
