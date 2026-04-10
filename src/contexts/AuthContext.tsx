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
  maintenanceMode: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [maintenanceMode, setMaintenanceMode] = useState(false);

  // Initialize tracking hook
  useUserTracking(session?.user ?? null);

  useEffect(() => {
    // Initial maintenance check & session setup
    const initializeAuth = async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        
        const { data } = await supabase
          .from("platform_settings")
          .select("value")
          .eq("key", "maintenance_mode")
          .maybeSingle();
        
        const isMaintenance = (data?.value as any)?.value === true;
        setMaintenanceMode(isMaintenance);

        // If maintenance is on, and we have a session, check if we should kick them out immediately
        if (isMaintenance && currentSession?.user?.email && currentSession.user.email !== SUPER_ADMIN_EMAIL) {
          await supabase.auth.signOut();
          setSession(null);
          setLoading(false);
          return;
        }

        setSession(currentSession);
        
        // Setup inactivity timer if session exists
        if (currentSession && localStorage.getItem("stay_connected") !== "true") {
          const INACTIVITY_TIMEOUT = 24 * 60 * 60 * 1000;
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
        }

        setLoading(false);
      } catch (err) {
        console.error("Auth initialization error:", err);
        setLoading(false);
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);

        // After OAuth sign-in, inject referral_code into user metadata if present
        if (_event === "SIGNED_IN" && session?.user) {
          try {
            const ctxStr = localStorage.getItem("auth_context");
            if (ctxStr) {
              const ctx = JSON.parse(ctxStr);
              if (ctx.referral_code) {
                const existingRef = session.user.user_metadata?.referral_code;
                if (!existingRef) {
                  await supabase.auth.updateUser({
                    data: { referral_code: ctx.referral_code },
                  });
                }
                localStorage.removeItem("referral_code");
              }
            }
          } catch { /* ignore */ }
        }
      }
    );

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
          setMaintenanceMode(isMaintenance);
          const userEmail = session?.user?.email;
          
          if (isMaintenance && userEmail && userEmail !== SUPER_ADMIN_EMAIL) {
            toast.error("O sistema entrou em manutenção. Você será desconectado.");
            setTimeout(() => {
              supabase.auth.signOut();
            }, 1000);
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
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, maintenanceMode, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}

