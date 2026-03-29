import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const SUPER_ADMIN_EMAIL = "evelynesantoscruivinel@gmail.com";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, user, loading } = useAuth();

  // Block customers from accessing admin panel
  const isCustomer = user?.user_metadata?.is_customer === true;

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
        .select("admin_blocked, store_blocked")
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

  // Customers must never access admin panel
  if (isCustomer) {
    return <Navigate to="/login" replace />;
  }

  // Super admin always has access
  if (user?.email === SUPER_ADMIN_EMAIL) {
    return <>{children}</>;
  }

  // Check if account is blocked or deactivated
  if (profile?.status === "blocked" || profile?.status === "rejected") {
    return <Navigate to="/conta-em-analise" replace />;
  }

  // Check admin panel blocked
  if ((storeSettings as any)?.admin_blocked === true) {
    return <Navigate to="/conta-em-analise" replace />;
  }

  return <>{children}</>;
}
