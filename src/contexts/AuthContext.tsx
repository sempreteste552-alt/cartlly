import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { clearRuntimePwaManifest } from "@/lib/runtimePwaManifest";
import { useUserTracking } from "@/hooks/useUserTracking";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { checkIsSuperAdmin } from "@/lib/superAdminCheck";

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
  const queryClient = useQueryClient();

  useUserTracking(session?.user ?? null);

  useEffect(() => {
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

        if (isMaintenance && currentSession?.user) {
          const isAdmin = await checkIsSuperAdmin(currentSession.user.id);
          if (!isAdmin) {
            await supabase.auth.signOut();
            setSession(null);
            setLoading(false);
            return;
          }
        }

        setSession(currentSession);
        
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
        if (_event === "SIGNED_OUT") {
          queryClient.clear();
          clearRuntimePwaManifest();
          document.documentElement.style.removeProperty("--primary");
          document.documentElement.style.removeProperty("--ring");
          document.documentElement.style.removeProperty("--sidebar-primary");
          document.documentElement.style.removeProperty("--sidebar-ring");
          document.documentElement.style.removeProperty("--accent-foreground");
          document.documentElement.style.removeProperty("--store-primary");
          document.documentElement.style.removeProperty("--store-secondary");
          document.documentElement.style.removeProperty("--store-accent");
          document.documentElement.style.removeProperty("--store-button-bg");
          document.documentElement.style.removeProperty("--store-button-text");
          document.documentElement.style.removeProperty("--store-bg-base");
          document.documentElement.style.removeProperty("--store-text-base");
          document.documentElement.classList.remove("dark");
        }
        setSession(session);

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
        async (payload) => {
          const isMaintenance = (payload.new as any)?.value?.value === true;
          setMaintenanceMode(isMaintenance);
          
          if (isMaintenance && session?.user) {
            const isAdmin = await checkIsSuperAdmin(session.user.id);
            if (!isAdmin) {
              toast.error("O sistema entrou em manutenção. Você será desconectado.");
              setTimeout(() => {
                supabase.auth.signOut();
              }, 1000);
            }
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
      supabase.removeChannel(maintenanceChannel);
    };
  }, [session?.user?.id]);

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
