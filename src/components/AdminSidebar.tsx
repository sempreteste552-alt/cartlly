import { useEffect } from "react";
import type { CSSProperties } from "react";
import {
  LayoutDashboard, Package, ShoppingCart, Settings, Ticket, ExternalLink, LogOut,
  Store, CreditCard, Truck, Zap, Users, Bell, BellOff, Crown, FileText, Bot, BadgeCheck, Lock, Gift, Shield, Award, DollarSign, BarChart3, MessageCircle
} from "lucide-react";
import { LanguageSelector } from "@/components/LanguageSelector";
import { useTranslation } from "@/i18n";
import { NavLink } from "@/components/NavLink";
import { AdminNotificationsBell } from "@/components/AdminNotificationsBell";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useStoreSettings } from "@/hooks/useStoreSettings";
import { useTenantContext } from "@/hooks/useTenantContext";
import { isTenantActive, canAccess } from "@/lib/planPermissions";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton,
  SidebarMenuItem, SidebarSeparator, useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { normalizeDomain, buildStoreUrl } from "@/lib/storeDomain";

export function AdminSidebar({ themeStyle }: { themeStyle?: CSSProperties }) {
  const { state, setOpenMobile, isMobile } = useSidebar();
  const { t, locale } = useTranslation();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { data: settings } = useStoreSettings();
  const { ctx } = useTenantContext();
  const planSlug = ctx.planSlug;
  const pushNotifs = usePushNotifications();
  const adminSidebarText = {
    pt: { defaultStore: "Minha Loja", new: "Novo", push: "Push" },
    en: { defaultStore: "My Store", new: "New", push: "Push" },
    es: { defaultStore: "Mi Tienda", new: "Nuevo", push: "Push" },
    fr: { defaultStore: "Ma Boutique", new: "Nouveau", push: "Push" },
  }[locale];
  const storeUrl = buildStoreUrl({
    slug: settings?.store_slug,
    customDomain: settings?.custom_domain,
    domainStatus: settings?.domain_status,
  });

  const mainItems = [
    { title: t.sidebar.dashboard, url: "/admin", icon: LayoutDashboard, isNew: false },
    { title: t.sidebar.products, url: "/admin/produtos", icon: Package, isNew: false },
    { title: t.sidebar.orders, url: "/admin/pedidos", icon: ShoppingCart, isNew: false },
    { title: t.sidebar.customers, url: "/admin/clientes", icon: Users, isNew: false },
    { title: t.sidebar.aiBrain, url: "/admin/cerebro", icon: Bot, isNew: true },
    { title: t.sidebar.coupons, url: "/admin/cupons", icon: Ticket, isNew: false },
    { title: t.sidebar.pages, url: "/admin/paginas", icon: FileText, isNew: false },
    { title: t.sidebar.automation, url: "/admin/automacao", icon: Zap, isNew: true },
    { title: t.sidebar.referrals, url: "/admin/indicacoes", icon: Gift, isNew: true },
    { title: t.sidebar.policies, url: "/admin/politicas", icon: Shield, isNew: false },
    { title: t.sidebar.loyalty, url: "/admin/fidelidade", icon: Award, isNew: true },
    { title: t.sidebar.profit, url: "/admin/lucro", icon: DollarSign, isNew: true },
    { title: t.sidebar.analytics, url: "/admin/analytics", icon: BarChart3, isNew: true },
    { title: t.sidebar.whatsappAi, url: "/admin/whatsapp-ia", icon: MessageCircle, isNew: true },
    { title: t.sidebar.support, url: "/admin/suporte", icon: MessageCircle, isNew: true },
  ];

  const configItems = [
    { title: t.sidebar.store, url: "/admin/config", icon: Settings, feature: null },
    { title: t.sidebar.payments, url: "/admin/pagamentos", icon: CreditCard, feature: "gateway" as const },
    { title: t.sidebar.gateway, url: "/admin/gateway", icon: Zap, feature: "gateway" as const },
    { title: t.sidebar.shipping, url: "/admin/frete", icon: Truck, feature: null },
    { title: t.sidebar.myPlan, url: "/admin/plano", icon: Crown, feature: null },
  ];

  useEffect(() => {
    if (isMobile) setOpenMobile(false);
  }, [location.pathname, isMobile, setOpenMobile]);

  const isActive = (path: string) => {
    if (path === "/admin") return location.pathname === "/admin";
    return location.pathname.startsWith(path);
  };

  return (
    <Sidebar collapsible="icon" style={themeStyle}>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sidebar-primary to-sidebar-primary/70 text-sidebar-primary-foreground shadow-md">
            <Store className="h-4.5 w-4.5" />
          </div>
          {!collapsed && (
            <div className="flex flex-col flex-1 min-w-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-sm font-semibold text-sidebar-foreground truncate">
                  {(settings as any)?.store_name || adminSidebarText.defaultStore}
                </span>
                {(planSlug === "PREMIUM" || planSlug === "PRO") && isTenantActive(ctx) && (
                  <BadgeCheck className="h-4 w-4 text-[#0095f6] fill-[#0095f6] stroke-white stroke-[1.5px] shrink-0" />
                )}
              </div>
              <span className="text-[11px] text-sidebar-foreground/50">{t.sidebar.management}</span>
            </div>
          )}
          {!collapsed && <AdminNotificationsBell />}
        </div>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-[11px] uppercase tracking-wider text-sidebar-foreground/40 font-semibold">
            {t.sidebar.management}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => {
                const isReferral = item.url === "/admin/indicacoes";
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)}>
                      <NavLink
                        to={item.url}
                        end={item.url === "/admin"}
                        id={`sidebar-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                        className={`hover:bg-sidebar-accent/60 transition-colors rounded-lg ${isReferral ? "sidebar-referral-item text-primary font-semibold" : ""}`}
                        activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      >
                        <item.icon className={`h-4 w-4 ${isReferral ? "text-primary" : ""}`} />
                        {!collapsed && (
                          <span className="flex items-center gap-2 flex-1">
                            {item.title}
                            {isReferral && <span className="referral-dot" />}
                            {item.isNew && (
                              <span className="ml-auto text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground animate-pulse leading-none">
                                {adminSidebarText.new}
                              </span>
                            )}
                          </span>
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-[11px] uppercase tracking-wider text-sidebar-foreground/40 font-semibold">
            {t.sidebar.settings}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {configItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink
                      to={item.url}
                      id={`sidebar-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                      className="hover:bg-sidebar-accent/60 transition-colors rounded-lg"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    >
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {pushNotifs.isSupported && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => navigate("/admin/config?tab=push")}
                    className="hover:bg-sidebar-accent/60 transition-colors rounded-lg flex flex-col items-start gap-1 h-auto py-2"
                  >
                     <div className="flex items-center gap-2 flex-1">
                       <Bell className="h-4 w-4" />
                       {!collapsed && <span>Push</span>}
                       {!collapsed && (
                         <span className="ml-auto text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground animate-pulse leading-none">
                           Novo
                         </span>
                       )}
                    </div>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <a
                    id="store-preview-btn"
                    href={storeUrl || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`hover:bg-sidebar-accent/60 transition-colors rounded-lg text-sidebar-primary ${!storeUrl ? "pointer-events-none opacity-50" : ""}`}
                    onClick={(e) => { if (!storeUrl) e.preventDefault(); }}
                  >
                    <ExternalLink className="h-4 w-4" />
                    {!collapsed && <span className="font-medium">{t.sidebar.openStore}</span>}
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarSeparator />

      <SidebarFooter className="p-3">
        {!collapsed && (
          <div className="flex items-center justify-between mb-2 px-2">
            <p className="truncate text-[11px] text-sidebar-foreground/40 flex-1">{user?.email}</p>
            <LanguageSelector compact className="h-7 w-7 text-sidebar-foreground/60 hover:text-sidebar-foreground" />
          </div>
        )}
        {collapsed && (
          <div className="flex justify-center mb-2">
            <LanguageSelector compact className="h-7 w-7 text-sidebar-foreground/60 hover:text-sidebar-foreground" />
          </div>
        )}
        <Button
          variant="ghost"
          size={collapsed ? "icon" : "sm"}
          onClick={signOut}
          className="w-full justify-start text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span className="ml-2">{t.auth.logout}</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
