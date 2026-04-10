import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";

const SUPER_ADMIN_EMAIL = "evelynesantoscruivinel@gmail.com";

export function useUserRole() {
  const { user } = useAuth();

  const { data: roles, isLoading } = useQuery({
    queryKey: ["user_roles", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id);
      if (error) throw error;
      return data?.map((r: any) => r.role) ?? [];
    },
  });

  const isSuperAdmin = roles?.includes("super_admin") || user?.email === SUPER_ADMIN_EMAIL;
  const isCustomer = user?.user_metadata?.is_customer === true;
  const isTenant = !isSuperAdmin && !isCustomer && !!user;

  return { isSuperAdmin, isTenant, isCustomer, roles, isLoading };
}

export function useAllTenants() {
  const queryClient = useQueryClient();

  // Realtime subscription for new/updated profiles
  useEffect(() => {
    const channel = supabase
      .channel("tenants-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => {
        queryClient.invalidateQueries({ queryKey: ["all_tenants"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "plan_change_requests" }, () => {
        queryClient.invalidateQueries({ queryKey: ["all_plan_change_requests"] });
        queryClient.invalidateQueries({ queryKey: ["all_plan_change_requests_full"] });
        queryClient.invalidateQueries({ queryKey: ["all_plan_requests_pending"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  return useQuery({
    queryKey: ["all_tenants"],
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("*, status");
      if (error) throw error;

      // Get store settings for each tenant
      const { data: stores } = await supabase
        .from("store_settings")
        .select("*");

      // Get subscriptions
      const { data: subs } = await supabase
        .from("tenant_subscriptions")
        .select("*, tenant_plans(*)");

      // Get product counts
      const { data: products } = await supabase
        .from("products")
        .select("user_id");

      // Get order counts
      const { data: orders } = await supabase
        .from("orders")
        .select("user_id, total, created_at");

      const productCounts: Record<string, number> = {};
      products?.forEach((p: any) => {
        productCounts[p.user_id] = (productCounts[p.user_id] || 0) + 1;
      });

      const orderData: Record<string, { count: number; revenue: number }> = {};
      orders?.forEach((o: any) => {
        if (!orderData[o.user_id]) orderData[o.user_id] = { count: 0, revenue: 0 };
        orderData[o.user_id].count += 1;
        orderData[o.user_id].revenue += Number(o.total);
      });

      // Get super admin user_ids to exclude from tenant list
      const { data: superAdminRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "super_admin");
      const superAdminIds = new Set(superAdminRoles?.map((r: any) => r.user_id) || []);

      // Get referral origin data (who referred each tenant)
      const { data: referrals } = await supabase
        .from("referrals" as any)
        .select("referred_user_id, referrer_tenant_id, referral_code, status, created_at")
        .not("referred_user_id", "is", null);

      const referralMap: Record<string, { referrer_tenant_id: string; referral_code: string; status: string; created_at: string }> = {};
      (referrals || []).forEach((r: any) => {
        if (r.referred_user_id) referralMap[r.referred_user_id] = r;
      });

      return profiles
        ?.filter((p: any) => !superAdminIds.has(p.user_id))
        .map((p: any) => ({
          ...p,
          store: stores?.find((s: any) => s.user_id === p.user_id),
          subscription: subs?.find((s: any) => s.user_id === p.user_id),
          productCount: productCounts[p.user_id] || 0,
          orders: orderData[p.user_id] || { count: 0, revenue: 0 },
          referral_origin: referralMap[p.user_id] || null,
        })) ?? [];

export function useAllPlans() {
  return useQuery({
    queryKey: ["tenant_plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_plans")
        .select("*")
        .order("price");
      if (error) throw error;
      return data;
    },
  });
}
