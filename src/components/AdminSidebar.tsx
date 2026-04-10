import { useEffect } from "react";
import {
  LayoutDashboard, Package, ShoppingCart, Settings, Ticket, ExternalLink, LogOut,
  Store, CreditCard, Truck, Zap, Users, Bell, BellOff, Crown, FileText, Bot, BadgeCheck, Lock, Gift
} from "lucide-react";
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
import { normalizeDomain } from "@/lib/storeDomain";

const mainItems = [
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard, isNew: false },
  { title: "Produtos", url: "/admin/produtos", icon: Package, isNew: false },
  { title: "Pedidos", url: "/admin/pedidos", icon: ShoppingCart, isNew: false },
  { title: "Clientes", url: "/admin/clientes", icon: Users, isNew: false },
  { title: "Cérebro IA", url: "/admin/cerebro", icon: Bot, isNew: true },
  { title: "Cupons", url: "/admin/cupons", icon: Ticket, isNew: false },
  { title: "Páginas", url: "/admin/paginas", icon: FileText, isNew: true },
  { title: "Automação", url: "/admin/automacao", icon: Zap, isNew: true },
  { title: "Indicações", url: "/admin/indicacoes", icon: Gift, isNew: false },
];

const configItemsBase = [
  { title: "Loja", url: "/admin/config", icon: Settings, feature: null },
  { title: "Pagamentos", url: "/admin/pagamentos", icon: CreditCard, feature: "gateway" as const },
  { title: "Gateway", url: "/admin/gateway", icon: Zap, feature: "gateway" as const },
  { title: "Frete", url: "/admin/frete", icon: Truck, feature: null },
  { title: "Meu Plano", url: "/admin/plano", icon: Crown, feature: null },
];

export function AdminSidebar() {
  const { state, setOpenMobile, isMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { data: settings } = useStoreSettings();
  const { ctx } = useTenantContext();
  const planSlug = ctx.planSlug;
  const pushNotifs = usePushNotifications();
  const storeSlug = (settings as any)?.store_slug;
  const customDomain = (settings as any)?.custom_domain;
  const domainStatus = (settings as any)?.domain_status;
  const sslReady = Boolean((settings as any)?.domain_verify_details?.sslReady);
  const sanitizedCustomDomain = normalizeDomain(customDomain);
  const storeUrl = (sanitizedCustomDomain && domainStatus === "verified" && sslReady)
    ? `https://${sanitizedCustomDomain}`
    : storeSlug ? `${window.location.origin}/loja/${storeSlug}` : "";

  const configItems = configItemsBase;

  useEffect(() => {
    if (isMobile) setOpenMobile(false);
  }, [location.pathname, isMobile, setOpenMobile]);

  const isActive = (path: string) => {
    if (path === "/admin") return location.pathname === "/admin";
    return location.pathname.startsWith(path);
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sidebar-primary to-sidebar-primary/70 text-sidebar-primary-foreground shadow-md">
            <Store className="h-4.5 w-4.5" />
          </div>
          {!collapsed && (
            <div className="flex flex-col flex-1 min-w-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-sm font-semibold text-sidebar-foreground truncate">
                  {(settings as any)?.store_name || "Minha Loja"}
                </span>
                {(planSlug === "PREMIUM" || planSlug === "PRO") && isTenantActive(ctx) && (
                  <BadgeCheck className="h-4 w-4 text-[#0095f6] fill-[#0095f6] stroke-white stroke-[1.5px] shrink-0" />
                )}
              </div>
              <span className="text-[11px] text-sidebar-foreground/50">Painel Admin</span>
            </div>
          )}
          {!collapsed && <AdminNotificationsBell />}
        </div>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-[11px] uppercase tracking-wider text-sidebar-foreground/40 font-semibold">
            Principal
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
                                Novo
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
            Configurações
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
                    onClick={() => pushNotifs.isSubscribed ? pushNotifs.unsubscribe() : pushNotifs.subscribe()}
                    disabled={pushNotifs.loading}
                    className="hover:bg-sidebar-accent/60 transition-colors rounded-lg flex flex-col items-start gap-1 h-auto py-2"
                  >
                     <div className="flex items-center gap-2 flex-1">
                       {pushNotifs.isSubscribed ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
                       {!collapsed && <span>{pushNotifs.isSubscribed ? "Desativar Push" : "Ativar Push"}</span>}
                       {!collapsed && (
                         <span className="ml-auto text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground animate-pulse leading-none">
                           Novo
                         </span>
                       )}
                    </div>
                    {!collapsed && !pushNotifs.isSubscribed && /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.matchMedia('(display-mode: standalone)').matches && (
                      <span className="text-[9px] text-primary font-medium leading-tight">
                        No iOS, use "Adicionar à Tela de Início" primeiro.
                      </span>
                    )}
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
                    {!collapsed && <span className="font-medium">Ver Loja</span>}
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
          <p className="mb-2 truncate px-2 text-[11px] text-sidebar-foreground/40">{user?.email}</p>
        )}
        <Button
          variant="ghost"
          size={collapsed ? "icon" : "sm"}
          onClick={signOut}
          className="w-full justify-start text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span className="ml-2">Sair</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
