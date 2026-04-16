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
  Gift,
  Globe,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSuperAdminBadges } from "@/hooks/useSuperAdminBadges";
import { useEffect } from "react";
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
import { motion } from "framer-motion";

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

  useEffect(() => {
    if (isMobile) {
      setOpenMobile(false);
    }
  }, [location.pathname, isMobile, setOpenMobile]);

  const menuItems = [
    { title: "Dashboard", url: "/superadmin", icon: LayoutDashboard, badge: 0 },
    { title: "Tenants", url: "/superadmin/tenants", icon: Users, badge: badges.tenants },
    { title: "Solicitações", url: "/superadmin/solicitacoes", icon: FileText, badge: badges.solicitacoes },
    { title: "Domínios", url: "/superadmin/dominios", icon: Globe, badge: badges.dominios || 0 },
    { title: "Planos", url: "/superadmin/planos", icon: CreditCard, badge: 0 },
    { title: "Notificações", url: "/superadmin/notificacoes", icon: Bell, badge: badges.notificacoes },
    { title: "Logs de Auditoria", url: "/superadmin/audit-logs", icon: ClipboardList, badge: 0 },
    { title: "Indicações", url: "/superadmin/indicacoes", icon: Gift, badge: 0 },
    { title: "Banners Admin", url: "/superadmin/banners", icon: Bell, badge: 0 },
    { title: "Roleta de Prêmios", url: "/superadmin/roulette", icon: Gift, badge: 0 },
    { title: "Configurações", url: "/superadmin/config", icon: Settings, badge: 0 },
  ];

  const isActive = (path: string) => {
    if (path === "/superadmin") return location.pathname === "/superadmin";
    return location.pathname.startsWith(path);
  };

  const totalBadges = badges.tenants + badges.solicitacoes + badges.notificacoes + (badges.dominios || 0);

  return (
    <Sidebar collapsible="icon" className="border-r border-border/50">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-600 text-white shadow-sm">
            <ShieldCheck className="h-5 w-5" />
            {collapsed && totalBadges > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground border-2 border-sidebar shadow-sm">
                {totalBadges > 99 ? "99+" : totalBadges}
              </span>
            )}
          </div>
          {!collapsed && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 1, ease: "easeOut" }}
              className="flex flex-col"
            >
              <span className="text-sm font-bold text-sidebar-foreground">
                <AnimatedText text="Super Admin" />
              </span>
              <span className="text-[10px] text-sidebar-foreground/50 uppercase tracking-wider font-medium">
                <AnimatedText text="Cartlly Platform" delay={0.5} />
              </span>
            </motion.div>
          )}
        </div>
      </SidebarHeader>

      <SidebarSeparator className="opacity-50" />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-wider font-semibold opacity-40">
            <AnimatedText text="Menu Principal" delay={0.1} />
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item, index) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink
                      to={item.url}
                      end={item.url === "/superadmin"}
                      className="hover:bg-sidebar-accent/50 transition-colors group"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                    >
                      <motion.div 
                        className="relative flex items-center"
                        initial={{ opacity: 0, scale: 0.8, x: -5 }}
                        animate={{ opacity: 1, scale: 1, x: 0 }}
                        transition={{ duration: 1, delay: index * 0.08, ease: "easeOut" }}
                      >
                        <item.icon className="h-4 w-4" />
                        {collapsed && item.badge > 0 && (
                          <span className="absolute -top-1.5 -right-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-destructive px-0.5 text-[8px] font-bold text-destructive-foreground border border-sidebar shadow-sm">
                            {item.badge > 9 ? "9+" : item.badge}
                          </span>
                        )}
                      </motion.div>
                      {!collapsed && (
                        <>
                          <span className="flex-1 truncate">
                            <AnimatedText text={item.title} delay={0.2 + (index * 0.08)} />
                          </span>
                          <motion.div
                            initial={{ opacity: 0, scale: 0 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.8, delay: 0.5 + (index * 0.08) }}
                          >
                            <BadgeCount count={item.badge} />
                          </motion.div>
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

      <SidebarSeparator className="opacity-50" />

      <SidebarFooter className="p-3">
        {!collapsed && (
          <p className="mb-2 truncate px-2 text-[11px] text-sidebar-foreground/40 font-medium">
            {user?.email}
          </p>
        )}
        <Button
          variant="ghost"
          size={collapsed ? "icon" : "sm"}
          onClick={signOut}
          className="w-full justify-start text-sidebar-foreground/60 hover:bg-destructive/10 hover:text-destructive transition-colors"
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span className="ml-2 font-medium">Sair</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
