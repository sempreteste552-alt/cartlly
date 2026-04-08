import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface RestockAlert {
  id: string;
  user_id: string;
  title: string;
  subtitle: string | null;
  cta_text: string;
  product_ids: string[];
  active: boolean;
  push_enabled: boolean;
  push_title: string | null;
  push_body: string | null;
  bg_color: string;
  text_color: string;
  card_bg_color: string;
  accent_color: string;
  created_at: string;
  updated_at: string;
}

export function usePublicRestockAlert(storeUserId?: string) {
  return useQuery({
    queryKey: ["public_restock_alert", storeUserId],
    enabled: !!storeUserId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_restock_alerts" as any)
        .select("*")
        .eq("user_id", storeUserId!)
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as RestockAlert | null;
    },
  });
}

export function useRestockAlert() {
  return useQuery({
    queryKey: ["admin_restock_alert"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data, error } = await supabase
        .from("store_restock_alerts" as any)
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as RestockAlert | null;
    },
  });
}

export function useUpsertRestockAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (alert: Partial<RestockAlert> & { user_id: string }) => {
      if (alert.id) {
        const { error } = await supabase
          .from("store_restock_alerts" as any)
          .update({
            title: alert.title,
            subtitle: alert.subtitle,
            cta_text: alert.cta_text,
            product_ids: alert.product_ids,
            active: alert.active,
            push_enabled: alert.push_enabled,
            push_title: alert.push_title,
            push_body: alert.push_body,
            bg_color: alert.bg_color,
            text_color: alert.text_color,
            card_bg_color: alert.card_bg_color,
            accent_color: alert.accent_color,
            updated_at: new Date().toISOString(),
          } as any)
          .eq("id", alert.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("store_restock_alerts" as any)
          .insert({
            user_id: alert.user_id,
            title: alert.title,
            subtitle: alert.subtitle,
            cta_text: alert.cta_text,
            product_ids: alert.product_ids,
            active: alert.active ?? true,
            push_enabled: alert.push_enabled ?? false,
            push_title: alert.push_title,
            push_body: alert.push_body,
            bg_color: alert.bg_color ?? '#6d28d9',
            text_color: alert.text_color ?? '#ffffff',
            card_bg_color: alert.card_bg_color ?? '#ffffff',
            accent_color: alert.accent_color ?? '#6d28d9',
          } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin_restock_alert"] });
      qc.invalidateQueries({ queryKey: ["public_restock_alert"] });
    },
  });
}
