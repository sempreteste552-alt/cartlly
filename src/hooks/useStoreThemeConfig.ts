import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";

export interface StoreThemeConfig {
  id: string;
  user_id: string;
  favicon_url: string | null;
  font_heading: string;
  font_body: string;
  card_border_radius: number;
  card_shadow: string;
  layout_width: string;
  product_grid_columns: number;
  product_grid_columns_mobile: number;
  product_grid_gap: number;
  header_style: string;
  footer_style: string;
  custom_css: string | null;
  primary_color: string;
  secondary_color: string;
  background_color: string;
  text_color: string;
  theme_mode: 'light' | 'dark' | 'system';
  created_at: string;
  updated_at: string;
}

export function useStoreThemeConfig() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["store_theme_config", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_theme_config" as any)
        .select("*")
        .eq("user_id", user!.id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data && user) {
        const { data: created, error: createErr } = await supabase
          .from("store_theme_config" as any)
          .insert({ user_id: user.id })
          .select()
          .single();
        if (createErr) throw createErr;
        return created as unknown as StoreThemeConfig;
      }
      return data as unknown as StoreThemeConfig;
    },
  });
}

export function useUpdateStoreThemeConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<StoreThemeConfig> & { id: string }) => {
      const { data, error } = await supabase
        .from("store_theme_config" as any)
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store_theme_config"] });
      toast.success("Tema salvo!");
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });
}
