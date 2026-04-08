import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { TenantContext, PlanSlug, SubscriptionStatus } from "@/lib/planPermissions";

const VALID_SLUGS: PlanSlug[] = ["FREE", "STARTER", "PRO", "PREMIUM"];

/**
 * Hook that builds the full TenantContext for the current user.
 * This is the single source of truth for plan/permissions state.
 */
export function useTenantContext() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["tenant_context", user?.id],
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

      const { count: productCount } = await supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .eq("published", true);

      const plan = sub?.tenant_plans as any;
      const planFeatures = (typeof plan?.features === "object" && !Array.isArray(plan?.features))
        ? (plan.features as Record<string, any>)
        : {};
      const overrides = ((sub as any)?.feature_overrides as Record<string, any>) || {};
      const mergedFeatures = { ...planFeatures, ...overrides };

      const isTrial = sub?.status === "trial";
      const trialEndsAt = sub?.trial_ends_at ? new Date(sub.trial_ends_at) : null;
      const trialDaysLeft = trialEndsAt
        ? Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
        : 0;
      const isTrialExpired = isTrial && trialDaysLeft <= 0;

      const planName = (plan?.name as string)?.toUpperCase() || "FREE";
      // Map old ELITE name to PREMIUM for backward compat
      const mapped = planName === "ELITE" ? "PREMIUM" : planName;
      const planSlug = (VALID_SLUGS.includes(mapped as PlanSlug) ? mapped : "FREE") as PlanSlug;

      const ctx: TenantContext = {
        planSlug,
        planFeatures: mergedFeatures,
        maxProducts: plan?.max_products ?? 10,
        maxOrdersMonth: plan?.max_orders_month ?? 50,
        currentProductCount: productCount ?? 0,
        subscriptionStatus: (sub?.status as SubscriptionStatus) ?? null,
        isTrial,
        trialDaysLeft,
        isTrialExpired,
      };

      return { ctx, subscription: sub, plan };
    },
  });

  const defaultCtx: TenantContext = {
    planSlug: "FREE",
    planFeatures: {},
    maxProducts: 10,
    maxOrdersMonth: 50,
    currentProductCount: 0,
    subscriptionStatus: null,
    isTrial: false,
    trialDaysLeft: 0,
    isTrialExpired: false,
  };

  return {
    ctx: data?.ctx ?? defaultCtx,
    subscription: data?.subscription,
    plan: data?.plan,
    isLoading,
  };
}
