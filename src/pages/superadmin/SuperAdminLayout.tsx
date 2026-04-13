import { useLayoutEffect } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { SuperAdminSidebar } from "./SuperAdminSidebar";
import { Outlet } from "react-router-dom";
import { ThemeToggle, useThemeScope } from "@/components/ThemeToggle";

export default function SuperAdminLayout() {
  const { dark } = useThemeScope("superadmin");

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.themeScope = "superadmin";
    root.classList.toggle("dark", dark);

    return () => {
      if (root.dataset.themeScope === "superadmin") {
        root.classList.remove("dark");
        delete root.dataset.themeScope;
      }
    };
  }, [dark]);

  return (
    <SidebarProvider>
      <div className={`min-h-screen flex w-full bg-background ${dark ? "dark" : ""}`}>
        <SuperAdminSidebar />
        <div className="flex-1 flex flex-col min-w-0 relative">
          <header className="h-14 flex items-center justify-between border-b border-border bg-card/80 backdrop-blur-sm px-4 sticky top-0 z-30">
            <div className="flex items-center">
              <SidebarTrigger className="mr-4" />
              <h2 className="text-sm font-medium text-muted-foreground">Super Admin</h2>
            </div>
            <ThemeToggle scope="superadmin" applyToRoot={false} />
          </header>
          <main className="flex-1 overflow-auto p-4 sm:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
