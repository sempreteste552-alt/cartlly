import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useCustomerReferrals() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["customer_referrals", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_referrals")
        .select(`
          *,
          referrer:referrer_id (name, email),
          referred:referred_id (name, email)
        `)
        .eq("store_user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useCustomerReferralStats() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["customer_referral_stats", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: referrals, error } = await supabase
        .from("customer_referrals")
        .select("status, reward_type")
        .eq("store_user_id", user!.id);
      
      if (error) throw error;

      return {
        total: referrals?.length || 0,
        completed: referrals?.filter(r => r.status === "completed").length || 0,
        pending: referrals?.filter(r => r.status === "pending").length || 0,
      };
    },
  });
}
