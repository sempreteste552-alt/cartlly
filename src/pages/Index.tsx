import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { checkIsSuperAdmin } from "@/lib/superAdminCheck";
import cartlyLogo from "@/assets/cartly-logo.webp";

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
            // Even if it's a customer, we don't automatically redirect them 
            // to their last visited store from the platform root to avoid "trapping" them.
            // If they are a customer trying to access the platform root, they will go to setup-store
            // where ProtectedRoute will correctly show them an "Access Restricted" screen if they are not a merchant.
            navigate("/setup-store");
          }
        }
      };
      route();
    } else {
      navigate("/login");
    }
  }, [user, loading, navigate]);

  return <div className="min-h-screen bg-background" />;
};

export default Index;
