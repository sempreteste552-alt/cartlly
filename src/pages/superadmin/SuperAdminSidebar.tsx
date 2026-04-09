import {
  LayoutDashboard,
  Users,
  CreditCard,
  Bell,
  Settings,
  LogOut,
  ShieldCheck,
  FileText,
  ClipboardList,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSuperAdminBadges } from "@/hooks/useSuperAdminBadges";
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

function BadgeCount({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground animate-in fade-in zoom-in duration-200">
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function SuperAdminSidebar() {
  const { state, setOpenMobile, isMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { signOut, user } = useAuth();
  const badges = useSuperAdminBadges();

  const menuItems = [
    { title: "Dashboard", url: "/superadmin", icon: LayoutDashboard, badge: 0 },
    { title: "Tenants", url: "/superadmin/tenants", icon: Users, badge: badges.tenants },
    { title: "Solicitações", url: "/superadmin/solicitacoes", icon: FileText, badge: badges.solicitacoes },
    { title: "Planos", url: "/superadmin/planos", icon: CreditCard, badge: 0 },
    { title: "Notificações", url: "/superadmin/notificacoes", icon: Bell, badge: badges.notificacoes },
    { title: "Logs de Auditoria", url: "/superadmin/audit-logs", icon: ClipboardList, badge: 0 },
    { title: "Configurações", url: "/superadmin/config", icon: Settings, badge: 0 },
  ];

  const isActive = (path: string) => {
    if (path === "/superadmin") return location.pathname === "/superadmin";
    return location.pathname.startsWith(path);
  };

  const handleMenuClick = () => {
    if (isMobile) setOpenMobile(false);
  };

  const totalBadges = badges.tenants + badges.solicitacoes + badges.notificacoes;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-600 text-white">
            <ShieldCheck className="h-5 w-5" />
            {collapsed && totalBadges > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">
                {totalBadges > 99 ? "99+" : totalBadges}
              </span>
            )}
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-bold text-sidebar-foreground">Super Admin</span>
              <span className="text-xs text-sidebar-foreground/60">Cartlly</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink
                      to={item.url}
                      end={item.url === "/superadmin"}
                      className="hover:bg-sidebar-accent/50"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      onClick={handleMenuClick}
                    >
                      <div className="relative">
                        <item.icon className="h-4 w-4" />
                        {collapsed && item.badge > 0 && (
                          <span className="absolute -top-1.5 -right-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-destructive px-0.5 text-[8px] font-bold text-destructive-foreground">
                            {item.badge > 9 ? "9+" : item.badge}
                          </span>
                        )}
                      </div>
                      {!collapsed && (
                        <>
                          <span className="flex-1">{item.title}</span>
                          <BadgeCount count={item.badge} />
                        </>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarSeparator />

      <SidebarFooter className="p-3">
        {!collapsed && (
          <p className="mb-2 truncate px-2 text-xs text-sidebar-foreground/60">
            {user?.email}
          </p>
        )}
        <Button
          variant="ghost"
          size={collapsed ? "icon" : "sm"}
          onClick={signOut}
          className="w-full justify-start text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span className="ml-2">Sair</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
