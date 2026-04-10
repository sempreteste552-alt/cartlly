import { useQuery } from "@tanstack/react-query";
import { Sparkles, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";

interface PromoBannerProps {
  storeUserId?: string;
}

const DEFAULT_TEXT = "🚀 Crie sua própria loja online agora mesmo!";
const DEFAULT_LINK = "https://usecartlly.vercel.app/";

export function PromoBanner({ storeUserId }: PromoBannerProps) {
  // Realtime: auto-refresh when platform_settings change
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

  const c1 = globalConfig?.bg_color_1 || "#1a1a2e";
  const c2 = globalConfig?.bg_color_2 || "#533483";
  const c3 = globalConfig?.bg_color_3 || "#e94560";
  const bgGradient = `linear-gradient(135deg, ${c1} 0%, ${c2} 50%, ${c3} 100%)`;

  // Split text into characters for jumping animation
  const chars = bannerText.split("");

  return (
    <div className="relative overflow-hidden" style={{ background: bgGradient }}>
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-10 -left-10 w-40 h-40 bg-white/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
      </div>
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
        @keyframes slow-jump {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        .jumping-letter {
          display: inline-block;
          animation: slow-jump 2.5s ease-in-out infinite;
        }
      `}</style>

      <div className="relative max-w-7xl mx-auto px-4 py-3 flex items-center justify-center gap-3 text-center">
        <Sparkles className="h-4 w-4 shrink-0 text-yellow-300 animate-pulse" />
        <p className="text-xs sm:text-sm font-semibold text-white drop-shadow-lg">
          {chars.map((char, i) => (
            <span
              key={i}
              className="jumping-letter"
              style={{ animationDelay: `${i * 0.06}s` }}
            >
              {char === " " ? "\u00A0" : char}
            </span>
          ))}
        </p>
        <a
          href={bannerLink}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 inline-flex items-center gap-1 px-4 py-1.5 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-md text-xs font-bold text-white border border-white/20 transition-all hover:scale-105 shadow-lg"
        >
          Saiba mais <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}
