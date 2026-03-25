import { useEffect } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/AdminSidebar";
import { Outlet } from "react-router-dom";
import { useStoreSettings } from "@/hooks/useStoreSettings";
import { AIChatWidget } from "@/components/AIChatWidget";
import { useStoreSettings } from "@/hooks/useStoreSettings";

export function AdminLayout() {
  const { data: settings } = useStoreSettings();

  // Apply admin colors dynamically
  useEffect(() => {
    if (settings) {
      const root = document.documentElement;
      const adminPrimary = (settings as any).admin_primary_color || "#6d28d9";
      const adminAccent = (settings as any).admin_accent_color || "#8b5cf6";
      
      // Convert hex to HSL and set CSS vars
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
      <div className="min-h-screen flex w-full">
        <AdminSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-14 flex items-center border-b border-border bg-card px-4">
            <SidebarTrigger className="mr-4" />
            <h2 className="text-sm font-medium text-muted-foreground">Painel Administrativo</h2>
          </header>
          <main className="flex-1 overflow-auto p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
