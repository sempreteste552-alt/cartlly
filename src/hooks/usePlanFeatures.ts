import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface PlanFeatures {
  gateway: boolean;
  ai_tools: boolean;
  coupons: boolean;
  shipping_zones: boolean;
  banners: boolean;
  custom_domain: boolean;
  max_products: number;
  max_orders_month: number;
}

const DEFAULT_FEATURES: PlanFeatures = {
  gateway: false,
  ai_tools: false,
  coupons: true,
  shipping_zones: true,
  banners: true,
  custom_domain: false,
  max_products: 10,
  max_orders_month: 50,
};

export function usePlanFeatures() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["plan_features", user?.id],
    enabled: !!user,
    queryFn: async () => {
      // Get user's subscription
      const { data: sub } = await supabase
        .from("tenant_subscriptions")
        .select("*, tenant_plans(*)")
        .eq("user_id", user!.id)
        .maybeSingle();

      if (!sub || !sub.tenant_plans) {
        return DEFAULT_FEATURES;
      }

      const plan = sub.tenant_plans as any;
      const features = (plan.features as Record<string, any>) || {};

      return {
        gateway: features.gateway ?? false,
        ai_tools: features.ai_tools ?? false,
        coupons: features.coupons ?? true,
        shipping_zones: features.shipping_zones ?? true,
        banners: features.banners ?? true,
        custom_domain: features.custom_domain ?? false,
        max_products: plan.max_products ?? 50,
        max_orders_month: plan.max_orders_month ?? 100,
      } as PlanFeatures;
    },
  });

  return {
    features: data || DEFAULT_FEATURES,
    isLoading,
    isLocked: (feature: keyof Omit<PlanFeatures, "max_products" | "max_orders_month">) => {
      return !(data || DEFAULT_FEATURES)[feature];
    },
  };
}
