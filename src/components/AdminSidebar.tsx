import { useEffect } from "react";
import type { CSSProperties } from "react";
import {
  LayoutDashboard, Package, ShoppingCart, ShoppingBag, Settings, Ticket, ExternalLink, LogOut,
  Store, CreditCard, Truck, Zap, Users, Bell, Bot, BadgeCheck, FileText, Gift, Shield, Award, DollarSign, BarChart3, MessageCircle, Share2, Crown
} from "lucide-react";
import { LanguageSelector } from "@/components/LanguageSelector";
import { useTranslation } from "@/i18n";
import { NavLink } from "@/components/NavLink";
import { AdminNotificationsBell } from "@/components/AdminNotificationsBell";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useStoreSettings } from "@/hooks/useStoreSettings";
import { useTenantContext } from "@/hooks/useTenantContext";
import { useAdminSupportUnreadCount } from "@/hooks/useAdminSupportUnreadCount";
import { isTenantActive, canAccess } from "@/lib/planPermissions";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton,
  SidebarMenuItem, SidebarSeparator, useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { buildStoreUrl } from "@/lib/storeDomain";

export function AdminSidebar({ themeStyle }: { themeStyle?: CSSProperties }) {
  const { state, setOpenMobile, isMobile } = useSidebar();
  const { t, locale } = useTranslation();
  const { slug: urlSlug } = useParams();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { data: settings } = useStoreSettings();
  const { ctx, role } = useTenantContext();
  const supportUnreadCount = useAdminSupportUnreadCount();
  const planSlug = ctx.planSlug;
  const pushNotifs = usePushNotifications();
  
  const storeSlug = settings?.store_slug || urlSlug;
  const adminBasePath = storeSlug ? `/painel/${storeSlug}` : "/admin";

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

  const isViewer = role === "viewer";
  const isEditor = role === "editor";
  const isOwner = role === "owner";
  const isAdmin = role === "admin" || isOwner;

  const mainItems = [
    { title: t.sidebar.dashboard, url: adminBasePath, icon: LayoutDashboard, isNew: false, show: isAdmin || isViewer },
    { title: t.sidebar.products, url: `${adminBasePath}/produtos`, icon: Package, isNew: false, show: isAdmin || isEditor || isViewer },
    { title: t.sidebar.orders, url: `${adminBasePath}/pedidos`, icon: ShoppingCart, isNew: false, show: isAdmin || isEditor || isViewer },
    { title: locale === 'pt' ? 'Vendas Externas' : 'External Sales', url: `${adminBasePath}/vendas-externas`, icon: ShoppingBag, isNew: true, show: isAdmin || isEditor },
    { title: t.sidebar.customers, url: `${adminBasePath}/clientes`, icon: Users, isNew: false, show: isAdmin || isEditor || isViewer },
    { title: t.sidebar.collaborators, url: `${adminBasePath}/colaboradores`, icon: Users, isNew: true, show: isAdmin },
    { title: t.sidebar.notifications, url: `${adminBasePath}/notificacoes`, icon: Bell, isNew: false, show: isAdmin || isEditor },
    { title: t.sidebar.support, url: `${adminBasePath}/suporte`, icon: MessageCircle, isNew: false, badgeCount: supportUnreadCount, show: isAdmin || isEditor },
  ].filter(i => i.show !== false);

  const marketingItems = [
    { title: t.sidebar.aiBrain, url: `${adminBasePath}/cerebro`, icon: Bot, isNew: true, show: isAdmin || isEditor },
    { title: t.sidebar.coupons, url: `${adminBasePath}/cupons`, icon: Ticket, isNew: false, show: isAdmin || isEditor },
    { title: t.sidebar.automation, url: `${adminBasePath}/automacao`, icon: Zap, isNew: true, show: isAdmin || isEditor },
    { title: t.sidebar.referrals, url: `${adminBasePath}/indicacoes`, icon: Gift, isNew: true, show: isAdmin || isEditor },
    { title: t.sidebar.platformReferrals, url: `${adminBasePath}/indicacoes-plataforma`, icon: Share2, isNew: true, show: isAdmin || isEditor },
    { title: t.sidebar.loyalty, url: `${adminBasePath}/fidelidade`, icon: Award, isNew: true, show: isAdmin || isEditor },
    { title: t.sidebar.whatsappAi, url: `${adminBasePath}/whatsapp-ia`, icon: MessageCircle, isNew: true, show: isAdmin || isEditor },
    { title: t.sidebar.roulette, url: `${adminBasePath}/roleta`, icon: Gift, isNew: true, show: isAdmin || isEditor },
  ].filter(i => i.show !== false);

  const configItems = [
    { title: t.sidebar.store, url: `${adminBasePath}/config`, icon: Settings, feature: null, show: isAdmin || isEditor },
    { title: t.sidebar.pages, url: `${adminBasePath}/paginas`, icon: FileText, isNew: false, show: isAdmin || isEditor },
    { title: t.sidebar.profit, url: `${adminBasePath}/lucro`, icon: DollarSign, isNew: false, show: isAdmin || isViewer },
    { title: t.sidebar.analytics, url: `${adminBasePath}/analytics`, icon: BarChart3, isNew: false, show: isAdmin || isViewer },
    { title: t.sidebar.payments, url: `${adminBasePath}/pagamentos`, icon: CreditCard, feature: "gateway" as const, show: isAdmin },
    { title: t.sidebar.shipping, url: `${adminBasePath}/frete`, icon: Truck, feature: null, show: isAdmin || isEditor },
    { title: t.sidebar.policies, url: `${adminBasePath}/politicas`, icon: Shield, isNew: false, show: isAdmin || isEditor },
    { title: t.sidebar.myPlan, url: `${adminBasePath}/plano`, icon: Crown, feature: null, show: isAdmin },
  ].filter(i => i.show !== false);

  useEffect(() => {
    if (isMobile) setOpenMobile(false);
  }, [location.pathname, isMobile, setOpenMobile]);

  const isActive = (path: string) => {
    if (path === adminBasePath) return location.pathname === adminBasePath;
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
        {mainItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-[11px] uppercase tracking-wider text-sidebar-foreground/40 font-semibold">
              {t.sidebar.management}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {mainItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)}>
                      <NavLink
                        to={item.url}
                        end={item.url === adminBasePath}
                        id={`sidebar-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                        className="hover:bg-sidebar-accent/60 transition-colors rounded-lg"
                        onClick={() => isMobile && setOpenMobile(false)}
                      >
                        <div className="relative">
                          <item.icon className="h-4 w-4" />
                          {collapsed && !!item.badgeCount && item.badgeCount > 0 && (
                            <span className="absolute -top-2 -right-2 h-4 min-w-4 px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center shadow-sm">
                              {item.badgeCount > 9 ? "9+" : item.badgeCount}
                            </span>
                          )}
                        </div>
                        {!collapsed && (
                          <span className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="truncate">{item.title}</span>
                            {!!item.badgeCount && item.badgeCount > 0 && (
                              <span className="ml-auto h-5 min-w-5 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center shadow-sm">
                                {item.badgeCount > 99 ? "99+" : item.badgeCount}
                              </span>
                            )}
                            {!item.badgeCount && item.isNew && (
                              <span className="ml-auto text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground animate-pulse leading-none">
                                {adminSidebarText.new}
                              </span>
                            )}
                          </span>
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {marketingItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-[11px] uppercase tracking-wider text-sidebar-foreground/40 font-semibold">
              {t.sidebar.marketing}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {marketingItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)}>
                      <NavLink
                        to={item.url}
                        id={`sidebar-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                        className="hover:bg-sidebar-accent/60 transition-colors rounded-lg"
                        onClick={() => isMobile && setOpenMobile(false)}
                      >
                        <item.icon className="h-4 w-4" />
                        {!collapsed && (
                          <span className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="truncate">{item.title}</span>
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
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {configItems.length > 0 && (
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
                        onClick={() => isMobile && setOpenMobile(false)}
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
        )}

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
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
