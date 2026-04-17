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
import { motion } from "framer-motion";
import sidebarBg from "@/assets/sidebar-bg.png";

const AnimatedText = ({ text, className, delay = 0 }: { text: string; className?: string; delay?: number }) => {
  return (
    <motion.span 
      className={className}
      initial="hidden"
      animate="visible"
      variants={{
        visible: {
          transition: {
            staggerChildren: 0.03,
            delayChildren: delay,
          },
        },
      }}
    >
      {text.split("").map((char, index) => (
        <motion.span
          key={index}
          variants={{
            hidden: { opacity: 0, x: -2 },
            visible: { opacity: 1, x: 0 },
          }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          {char}
        </motion.span>
      ))}
    </motion.span>
  );
};

export function AdminSidebar({ themeStyle }: { themeStyle?: CSSProperties }) {
  const { state, setOpenMobile, isMobile } = useSidebar();
  const { t, locale } = useTranslation();
  const { slug: urlSlug } = useParams();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { data: settings } = useStoreSettings();
  const { ctx, role, isCollaborator } = useTenantContext();
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
  const isOwner = role === "owner" && !isCollaborator;
  const isAdmin = (role === "admin" || role === "owner") && !isCollaborator;
  const isStaff = isEditor || isAdmin || (role === "owner" || role === "admin"); // Staff can be collaborators
  const isRealOwner = isOwner;

  const mainItems = [
    { title: t.sidebar.dashboard, url: adminBasePath, icon: LayoutDashboard, isNew: false, show: true },
    { title: t.sidebar.products, url: `${adminBasePath}/produtos`, icon: Package, isNew: false, show: true },
    { title: t.sidebar.orders, url: `${adminBasePath}/pedidos`, icon: ShoppingCart, isNew: false, show: true },
    { title: locale === 'pt' ? 'Vendas Externas' : 'External Sales', url: `${adminBasePath}/vendas-externas`, icon: ShoppingBag, isNew: true, show: true },
    { title: t.sidebar.customers, url: `${adminBasePath}/clientes`, icon: Users, isNew: false, show: true },
    { title: t.sidebar.collaborators, url: `${adminBasePath}/colaboradores`, icon: Users, isNew: true, show: isRealOwner },
    { title: t.sidebar.notifications, url: `${adminBasePath}/notificacoes`, icon: Bell, isNew: false, show: true },
    { title: t.sidebar.support, url: `${adminBasePath}/suporte`, icon: MessageCircle, isNew: false, badgeCount: supportUnreadCount, show: true },
  ].filter(i => i.show !== false);

  const marketingItems = [
    { title: t.sidebar.aiBrain, url: `${adminBasePath}/cerebro`, icon: Bot, isNew: true, show: true },
    { title: t.sidebar.coupons, url: `${adminBasePath}/cupons`, icon: Ticket, isNew: false, show: true },
    { title: t.sidebar.automation, url: `${adminBasePath}/automacao`, icon: Zap, isNew: true, show: true },
    { title: t.sidebar.referrals, url: `${adminBasePath}/indicacoes`, icon: Gift, isNew: true, show: true },
    { title: t.sidebar.platformReferrals, url: `${adminBasePath}/indicacoes-plataforma`, icon: Share2, isNew: true, show: true },
    { title: t.sidebar.loyalty, url: `${adminBasePath}/fidelidade`, icon: Award, isNew: true, show: true },
    { title: t.sidebar.whatsappAi, url: `${adminBasePath}/whatsapp-ia`, icon: MessageCircle, isNew: true, show: true },
    { title: t.sidebar.roulette, url: `${adminBasePath}/roleta`, icon: Gift, isNew: true, show: true },
  ].filter(i => i.show !== false);

  const configItems = [
    { title: t.sidebar.store, url: `${adminBasePath}/config`, icon: Settings, feature: null, show: true },
    { title: t.sidebar.pages, url: `${adminBasePath}/paginas`, icon: FileText, isNew: false, show: true },
    { title: t.sidebar.profit, url: `${adminBasePath}/lucro`, icon: DollarSign, isNew: false, show: isRealOwner },
    { title: t.sidebar.analytics, url: `${adminBasePath}/analytics`, icon: BarChart3, isNew: false, show: isRealOwner },
    { title: t.sidebar.payments, url: `${adminBasePath}/pagamentos`, icon: CreditCard, feature: "gateway" as const, show: isRealOwner },
    { title: t.sidebar.shipping, url: `${adminBasePath}/frete`, icon: Truck, feature: null, show: true },
    { title: t.sidebar.policies, url: `${adminBasePath}/politicas`, icon: Shield, isNew: false, show: true },
    { title: t.sidebar.myPlan, url: `${adminBasePath}/plano`, icon: Crown, feature: null, show: isRealOwner },
  ].filter(i => i.show !== false);

  useEffect(() => {
    if (isMobile) setOpenMobile(false);
  }, [location.pathname, isMobile, setOpenMobile]);

  const isActive = (path: string) => {
    if (path === adminBasePath) return location.pathname === adminBasePath;
    return location.pathname.startsWith(path);
  };

  return (
    <Sidebar collapsible="icon" style={themeStyle} className="bg-sidebar border-r border-sidebar-border/20 overflow-hidden relative group/sidebar">
      {/* Background layer that works on both mobile and desktop */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-sidebar/40 via-sidebar/60 to-sidebar/90" />
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-[0.25] transition-opacity duration-700 group-hover/sidebar:opacity-[0.35]"
          style={{ backgroundImage: `url(${sidebarBg})` }}
        />
      </div>

      <SidebarHeader className="p-4 relative z-10">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sidebar-primary to-sidebar-primary/70 text-sidebar-primary-foreground shadow-md">
            <Store className="h-4.5 w-4.5" />
          </div>
          {!collapsed && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="flex flex-col flex-1 min-w-0"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-sm font-semibold text-sidebar-foreground truncate">
                  <AnimatedText text={(settings as any)?.store_name || adminSidebarText.defaultStore} />
                </span>
                {(planSlug === "PREMIUM" || planSlug === "PRO") && isTenantActive(ctx) && (
                  <BadgeCheck className="h-4 w-4 text-[#0095f6] fill-[#0095f6] stroke-white stroke-[1.5px] shrink-0" />
                )}
              </div>
              <span className="text-[11px] text-sidebar-foreground/50">
                <AnimatedText text={t.sidebar.management} delay={0.5} />
              </span>
            </motion.div>
          )}
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1, delay: 0.3 }}
            >
              <AdminNotificationsBell />
            </motion.div>
          )}
        </div>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        {mainItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-[11px] uppercase tracking-wider text-sidebar-foreground/40 font-semibold">
              <AnimatedText text={t.sidebar.management} delay={0.1} />
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {mainItems.map((item, index) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)}>
                      <NavLink
                        to={item.url}
                        end={item.url === adminBasePath}
                        id={`sidebar-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                        className="hover:bg-sidebar-accent/60 transition-colors rounded-lg group"
                        onClick={() => isMobile && setOpenMobile(false)}
                      >
                        <motion.div 
                          className="relative"
                          initial={{ opacity: 0, scale: 0.8, x: -5 }}
                          animate={{ opacity: 1, scale: 1, x: 0 }}
                          transition={{ duration: 1, delay: index * 0.1, ease: "easeOut" }}
                        >
                          <item.icon className="h-4 w-4" />
                          {collapsed && !!item.badgeCount && item.badgeCount > 0 && (
                            <span className="absolute -top-2 -right-2 h-4 min-w-4 px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center shadow-sm">
                              {item.badgeCount > 9 ? "9+" : item.badgeCount}
                            </span>
                          )}
                        </motion.div>
                        {!collapsed && (
                          <span className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="truncate">
                              <AnimatedText text={item.title} delay={0.2 + (index * 0.1)} />
                            </span>
                            {!!item.badgeCount && item.badgeCount > 0 && (
                              <motion.span 
                                initial={{ opacity: 0, scale: 0 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 1.2, delay: 0.5 + (index * 0.1) }}
                                className="ml-auto h-5 min-w-5 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center shadow-sm"
                              >
                                {item.badgeCount > 99 ? "99+" : item.badgeCount}
                              </motion.span>
                            )}
                            {!item.badgeCount && item.isNew && (
                              <motion.span 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ duration: 1.5, delay: 0.6 + (index * 0.1) }}
                                className="ml-auto text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground animate-pulse leading-none"
                              >
                                {adminSidebarText.new}
                              </motion.span>
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
              <AnimatedText text={t.sidebar.marketing} delay={0.4} />
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {marketingItems.map((item, index) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)}>
                      <NavLink
                        to={item.url}
                        id={`sidebar-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                        className="hover:bg-sidebar-accent/60 transition-colors rounded-lg group"
                        onClick={() => isMobile && setOpenMobile(false)}
                      >
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.8, rotate: -5 }}
                          animate={{ opacity: 1, scale: 1, rotate: 0 }}
                          transition={{ duration: 1, delay: 0.5 + (index * 0.1), ease: "easeOut" }}
                        >
                          <item.icon className="h-4 w-4" />
                        </motion.div>
                        {!collapsed && (
                          <span className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="truncate">
                              <AnimatedText text={item.title} delay={0.6 + (index * 0.1)} />
                            </span>
                            {item.isNew && (
                              <motion.span 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ duration: 1.5, delay: 0.8 + (index * 0.1) }}
                                className="ml-auto text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground animate-pulse leading-none"
                              >
                                {adminSidebarText.new}
                              </motion.span>
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
              <AnimatedText text={t.sidebar.settings} delay={0.7} />
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {configItems.map((item, index) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)}>
                      <NavLink
                        to={item.url}
                        id={`sidebar-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                        className="hover:bg-sidebar-accent/60 transition-colors rounded-lg group"
                        onClick={() => isMobile && setOpenMobile(false)}
                      >
                        <motion.div 
                          initial={{ opacity: 0, x: -5 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.8, delay: 0.8 + (index * 0.1) }}
                        >
                          <item.icon className="h-4 w-4 text-sidebar-foreground/70 group-hover:text-sidebar-foreground" />
                        </motion.div>
                        {!collapsed && (
                          <span className="truncate">
                            <AnimatedText text={item.title} delay={0.9 + (index * 0.1)} />
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
        {!collapsed && (
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full justify-start gap-2 text-[10px] h-8 font-bold border-sidebar-primary/20 bg-sidebar-primary/5 hover:bg-sidebar-primary/10 text-sidebar-primary mb-2"
            onClick={() => {
              window.dispatchEvent(new CustomEvent('show_pwa_prompt'));
            }}
          >
            <Zap className="h-3 w-3 fill-sidebar-primary" />
            BAIXAR APP DASHBOARD
          </Button>
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
