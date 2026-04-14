import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { checkIsSuperAdmin } from "@/lib/superAdminCheck";
import cartlyLogo from "@/assets/cartly-logo.png";

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;

    if (user) {
      const route = async () => {
        const isAdmin = await checkIsSuperAdmin(user.id);
        if (isAdmin) {
          navigate("/superadmin");
        } else {
          const { data: store } = await supabase
            .from("store_settings")
            .select("store_slug")
            .eq("user_id", user.id)
            .maybeSingle();
          
          if (store?.store_slug) {
            navigate(`/painel/${store.store_slug}`);
          } else {
            // Check if it's a customer
            if (user.user_metadata?.is_customer) {
              const lastStore = localStorage.getItem("last_visited_store");
              if (lastStore) {
                navigate(`/loja/${lastStore}`);
              } else {
                navigate("/login");
              }
            } else {
              navigate("/setup-store");
            }
          }
        }
      };
      route();
    } else {
      navigate("/login");
    }
  }, [user, loading, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background relative overflow-hidden">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-primary/5 blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-primary/5 blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
      </div>

      <div className="relative flex flex-col items-center gap-6 z-10">
        <div className="relative">
          <div className="h-20 w-20 animate-spin-slow rounded-full border-4 border-primary/20 border-t-primary shadow-[0_0_20px_rgba(var(--primary),0.3)]" />
          <div className="absolute inset-0 flex items-center justify-center">
            <img src={cartlyLogo} alt="Cartlly" className="h-10 w-auto opacity-80 animate-pulse" />
          </div>
        </div>
        <div className="flex flex-col items-center gap-2">
          <h2 className="text-sm font-medium text-muted-foreground animate-pulse">Carregando...</h2>
          <div className="flex gap-1">
            <div className="h-1 w-1 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: "0ms" }} />
            <div className="h-1 w-1 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: "150ms" }} />
            <div className="h-1 w-1 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
