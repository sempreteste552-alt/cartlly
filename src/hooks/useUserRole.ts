import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

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
  const isTenant = !isSuperAdmin;

  return { isSuperAdmin, isTenant, roles, isLoading };
}

export function useAllTenants() {
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

      return profiles?.map((p: any) => ({
        ...p,
        store: stores?.find((s: any) => s.user_id === p.user_id),
        subscription: subs?.find((s: any) => s.user_id === p.user_id),
        productCount: productCounts[p.user_id] || 0,
        orders: orderData[p.user_id] || { count: 0, revenue: 0 },
      })) ?? [];
    },
  });
}

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
