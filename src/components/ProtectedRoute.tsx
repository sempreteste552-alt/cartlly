import { useAuth } from "@/contexts/AuthContext";
import { Navigate, useLocation, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import cartlyLogo from "@/assets/cartly-logo.png";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, user, loading, maintenanceMode } = useAuth();
  const location = useLocation();
  const { slug: urlSlug } = useParams();

  const { data: roleData, isLoading: roleLoading } = useQuery({
    queryKey: ["user_role", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id)
        .eq("role", "super_admin")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 15, // 15 minutes
  });

  const isSuperAdmin = roleData?.role === "super_admin";

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["profile_status", user?.id],
    enabled: !!user && !isSuperAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("status")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 15, // 15 minutes
  });

  const { data: storeSettings, isLoading: storeLoading } = useQuery({
    queryKey: ["store_admin_blocked", user?.id, urlSlug],
    enabled: !!user && !isSuperAdmin,
    queryFn: async () => {
      // If we have a slug, we might be a collaborator
      if (urlSlug) {
        const { data, error } = await supabase
          .from("store_settings")
          .select("admin_blocked, store_blocked, store_slug, user_id")
          .eq("store_slug", urlSlug)
          .maybeSingle();
        
        if (data) {
          // Check if user is collaborator
          if (data.user_id !== user!.id) {
             const { data: collab } = await supabase
               .from("store_collaborators")
               .select("id")
               .eq("store_owner_id", data.user_id)
               .eq("collaborator_id", user!.id)
               .maybeSingle();
             
             if (collab) return { ...data, isCollaborator: true };
          }
          return { ...data, isCollaborator: false };
        }
      }

      // Default check for owner
      const { data, error } = await supabase
        .from("store_settings")
        .select("admin_blocked, store_blocked, store_slug")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return { ...data, isCollaborator: false };
    },
    staleTime: 1000 * 60 * 15, // 15 minutes
  });

  const isStillLoading = loading || roleLoading || (!isSuperAdmin && (profileLoading || storeLoading));

  if (isStillLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background relative overflow-hidden">
        <div className="pointer-events-none fixed inset-0">
          <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-primary/5 blur-3xl animate-pulse" />
          <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-primary/5 blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
        </div>
        <div className="relative flex flex-col items-center gap-6 z-10">
          <div className="relative">
            <div className="h-20 w-20 animate-spin-slow rounded-full border-4 border-primary/20 border-t-primary" />
            <div className="absolute inset-0 flex items-center justify-center">
              <img src={cartlyLogo} alt="Cartlly" className="h-10 w-auto opacity-80 animate-pulse" />
            </div>
          </div>
          <h2 className="text-sm font-medium text-muted-foreground animate-pulse">Carregando painel...</h2>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }

  if (isSuperAdmin) return <>{children}</>;

  if (user?.user_metadata?.is_customer === true && !profile && !(storeSettings as any)?.isCollaborator) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4 text-center">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-lg space-y-4">
          <h1 className="text-xl font-bold">Acesso Restrito</h1>
          <p className="text-sm text-muted-foreground">Esta área é exclusiva para lojistas ou colaboradores.</p>
          <button onClick={() => { supabase.auth.signOut(); }} className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Sair e Entrar como Lojista
          </button>
        </div>
      </div>
    );
  }

  if (profile?.status === "blocked" || profile?.status === "rejected" || (storeSettings as any)?.admin_blocked === true || maintenanceMode) {
    return <Navigate to="/conta-em-analise" replace />;
  }

  if (!(storeSettings as any)?.store_slug && window.location.pathname !== "/setup-store" && !(storeSettings as any)?.isCollaborator) {
    return <Navigate to="/setup-store" replace />;
  }

  return <>{children}</>;
}
