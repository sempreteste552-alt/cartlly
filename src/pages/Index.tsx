import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const SUPER_ADMIN_EMAIL = "evelynesantoscruivinel@gmail.com";

  useEffect(() => {
    if (user) {
      if (user.email === SUPER_ADMIN_EMAIL) {
        navigate("/superadmin");
      } else {
        const checkStore = async () => {
          const { data: store } = await supabase
            .from("store_settings")
            .select("store_slug")
            .eq("user_id", user.id)
            .maybeSingle();
          
          if (store?.store_slug) {
            navigate("/admin");
          } else {
            navigate("/login");
          }
        };
        checkStore();
      }
    } else {
      navigate("/login");
    }
  }, [user, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
};

export default Index;
