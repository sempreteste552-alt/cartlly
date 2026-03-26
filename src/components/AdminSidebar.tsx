import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Settings,
  Ticket,
  ExternalLink,
  LogOut,
  Store,
  CreditCard,
  Truck,
  Zap,
  Users,
  Bell,
  BellOff,
  Crown,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { AdminNotificationsBell } from "@/components/AdminNotificationsBell";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useStoreSettings } from "@/hooks/useStoreSettings";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useNavigate } from "react-router-dom";

const mainItems = [
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
  { title: "Produtos", url: "/admin/produtos", icon: Package },
  { title: "Pedidos", url: "/admin/pedidos", icon: ShoppingCart },
  { title: "Cupons", url: "/admin/cupons", icon: Ticket },
  { title: "Clientes", url: "/admin/clientes", icon: Users },
  { title: "Meu Plano", url: "/admin/plano", icon: Crown },
];

const configItems = [
  { title: "Loja", url: "/admin/config", icon: Settings },
  { title: "Pagamentos", url: "/admin/pagamentos", icon: CreditCard },
  { title: "Gateway", url: "/admin/gateway", icon: Zap },
  { title: "Frete", url: "/admin/frete", icon: Truck },
];

export function AdminSidebar() {
  const { state, setOpenMobile, isMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { data: settings } = useStoreSettings();
  const pushNotifs = usePushNotifications();
  const storeSlug = (settings as any)?.store_slug;

  // Auto-close mobile sidebar on route change
  useEffect(() => {
    if (isMobile) {
      setOpenMobile(false);
    }
  }, [location.pathname, isMobile, setOpenMobile]);

  const isActive = (path: string) => {
    if (path === "/admin") return location.pathname === "/admin";
    return location.pathname.startsWith(path);
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <Store className="h-5 w-5" />
          </div>
          {!collapsed && (
            <div className="flex flex-col flex-1">
              <span className="text-sm font-bold text-sidebar-foreground">Minha Loja</span>
              <span className="text-xs text-sidebar-foreground/60">Admin V0</span>
            </div>
          )}
          {!collapsed && <AdminNotificationsBell />}
        </div>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink to={item.url} end={item.url === "/admin"} className="hover:bg-sidebar-accent/50" activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium">
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
          <SidebarGroupLabel>Configurações</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {configItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink to={item.url} className="hover:bg-sidebar-accent/50" activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium">
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
                    className="hover:bg-sidebar-accent/50"
                  >
                    {pushNotifs.isSubscribed ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
                    {!collapsed && <span>{pushNotifs.isSubscribed ? "Desativar Push" : "Ativar Push"}</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <a href={storeSlug ? `/loja/${storeSlug}` : "/loja"} target="_blank" rel="noopener noreferrer" className="hover:bg-sidebar-accent/50">
                    <ExternalLink className="h-4 w-4" />
                    {!collapsed && <span>Ver Loja</span>}
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
          <p className="mb-2 truncate px-2 text-xs text-sidebar-foreground/60">{user?.email}</p>
        )}
        <Button variant="ghost" size={collapsed ? "icon" : "sm"} onClick={signOut} className="w-full justify-start text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
          <LogOut className="h-4 w-4" />
          {!collapsed && <span className="ml-2">Sair</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
