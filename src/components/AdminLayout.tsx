import { useEffect, useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/AdminSidebar";
import { Outlet } from "react-router-dom";
import { useStoreSettings } from "@/hooks/useStoreSettings";
import { AIChatWidget } from "@/components/AIChatWidget";
import { WhatsAppSupportBubble } from "@/components/WhatsAppSupportBubble";
import { WelcomeConfetti } from "@/components/WelcomeConfetti";
import { AdminNotificationsBell } from "@/components/AdminNotificationsBell";
import { AdminPendingOrdersAlert } from "@/components/admin/AdminPendingOrdersAlert";
import { AdminPushBanner } from "@/components/AdminPushBanner";
import { TrialBanner } from "@/components/TrialBanner";
import { useAuth } from "@/contexts/AuthContext";
import { usePwaManifest } from "@/hooks/usePwaManifest";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Badge } from "@/components/ui/badge";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Crown, Clock } from "lucide-react";

export function AdminLayout() {
  const { data: settings } = useStoreSettings();
  const { user } = useAuth();
  const { features } = usePlanFeatures();
  const [showWelcome, setShowWelcome] = useState(false);
  const [welcomeName, setWelcomeName] = useState("");

  // Dynamic PWA manifest for admin context
  const adminName = (settings as any)?.store_name
    ? `Admin ${(settings as any).store_name}`
    : "Painel Admin";
  usePwaManifest({
    name: adminName,
    shortName: adminName.slice(0, 12),
    themeColor: (settings as any)?.admin_primary_color || "#6d28d9",
    iconUrl: (settings as any)?.logo_url || undefined,
    startUrl: `${window.location.origin}/admin/`,
    scope: `${window.location.origin}/admin/`,
  });

  const { data: currentSub } = useQuery({
    queryKey: ["admin_layout_sub", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("tenant_subscriptions")
        .select("*, tenant_plans(*)")
        .eq("user_id", user!.id)
        .in("status", ["active", "trial"])
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const isTrial = currentSub?.status === "trial";
  const trialEndsAt = currentSub?.trial_ends_at ? new Date(currentSub.trial_ends_at) : null;
  const trialDaysLeft = trialEndsAt ? Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 0;

  useEffect(() => {
    const sessionKey = `welcome_shown_${user?.id}`;
    if (user && !sessionStorage.getItem(sessionKey)) {
      sessionStorage.setItem(sessionKey, "1");
      const name = user.user_metadata?.display_name || user.email?.split("@")[0] || "Usuário";
      setWelcomeName(name);
      setShowWelcome(true);
      setTimeout(() => setShowWelcome(false), 4000);
    }
  }, [user]);

  useEffect(() => {
    if (settings) {
      const root = document.documentElement;
      const adminPrimary = (settings as any).admin_primary_color || "#6d28d9";

      const toHSL = (hex: string) => {
        const r = parseInt(hex.slice(1, 3), 16) / 255;
        const g = parseInt(hex.slice(3, 5), 16) / 255;
        const b = parseInt(hex.slice(5, 7), 16) / 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h = 0, s = 0;
        const l = (max + min) / 2;
        if (max !== min) {
          const d = max - min;
          s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
          switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
            case g: h = ((b - r) / d + 2) / 6; break;
            case b: h = ((r - g) / d + 4) / 6; break;
          }
        }
        return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
      };

      try {
        root.style.setProperty("--primary", toHSL(adminPrimary));
        root.style.setProperty("--ring", toHSL(adminPrimary));
        root.style.setProperty("--sidebar-primary", toHSL(adminPrimary));
        root.style.setProperty("--sidebar-ring", toHSL(adminPrimary));
        root.style.setProperty("--accent-foreground", toHSL(adminPrimary));
      } catch {}

      return () => {
        root.style.removeProperty("--primary");
        root.style.removeProperty("--ring");
        root.style.removeProperty("--sidebar-primary");
        root.style.removeProperty("--sidebar-ring");
        root.style.removeProperty("--accent-foreground");
      };
    }
  }, [settings]);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AdminSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          {/* Push notification install banner */}
          <AdminPushBanner />
          <AdminPendingOrdersAlert />
          <header className="h-14 flex items-center justify-between border-b border-border/60 bg-card/80 backdrop-blur-sm px-4 sticky top-0 z-30">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="mr-1" />
              <h2 className="text-sm font-medium text-muted-foreground hidden sm:block">
                {(settings as any)?.store_name || "Painel Administrativo"}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              {isTrial && trialDaysLeft > 0 && (
                <Badge variant="outline" className="border-warning/50 text-warning gap-1 text-xs hidden sm:flex">
                  <Clock className="h-3 w-3" />
                  {trialDaysLeft}d restantes
                </Badge>
              )}
              <ThemeToggle scope="admin" />
              <AdminNotificationsBell />
            </div>
          </header>
          <main className="flex-1 overflow-auto p-4 sm:p-6">
            <TrialBanner />
            <Outlet />
          </main>
        </div>
        <WhatsAppSupportBubble />
        <AIChatWidget />
        {showWelcome && <WelcomeConfetti userName={welcomeName} />}
      </div>
    </SidebarProvider>
  );
}
