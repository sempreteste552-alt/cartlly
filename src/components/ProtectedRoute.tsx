import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const SUPER_ADMIN_EMAIL = "evelynesantoscruivinel@gmail.com";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, user, loading, maintenanceMode } = useAuth();

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["profile_status", user?.id],
    enabled: !!user && user.email !== SUPER_ADMIN_EMAIL,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("status")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: storeSettings, isLoading: storeLoading } = useQuery({
    queryKey: ["store_admin_blocked", user?.id],
    enabled: !!user && user.email !== SUPER_ADMIN_EMAIL,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_settings")
        .select("admin_blocked, store_blocked, store_slug")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const isNonSuperAdmin = !!user && user.email !== SUPER_ADMIN_EMAIL;
  const isStillLoading = loading || (isNonSuperAdmin && (profileLoading || storeLoading));

  if (isStillLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // Super admin always has access
  if (user?.email === SUPER_ADMIN_EMAIL) {
    return <>{children}</>;
  }

  // Block customer accounts from accessing admin panel ONLY if they don't have a merchant profile
  if (user?.user_metadata?.is_customer === true && !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-lg text-center space-y-4">
          <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-full bg-destructive/10">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-destructive" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
          </div>
          <h1 className="text-xl font-bold text-foreground">Acesso Restrito</h1>
          <p className="text-sm text-muted-foreground">Esta área é exclusiva para lojistas. Contas de clientes não têm acesso ao painel administrativo.</p>
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            <p className="text-xs text-destructive font-medium">🚫 Você está logado como cliente, não como lojista.</p>
          </div>
          <div className="flex flex-col gap-2 pt-2">
            <button onClick={() => { import("@/integrations/supabase/client").then(m => m.supabase.auth.signOut()); }} className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
              Sair e Entrar como Lojista
            </button>
            <button 
              onClick={() => {
                const storeSlug = (storeSettings as any)?.store_slug;
                const lastSlug = localStorage.getItem("last_visited_store");
                const backUrl = storeSlug ? `/loja/${storeSlug}` : (lastSlug ? `/loja/${lastSlug}` : "/");
                window.location.href = backUrl;
              }} 
              className="w-full rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors"
            >
              Voltar para a Loja
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Check if account is blocked or deactivated
  if (profile?.status === "blocked" || profile?.status === "rejected") {
    return <Navigate to="/conta-em-analise" replace />;
  }

  // Maintenance mode is handled by AuthContext (signs out non-super-admin users immediately).
  // No redirect needed here — avoids stale state causing false redirects.

  // Check admin panel blocked
  if ((storeSettings as any)?.admin_blocked === true) {
    return <Navigate to="/conta-em-analise" replace />;
  }

  // Check if store slug is missing (onboarding)
  if (!(storeSettings as any)?.store_slug && window.location.pathname !== "/setup-store") {
    return <Navigate to="/setup-store" replace />;
  }

  return <>{children}</>;
}
