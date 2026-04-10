import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useUserTracking } from "@/hooks/useUserTracking";
import { toast } from "sonner";

const SUPER_ADMIN_EMAIL = "evelynesantoscruivinel@gmail.com";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize tracking hook
  useUserTracking(session?.user ?? null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);

      // If user chose not to stay connected, sign out after 24h of inactivity
      if (session && localStorage.getItem("stay_connected") !== "true") {
        const INACTIVITY_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours
        let inactivityTimer: ReturnType<typeof setTimeout>;

        const resetTimer = () => {
          clearTimeout(inactivityTimer);
          inactivityTimer = setTimeout(() => {
            supabase.auth.signOut();
          }, INACTIVITY_TIMEOUT);
        };

        const events = ["mousedown", "keydown", "scroll", "touchstart"];
        events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }));
        resetTimer();

        // Cleanup on unmount handled by subscription cleanup
      }
    });

    // Real-time maintenance mode monitoring
    const maintenanceChannel = supabase
      .channel("platform-settings-changes")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "platform_settings",
          filter: "key=eq.maintenance_mode",
        },
        (payload) => {
          const isMaintenance = (payload.new as any)?.value?.value === true;
          const userEmail = session?.user?.email;
          
          if (isMaintenance && userEmail && userEmail !== SUPER_ADMIN_EMAIL) {
            toast.error("O sistema entrou em manutenção. Você será desconectado.");
            setTimeout(() => {
              supabase.auth.signOut();
            }, 3000);
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
      supabase.removeChannel(maintenanceChannel);
    };
  }, [session?.user?.email]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}

