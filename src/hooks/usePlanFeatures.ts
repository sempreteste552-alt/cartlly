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
  whatsapp_sales: boolean;
  reviews: boolean;
  max_products: number;
  max_orders_month: number;
}

// Free plan defaults — only add up to 10 products, no other features
const FREE_DEFAULTS: PlanFeatures = {
  gateway: false,
  ai_tools: false,
  coupons: false,
  shipping_zones: false,
  banners: false,
  custom_domain: false,
  whatsapp_sales: false,
  reviews: false,
  max_products: 10,
  max_orders_month: 0,
};

export function usePlanFeatures() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["plan_features", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: sub } = await supabase
        .from("tenant_subscriptions")
        .select("*, tenant_plans(*)")
        .eq("user_id", user!.id)
        .in("status", ["active", "trial"])
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!sub || !sub.tenant_plans) {
        return FREE_DEFAULTS;
      }

      const plan = sub.tenant_plans as any;
      const features = (typeof plan.features === "object" && !Array.isArray(plan.features))
        ? (plan.features as Record<string, any>)
        : {};
      const overrides = ((sub as any).feature_overrides as Record<string, any>) || {};

      return {
        gateway: overrides.gateway ?? features.gateway ?? false,
        ai_tools: overrides.ai_tools ?? features.ai_tools ?? false,
        coupons: overrides.coupons ?? features.coupons ?? false,
        shipping_zones: overrides.shipping_zones ?? features.shipping_zones ?? true,
        banners: overrides.banners ?? features.banners ?? false,
        custom_domain: overrides.custom_domain ?? features.custom_domain ?? false,
        whatsapp_sales: overrides.whatsapp_sales ?? features.whatsapp_sales ?? true,
        reviews: overrides.reviews ?? features.reviews ?? true,
        max_products: plan.max_products ?? 5,
        max_orders_month: plan.max_orders_month ?? 20,
      } as PlanFeatures;
    },
  });

  return {
    features: data || FREE_DEFAULTS,
    isLoading,
    isLocked: (feature: keyof Omit<PlanFeatures, "max_products" | "max_orders_month">) => {
      return !(data || FREE_DEFAULTS)[feature];
    },
  };
}
