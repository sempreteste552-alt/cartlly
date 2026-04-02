import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface StoreMarketingConfig {
  id: string;
  user_id: string;
  announcement_bar_enabled: boolean;
  announcement_bar_text: string | null;
  announcement_bar_bg_color: string;
  announcement_bar_text_color: string;
  announcement_bar_link: string | null;
  popup_coupon_enabled: boolean;
  popup_coupon_code: string | null;
  popup_coupon_title: string | null;
  popup_coupon_description: string | null;
  popup_coupon_image_url: string | null;
  popup_coupon_delay_seconds: number;
  countdown_enabled: boolean;
  countdown_end_date: string | null;
  countdown_text: string | null;
  countdown_bg_color: string;
  countdown_text_color: string;
  free_shipping_bar_enabled: boolean;
  free_shipping_threshold: number;
  free_shipping_bar_color: string;
  trust_badges_enabled: boolean;
  trust_badges: Array<{ icon: string; label: string }>;
  created_at: string;
  updated_at: string;
}

export function useStoreMarketingConfig() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["store_marketing_config", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_marketing_config" as any)
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      if (!data && user) {
        const { data: created, error: createErr } = await supabase
          .from("store_marketing_config" as any)
          .insert({ user_id: user.id })
          .select()
          .single();
        if (createErr) throw createErr;
        return created as unknown as StoreMarketingConfig;
      }
      return data as unknown as StoreMarketingConfig;
    },
  });
}

export function useUpdateStoreMarketingConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<StoreMarketingConfig> & { id: string }) => {
      const { data, error } = await supabase
        .from("store_marketing_config" as any)
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store_marketing_config"] });
      toast.success("Marketing salvo!");
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });
}
