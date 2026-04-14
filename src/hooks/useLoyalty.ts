import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useLoyaltyConfig() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["loyalty_config", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loyalty_config" as any)
        .select("*")
        .eq("store_user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });
}

export function useUpsertLoyaltyConfig() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (config: {
      enabled: boolean;
      points_per_real: number;
      redemption_rate: number;
      min_redemption: number;
      referral_enabled?: boolean;
      referral_reward_points?: number;
      referral_reward_type?: string;
      referral_reward_description?: string;
    }) => {
      const { data: existing } = await supabase
        .from("loyalty_config" as any)
        .select("id")
        .eq("store_user_id", user!.id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("loyalty_config" as any)
          .update({ ...config, updated_at: new Date().toISOString() } as any)
          .eq("id", (existing as any).id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("loyalty_config" as any)
          .insert({ ...config, store_user_id: user!.id } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["loyalty_config"] }),
  });
}

export function useLoyaltyPoints(storeUserId?: string) {
  const { user } = useAuth();
  const uid = storeUserId || user?.id;
  return useQuery({
    queryKey: ["loyalty_points", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loyalty_points" as any)
        .select("*")
        .eq("store_user_id", uid!);
      if (error) throw error;
      return (data || []) as any[];
    },
  });
}

export function useLoyaltyTransactions(storeUserId?: string) {
  const { user } = useAuth();
  const uid = storeUserId || user?.id;
  return useQuery({
    queryKey: ["loyalty_transactions", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loyalty_transactions" as any)
        .select("*")
        .eq("store_user_id", uid!)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as any[];
    },
  });
}

export function useCustomerLoyaltyPoints(customerId?: string, storeUserId?: string) {
  return useQuery({
    queryKey: ["customer_loyalty", customerId, storeUserId],
    enabled: !!customerId && !!storeUserId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loyalty_points" as any)
        .select("*")
        .eq("customer_id", customerId!)
        .eq("store_user_id", storeUserId!)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });
}
