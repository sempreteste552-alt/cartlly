import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const SUPER_ADMIN_EMAIL = "evelynesantoscruivinel@gmail.com";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, user, loading } = useAuth();

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

  if (loading || (!!user && user.email !== SUPER_ADMIN_EMAIL && profileLoading)) {
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

  // Check profile status
  if (profile?.status === "pending" || profile?.status === "rejected") {
    return <Navigate to="/conta-em-analise" replace />;
  }

  if (profile?.status === "blocked") {
    return <Navigate to="/conta-em-analise" replace />;
  }

  return <>{children}</>;
}
