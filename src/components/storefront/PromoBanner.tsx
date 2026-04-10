import { useState, useEffect } from "react";
import { X, Sparkles, ExternalLink } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface PromoBannerProps {
  storeUserId?: string;
}

const DEFAULT_TEXT = "🚀 Crie sua própria loja online agora mesmo!";
const DEFAULT_LINK = "https://usecartlly.vercel.app/";

export function PromoBanner({ storeUserId }: PromoBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  // Check global platform setting
  const { data: globalConfig } = useQuery({
    queryKey: ["platform_promo_banner_config"],
    queryFn: async () => {
      const { data } = await supabase
        .from("platform_settings")
        .select("key, value")
        .in("key", ["promo_banner_enabled", "promo_banner_text", "promo_banner_link"]);
      const map: Record<string, any> = {};
      data?.forEach(r => { map[r.key] = (r.value as any)?.value; });
      return {
        enabled: map.promo_banner_enabled === true,
        text: (map.promo_banner_text as string) || null,
        link: (map.promo_banner_link as string) || null,
      };
    },
  });

  // Check per-tenant setting
  const { data: tenantSetting } = useQuery({
    queryKey: ["tenant_promo_banner_full", storeUserId],
    enabled: !!storeUserId,
    queryFn: async () => {
      const { data } = await supabase
        .from("store_settings")
        .select("promo_banner_enabled, promo_banner_text, promo_banner_link")
        .eq("user_id", storeUserId!)
        .maybeSingle();
      return data;
    },
  });

  // Check if tenant is PREMIUM
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

  const shouldShow = !dismissed && (
    (globalConfig?.enabled && !isPremium) ||
    tenantEnabled === true
  );

  if (!shouldShow) return null;

  // Resolve text and link: tenant override > global override > defaults
  const bannerText = (tenantSetting as any)?.promo_banner_text || globalConfig?.text || DEFAULT_TEXT;
  const bannerLink = (tenantSetting as any)?.promo_banner_link || globalConfig?.link || DEFAULT_LINK;

  return (
    <div className="relative overflow-hidden" style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 25%, #0f3460 50%, #533483 75%, #e94560 100%)" }}>
      {/* Glow / shimmer effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-10 -left-10 w-40 h-40 bg-purple-500/30 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-pink-500/30 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-60 h-20 bg-blue-400/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "0.5s" }} />
      </div>
      {/* Shimmer sweep */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div 
          className="absolute top-0 -left-full w-full h-full"
          style={{
            background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 50%, transparent 100%)",
            animation: "shimmer-sweep 3s ease-in-out infinite",
          }}
        />
      </div>
      <style>{`
        @keyframes shimmer-sweep {
          0% { transform: translateX(0); }
          100% { transform: translateX(200%); }
        }
      `}</style>

      <div className="relative max-w-7xl mx-auto px-4 py-3 flex items-center justify-center gap-3 text-center">
        <Sparkles className="h-4 w-4 shrink-0 text-yellow-300 animate-pulse" />
        <p className="text-xs sm:text-sm font-semibold text-white drop-shadow-lg">
          {bannerText}
        </p>
        <a
          href={bannerLink}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 inline-flex items-center gap-1 px-4 py-1.5 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-md text-xs font-bold text-white border border-white/20 transition-all hover:scale-105 shadow-lg shadow-purple-500/20"
        >
          Saiba mais <ExternalLink className="h-3 w-3" />
        </a>
        <button
          onClick={handleDismiss}
          className="shrink-0 p-1 rounded-full hover:bg-white/20 transition-colors ml-1 text-white/70 hover:text-white"
          aria-label="Fechar banner"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
