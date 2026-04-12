import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";

interface PromoBannerProps {
  storeUserId?: string;
}

const DEFAULT_TEXT = "Crie sua própria loja online agora mesmo";
const DEFAULT_LINK = "https://usecartlly.vercel.app/";

export function PromoBanner({ storeUserId }: PromoBannerProps) {
  useRealtimeSync("platform_settings", [["platform_promo_banner_config_public"]]);

  const { data: globalConfig } = useQuery({
    queryKey: ["platform_promo_banner_config_public"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_platform_banner_config_public");
      if (error) throw error;
      const map: Record<string, any> = {};
      (data || []).forEach((r: any) => {
        map[r.key] = r.value?.value;
      });
      return {
        enabled: map.promo_banner_enabled === true,
        text: (map.promo_banner_text as string) || null,
        link: (map.promo_banner_link as string) || null,
        bg_color_1: (map.promo_banner_color_1 as string) || null,
        bg_color_2: (map.promo_banner_color_2 as string) || null,
        bg_color_3: (map.promo_banner_color_3 as string) || null,
      };
    },
  });

  const { data: storefrontStatus } = useQuery({
    queryKey: ["storefront_banner_status", storeUserId],
    enabled: !!storeUserId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_storefront_banner_status", {
        _user_id: storeUserId!,
      });
      if (error) throw error;
      return Array.isArray(data) ? data[0] : data;
    },
  });

  const tenantOverride = storefrontStatus?.promo_banner_enabled as boolean | null | undefined;
  const isPremium = storefrontStatus?.is_premium === true;

  let shouldShow = false;
  if (tenantOverride === true) {
    shouldShow = true;
  } else if (globalConfig?.enabled === true && !isPremium) {
    shouldShow = true;
  }

  if (!shouldShow) return null;

  const bannerText = globalConfig?.text || DEFAULT_TEXT;
  const bannerLink = globalConfig?.link || DEFAULT_LINK;

  const c1 = globalConfig?.bg_color_1 || "#0f0f17";
  const c2 = globalConfig?.bg_color_2 || "#1a1a2e";
  const c3 = globalConfig?.bg_color_3 || "#16213e";

  return (
    <div className="relative overflow-hidden border-b border-white/5">
      {/* Animated gradient background */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(270deg, ${c1}, ${c2}, ${c3}, ${c1})`,
          backgroundSize: "600% 600%",
          animation: "gradient-flow 12s ease infinite",
        }}
      />

      {/* Subtle noise texture */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
      }} />

      <style>{`
        @keyframes gradient-flow {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes float-btn {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-2px); }
        }
      `}</style>

      <div className="relative max-w-7xl mx-auto px-4 py-2 flex items-center justify-center gap-3">
        <p className="text-[11px] sm:text-xs font-medium text-white/80 tracking-wide">
          {bannerText}
        </p>
        <a
          href={bannerLink}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 inline-flex items-center gap-1 px-3 py-1 rounded-md text-[10px] sm:text-[11px] font-semibold text-white/90 hover:text-white bg-white/10 hover:bg-white/15 border border-white/10 transition-colors duration-200"
          style={{ animation: "float-btn 3s ease-in-out infinite" }}
        >
          Saiba mais <ExternalLink className="h-2.5 w-2.5" />
        </a>
      </div>
    </div>
  );
}
