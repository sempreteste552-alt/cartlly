import { useState, useEffect } from "react";
import { X, Sparkles, ExternalLink } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface PromoBannerProps {
  storeUserId?: string;
}

export function PromoBanner({ storeUserId }: PromoBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  // Check global platform setting
  const { data: globalEnabled } = useQuery({
    queryKey: ["platform_promo_banner"],
    queryFn: async () => {
      const { data } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "promo_banner_enabled")
        .maybeSingle();
      return (data?.value as any)?.value === true;
    },
  });

  // Check per-tenant setting
  const { data: tenantSetting } = useQuery({
    queryKey: ["tenant_promo_banner", storeUserId],
    enabled: !!storeUserId,
    queryFn: async () => {
      const { data } = await supabase
        .from("store_settings")
        .select("promo_banner_enabled")
        .eq("user_id", storeUserId!)
        .maybeSingle();
      return data;
    },
  });

  // Check if tenant is PREMIUM (premium hides banner by default)
  const { data: tenantPlan } = useQuery({
    queryKey: ["tenant_plan_for_banner", storeUserId],
    enabled: !!storeUserId,
    queryFn: async () => {
      const { data } = await supabase
        .from("tenant_subscriptions")
        .select("tenant_plans(name)")
        .eq("user_id", storeUserId!)
        .in("status", ["active", "trial"])
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const planName = ((data?.tenant_plans as any)?.name as string)?.toUpperCase() || "FREE";
      return planName === "ELITE" ? "PREMIUM" : planName;
    },
  });

  useEffect(() => {
    const key = `promo_banner_dismissed_${storeUserId || "global"}`;
    if (sessionStorage.getItem(key)) setDismissed(true);
  }, [storeUserId]);

  const handleDismiss = () => {
    const key = `promo_banner_dismissed_${storeUserId || "global"}`;
    sessionStorage.setItem(key, "1");
    setDismissed(true);
  };

  const isPremium = tenantPlan === "PREMIUM";
  const tenantEnabled = (tenantSetting as any)?.promo_banner_enabled;

  // Logic: Show for all non-premium by default when global is on.
  // Premium tenants only see it if they explicitly enabled it.
  // Any tenant can also force-enable it individually.
  const shouldShow = !dismissed && (
    (globalEnabled && !isPremium) ||
    tenantEnabled === true
  );

  if (!shouldShow) return null;

  return (
    <div className="relative bg-gradient-to-r from-blue-600 via-purple-600 to-pink-500 text-white overflow-hidden">
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-0 left-0 w-full h-full bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIyMCIgY3k9IjIwIiByPSIxIiBmaWxsPSJ3aGl0ZSIgb3BhY2l0eT0iMC4zIi8+PC9zdmc+')] animate-pulse" />
      </div>
      
      <div className="relative max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-center gap-3 text-center">
        <Sparkles className="h-4 w-4 shrink-0 animate-pulse" />
        <p className="text-xs sm:text-sm font-medium">
          <span className="hidden sm:inline">🚀 Crie sua própria loja online agora mesmo!</span>
          <span className="sm:hidden">🚀 Crie sua loja online!</span>
        </p>
        <a
          href="https://usecartlly.vercel.app/"
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-sm text-xs font-semibold transition-all hover:scale-105"
        >
          Saiba mais <ExternalLink className="h-3 w-3" />
        </a>
        <button
          onClick={handleDismiss}
          className="shrink-0 p-1 rounded-full hover:bg-white/20 transition-colors ml-1"
          aria-label="Fechar banner"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
