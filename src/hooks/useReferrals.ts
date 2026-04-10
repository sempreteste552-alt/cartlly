import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export function useReferralCode() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["referral_code", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("referral_codes" as any)
        .select("*")
        .eq("tenant_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        // Auto-create if missing
        const code = Math.random().toString(36).substring(2, 10).toUpperCase();
        const { data: created, error: createErr } = await supabase
          .from("referral_codes" as any)
          .insert({ tenant_id: user!.id, code })
          .select()
          .single();
        if (createErr) throw createErr;
        return created as any;
      }
      return data as any;
    },
  });
}

export function useReferrals() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["referrals", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("referrals" as any)
        .select("*, tenant_plans:referred_plan_id(name, price)")
        .eq("referrer_tenant_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
  });
}

export function useReferralDiscounts() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["referral_discounts", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("referral_discounts" as any)
        .select("*, referrals:referral_id(referred_email, status)")
        .eq("tenant_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
  });
}

export function useReferralStats() {
  const { data: referrals } = useReferrals();
  const { data: code } = useReferralCode();
  const { data: discounts } = useReferralDiscounts();

  const clicks = code?.clicks || 0;
  const registered = referrals?.filter((r: any) => r.status !== 'clicked').length || 0;
  const approved = referrals?.filter((r: any) => ['payment_approved', 'active'].includes(r.status)).length || 0;
  const activeDiscounts = referrals?.filter((r: any) => r.discount_applied && r.status !== 'cancelled').length || 0;
  const totalDiscount = discounts?.reduce((sum: number, d: any) => sum + (d.amount || 0), 0) || 0;

  return { clicks, registered, approved, activeDiscounts, totalDiscount };
}

// Super admin: all referrals
export function useAllReferrals() {
  return useQuery({
    queryKey: ["all_referrals_admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("referrals" as any)
        .select("*, tenant_plans:referred_plan_id(name, price)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
  });
}

export function useAllReferralCodes() {
  return useQuery({
    queryKey: ["all_referral_codes_admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("referral_codes" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
  });
}
