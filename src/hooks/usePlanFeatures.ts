import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { PlanSlug } from "@/lib/planPermissions";

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

export interface SubscriptionInfo {
  status: string | null;
  planName: string | null;
  planPrice: number;
  isTrial: boolean;
  trialDaysLeft: number;
  isTrialExpired: boolean;
  isActive: boolean;
  isBlocked: boolean;
}

const FREE_DEFAULTS: PlanFeatures = {
  gateway: false,
  ai_tools: false,
  coupons: false,
  shipping_zones: false,
  banners: false,
  custom_domain: false,
  whatsapp_sales: true,
  reviews: false,
  max_products: 20,
  max_orders_month: 0,
};

const VALID_SLUGS: PlanSlug[] = ["FREE", "STARTER", "PRO", "PREMIUM"];

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
        .in("status", ["active", "trial", "trial_expired", "past_due", "canceled", "suspended"])
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!sub || !sub.tenant_plans) {
        return {
          features: FREE_DEFAULTS,
          subscription: {
            status: null, planName: null, planPrice: 0,
            isTrial: false, trialDaysLeft: 0, isTrialExpired: false,
            isActive: false, isBlocked: false,
          } as SubscriptionInfo,
        };
      }

      const plan = sub.tenant_plans as any;
      const features_obj = (typeof plan.features === "object" && !Array.isArray(plan.features))
        ? (plan.features as Record<string, any>) : {};
      const overrides = ((sub as any).feature_overrides as Record<string, any>) || {};

      const isTrial = sub.status === "trial";
      const trialEndsAt = sub.trial_ends_at ? new Date(sub.trial_ends_at) : null;
      const trialDaysLeft = trialEndsAt
        ? Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 0;
      const isTrialExpired = isTrial && trialDaysLeft <= 0;
      const isActive = sub.status === "active" || (isTrial && !isTrialExpired);
      const isBlocked = ["trial_expired", "past_due", "canceled", "suspended"].includes(sub.status) || isTrialExpired;
      const shouldBlock = isBlocked;

      // Normalize plan name (ELITE -> PREMIUM)
      const planNameRaw = (plan.name as string)?.toUpperCase() || "FREE";
      const planName = planNameRaw === "ELITE" ? "PREMIUM" : planNameRaw;

      // Liberação manual (override do super admin) tem prioridade sobre bloqueio de cobrança
      const resolve = (key: keyof PlanFeatures, fallback: boolean) => {
        if (overrides[key] === true) return true;
        if (overrides[key] === false) return false;
        if (shouldBlock) return false;
        return (features_obj as any)[key] ?? fallback;
      };

      const resolvedFeatures: PlanFeatures = {
        gateway: resolve("gateway", false),
        ai_tools: resolve("ai_tools", false),
        coupons: resolve("coupons", false),
        shipping_zones: resolve("shipping_zones", true),
        banners: resolve("banners", false),
        custom_domain: resolve("custom_domain", false),
        whatsapp_sales: resolve("whatsapp_sales", true),
        reviews: resolve("reviews", true),
        max_products: shouldBlock ? 5 : (plan.max_products ?? 5),
        max_orders_month: shouldBlock ? 0 : (plan.max_orders_month ?? 20),
      };

      return {
        features: resolvedFeatures,
        subscription: {
          status: sub.status, planName, planPrice: plan.price ?? 0,
          isTrial, trialDaysLeft, isTrialExpired, isActive, isBlocked,
        } as SubscriptionInfo,
      };
    },
  });

  const features = data?.features || FREE_DEFAULTS;
  const subscription: SubscriptionInfo = data?.subscription || {
    status: null, planName: null, planPrice: 0,
    isTrial: false, trialDaysLeft: 0, isTrialExpired: false, isActive: false, isBlocked: false,
  };

  return {
    features,
    subscription,
    isLoading,
    // CRITICAL: While loading, treat features as locked to prevent flash of unlocked state
    isLocked: (feature: keyof Omit<PlanFeatures, "max_products" | "max_orders_month">) => isLoading ? true : !features[feature],
  };
}
