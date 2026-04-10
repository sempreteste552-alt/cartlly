import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Info, AlertTriangle, Megaphone, X, ExternalLink } from "lucide-react";
import { useState } from "react";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";

const iconMap: Record<string, React.ElementType> = {
  info: Info,
  warning: AlertTriangle,
  promo: Megaphone,
};

export function AdminAnnouncementBanner() {
  const [dismissed, setDismissed] = useState<string[]>([]);
  useRealtimeSync("admin_announcements", [["admin_announcements_active"]]);

  const { data: announcements } = useQuery({
    queryKey: ["admin_announcements_active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_announcements")
        .select("*")
        .eq("active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const visible = (announcements || []).filter((a: any) => !dismissed.includes(a.id));
  if (!visible.length) return null;

  return (
    <div className="space-y-0">
      <style>{`
        @keyframes marquee-scroll {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
        .animate-marquee-banner {
          animation: marquee-scroll 18s linear infinite;
        }
      `}</style>
      {visible.map((ann: any) => {
        const Icon = iconMap[ann.banner_type] || Info;
        const isMarquee = ann.marquee;
        const content = (
          <>
            {ann.title}{ann.body ? ` — ${ann.body}` : ""}
            {ann.link_url && (
              <a
                href={ann.link_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 ml-2 underline opacity-80 hover:opacity-100"
              >
                Saiba mais <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </>
        );

        return (
          <div
            key={ann.id}
            className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium overflow-hidden"
            style={{
              backgroundColor: ann.bg_color || "#1a1a2e",
              color: ann.text_color || "#ffffff",
            }}
          >
            {!isMarquee && <Icon className="h-4 w-4 shrink-0" />}
            {isMarquee ? (
              <div className="flex-1 overflow-hidden">
                <div className="whitespace-nowrap animate-marquee-banner">
                  {content}
                </div>
              </div>
            ) : (
              <span className="flex-1">{content}</span>
            )}
            <button
              onClick={() => setDismissed((d) => [...d, ann.id])}
              className="shrink-0 p-1 rounded hover:bg-white/20 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
