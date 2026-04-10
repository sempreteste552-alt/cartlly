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
  const flagged = referrals?.filter((r: any) => r.flagged).length || 0;

  return { clicks, registered, approved, activeDiscounts, totalDiscount, flagged };
}

// Super admin hooks
export function useAllReferrals() {
  return useQuery({
    queryKey: ["all_referrals_admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("referrals" as any)
        .select("*, tenant_plans:referred_plan_id(name, price)")
        .order("created_at", { ascending: false });
      if (error) throw error;

      // Enrich with store names for referrer and referred
      const referrerIds = [...new Set((data || []).map((r: any) => r.referrer_tenant_id).filter(Boolean))];
      const referredIds = [...new Set((data || []).map((r: any) => r.referred_user_id).filter(Boolean))];
      const allIds = [...new Set([...referrerIds, ...referredIds])];

      let storeMap: Record<string, { store_name: string; store_slug: string; store_category: string }> = {};
      if (allIds.length > 0) {
        const { data: stores } = await supabase
          .from("store_settings")
          .select("user_id, store_name, store_slug, store_category")
          .in("user_id", allIds);
        (stores || []).forEach((s: any) => {
          storeMap[s.user_id] = { store_name: s.store_name, store_slug: s.store_slug, store_category: s.store_category };
        });
      }

      return (data || []).map((r: any) => ({
        ...r,
        referrer_store: storeMap[r.referrer_tenant_id] || null,
        referred_store: storeMap[r.referred_user_id] || null,
      })) as any[];
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

      // Enrich with store names
      const tenantIds = [...new Set((data || []).map((c: any) => c.tenant_id).filter(Boolean))];
      let storeMap: Record<string, string> = {};
      if (tenantIds.length > 0) {
        const { data: stores } = await supabase
          .from("store_settings")
          .select("user_id, store_name")
          .in("user_id", tenantIds);
        (stores || []).forEach((s: any) => { storeMap[s.user_id] = s.store_name || ""; });
      }

      return (data || []).map((c: any) => ({
        ...c,
        store_name: storeMap[c.tenant_id] || null,
      })) as any[];
    },
  });
}

export function useAllReferralDiscounts() {
  return useQuery({
    queryKey: ["all_referral_discounts_admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("referral_discounts" as any)
        .select("*, referrals:referral_id(referred_email, referrer_tenant_id, status)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
  });
}

export function useFlagReferral() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, flagged, reason }: { id: string; flagged: boolean; reason?: string }) => {
      const updates: any = { flagged, flagged_reason: reason || null };
      if (flagged) {
        updates.discount_applied = false;
        updates.status = 'flagged';
      }
      const { error } = await supabase
        .from("referrals" as any)
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all_referrals_admin"] });
      toast.success("Indicação atualizada");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useInvalidateDiscount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ discountId }: { discountId: string }) => {
      const { error } = await supabase
        .from("referral_discounts" as any)
        .update({ applied: false, amount: 0 } as any)
        .eq("id", discountId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all_referral_discounts_admin"] });
      toast.success("Desconto invalidado");
    },
    onError: (e: any) => toast.error(e.message),
  });
}
