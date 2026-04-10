import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Info, AlertTriangle, Megaphone, X } from "lucide-react";
import { useState } from "react";

const iconMap: Record<string, React.ElementType> = {
  info: Info,
  warning: AlertTriangle,
  promo: Megaphone,
};

export function AdminAnnouncementBanner() {
  const [dismissed, setDismissed] = useState<string[]>([]);

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
      {visible.map((ann: any) => {
        const Icon = iconMap[ann.banner_type] || Info;
        return (
          <div
            key={ann.id}
            className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium"
            style={{
              backgroundColor: ann.bg_color || "#1a1a2e",
              color: ann.text_color || "#ffffff",
            }}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="flex-1">
              {ann.title}{ann.body ? ` — ${ann.body}` : ""}
            </span>
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
