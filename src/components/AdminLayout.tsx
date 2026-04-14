import { useEffect, useLayoutEffect, useState, useMemo, Suspense, type CSSProperties } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useMotivationalPush } from "@/hooks/useMotivationalPush";
import { AdminSidebar } from "@/components/AdminSidebar";
import { Outlet, useParams, useLocation } from "react-router-dom";
import { useStoreSettings } from "@/hooks/useStoreSettings";
import { AIChatWidget } from "@/components/AIChatWidget";
import { WhatsAppSupportBubble } from "@/components/WhatsAppSupportBubble";
import { WelcomeConfetti } from "@/components/WelcomeConfetti";
import { AdminNotificationsBell } from "@/components/AdminNotificationsBell";
import { AdminPendingOrdersAlert } from "@/components/admin/AdminPendingOrdersAlert";
import { AdminPushBanner } from "@/components/AdminPushBanner";
import { TrialBanner } from "@/components/TrialBanner";
import { AdminAnnouncementBanner } from "@/components/admin/AdminAnnouncementBanner";
import { GlobalMaintenanceBanner } from "@/components/GlobalMaintenanceBanner";
import { useAuth } from "@/contexts/AuthContext";
import { usePwaManifest } from "@/hooks/usePwaManifest";
import { useStoreThemeConfig } from "@/hooks/useStoreThemeConfig";
import { ThemeToggle, useThemeScope } from "@/components/ThemeToggle";
import { Badge } from "@/components/ui/badge";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";
import { useTenantContext } from "@/hooks/useTenantContext";
import { canAccess } from "@/lib/planPermissions";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Crown, Clock, HelpCircle } from "lucide-react";
import { OnboardingTutorial, startTutorial } from "./OnboardingTutorial";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { isLocale, useTranslation } from "@/i18n";
import { isPlatformHost } from "@/lib/storeDomain";

export function AdminLayout() {
  const location = useLocation();
  const { slug: urlSlug } = useParams();
  const isCerebroPage = location.pathname.includes("/cerebro");
  const isSuportePage = location.pathname.includes("/suporte");
  const { locale, setLocale } = useTranslation();
  const { data: settings, isLoading: settingsLoading } = useStoreSettings();
  const { data: themeConfig, isLoading: themeLoading } = useStoreThemeConfig();
  const { user } = useAuth();
  const { features, isLoading: featuresLoading } = usePlanFeatures();
  const { ctx, isLoading: ctxLoading } = useTenantContext();
  const aiAvailable = canAccess("ai_tools", ctx);
  useMotivationalPush(user ?? null);
  const [showWelcome, setShowWelcome] = useState(false);
  const [welcomeName, setWelcomeName] = useState("");

  // Block rendering until all tenant-specific data is resolved
  const tenantReady = !settingsLoading && !themeLoading && !featuresLoading && !ctxLoading;

  // Dynamic PWA manifest for admin context — only apply when we have confirmed tenant data
  const storeSlug = (settings as any)?.store_slug || urlSlug;
  const hostname = typeof window !== "undefined" ? window.location.hostname : "";
  const isCustomDomain = !storeSlug && hostname && !isPlatformHost(hostname);

  const adminName = useMemo(() => {
    if (storeSlug) return `Painel ${storeSlug.split('-')[0]}`;
    if (isCustomDomain) return `Painel ${hostname.split('.')[0]}`;
    return "Painel Administrativo";
  }, [storeSlug, hostname, isCustomDomain]);

  const manifestId = useMemo(() => {
    if (storeSlug) return `cartlly-admin-${storeSlug}`;
    if (isCustomDomain) return `cartlly-admin-domain-${hostname}`;
    if ((settings as any)?.id) return `cartlly-admin-id-${(settings as any).id}`;
    return "cartlly-admin-default";
  }, [storeSlug, hostname, isCustomDomain, (settings as any)?.id]);

  usePwaManifest({
    id: manifestId,
    name: adminName,
    shortName: adminName.slice(0, 12),
    themeColor: (settings as any)?.admin_primary_color || "#6d28d9",
    iconUrl: themeConfig?.favicon_url || (settings as any)?.favicon_url || (settings as any)?.logo_url || undefined,
    iconVersion: themeConfig?.updated_at || (settings as any)?.updated_at || undefined,
    startUrl: storeSlug ? `${window.location.origin}/painel/${storeSlug}/` : `${window.location.origin}/admin/`,
    scope: storeSlug ? `${window.location.origin}/painel/${storeSlug}/` : `${window.location.origin}/admin/`,
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
  const adminText = {
    pt: { panel: "Painel Administrativo", tutorial: "Reiniciar Tutorial", remaining: "restantes" },
    en: { panel: "Admin Panel", tutorial: "Restart Tutorial", remaining: "remaining" },
    es: { panel: "Panel Administrativo", tutorial: "Reiniciar tutorial", remaining: "restantes" },
    fr: { panel: "Panneau Admin", tutorial: "Redémarrer le tutoriel", remaining: "restants" },
  }[locale];

  useEffect(() => {
    const nextLocale = (settings as any)?.language;
    if (isLocale(nextLocale) && nextLocale !== locale) {
      setLocale(nextLocale);
    }
  }, [settings, locale, setLocale]);

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

  const toHSL = (hex: string) => {
    const safeHex = hex.startsWith("#") ? hex : "#6d28d9";
    const r = parseInt(safeHex.slice(1, 3), 16) / 255;
    const g = parseInt(safeHex.slice(3, 5), 16) / 255;
    const b = parseInt(safeHex.slice(5, 7), 16) / 255;
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

  const adminPrimary = (settings as any)?.admin_primary_color || "#6d28d9";
  const adminAccent = (settings as any)?.admin_accent_color || adminPrimary;
  const adminThemeScope = "admin";
  const { dark: adminDark } = useThemeScope(adminThemeScope);
  const adminThemeStyle = {
    "--primary": toHSL(adminPrimary),
    "--ring": toHSL(adminPrimary),
    "--sidebar-primary": toHSL(adminPrimary),
    "--sidebar-ring": toHSL(adminPrimary),
    "--accent-foreground": toHSL(adminPrimary),
    "--sidebar-accent": toHSL(adminAccent),
    "--accent": toHSL(adminAccent),
    "--sidebar-accent-foreground": "0 0% 100%",
  } as CSSProperties;

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.themeScope = adminThemeScope;
    root.classList.toggle("dark", adminDark);

    return () => {
      if (root.dataset.themeScope === adminThemeScope) {
        root.classList.remove("dark");
        delete root.dataset.themeScope;
      }
    };
  }, [adminDark, adminThemeScope]);

  // Show neutral loading state until tenant data is fully resolved
  // This prevents flash of wrong theme/permissions from another tenant
  if (!tenantReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted-foreground/30 border-t-muted-foreground" />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div
        id="admin-layout-root"
        data-tenant={user?.id}
        style={adminThemeStyle}
        className={`min-h-screen flex w-full bg-background ${adminDark ? "dark" : ""}`}
      >
        <AdminSidebar themeStyle={adminThemeStyle} />
        <div className="flex-1 flex flex-col min-w-0">
          <GlobalMaintenanceBanner />
          {/* Push notification install banner */}
          <AdminAnnouncementBanner />
          <AdminPushBanner />
          <AdminPendingOrdersAlert />
          <header className="h-14 flex items-center justify-between border-b border-border/60 bg-card/80 backdrop-blur-sm px-4 sticky top-0 z-30">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="mr-1" />
              <h2 className="text-sm font-medium text-muted-foreground hidden sm:block">
                {(settings as any)?.store_name || adminText.panel}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              {isTrial && trialDaysLeft > 0 && (
                <Badge variant="outline" className="border-warning/50 text-warning gap-1 text-xs hidden sm:flex">
                  <Clock className="h-3 w-3" />
                  {trialDaysLeft}d {adminText.remaining}
                </Badge>
              )}
              <ThemeToggle scope={adminThemeScope} applyToRoot={false} />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={startTutorial}
                    className="text-muted-foreground hover:text-primary transition-colors"
                  >
                    <HelpCircle className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{adminText.tutorial}</p>
                </TooltipContent>
              </Tooltip>
              <AdminNotificationsBell />
            </div>
          </header>
          <main className="flex-1 overflow-auto p-4 sm:p-6">
            <OnboardingTutorial />
            <TrialBanner />
            <Suspense fallback={
              <div className="flex items-center justify-center h-64">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            }>
              <Outlet />
            </Suspense>
          </main>
        </div>
        {!isCerebroPage && !isSuportePage && <WhatsAppSupportBubble />}
        {!isCerebroPage && !isSuportePage && <AIChatWidget />}
        {showWelcome && <WelcomeConfetti userName={welcomeName} />}
      </div>
    </SidebarProvider>
  );
}
