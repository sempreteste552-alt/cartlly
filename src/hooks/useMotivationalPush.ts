import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";

const SESSION_KEY = "motivational_push_last";

/**
 * Sends a motivational AI push notification to the tenant
 * 1 minute after they come online, max 2x per day.
 * Uses sessionStorage to avoid re-triggering on SPA navigation.
 */
export function useMotivationalPush(user: User | null) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!user) return;

    // Only trigger on admin routes
    if (!window.location.pathname.startsWith("/admin")) return;

    // Check if already triggered this session
    const lastTriggered = sessionStorage.getItem(SESSION_KEY);
    if (lastTriggered) {
      const elapsed = Date.now() - parseInt(lastTriggered, 10);
      // Don't trigger again within 4 hours in same session
      if (elapsed < 4 * 60 * 60 * 1000) return;
    }

    // Wait 1 minute then fire
    timerRef.current = setTimeout(async () => {
      try {
        sessionStorage.setItem(SESSION_KEY, Date.now().toString());

        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
        const url = `https://${projectId}.supabase.co/functions/v1/ai-motivational-push`;

        await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token || ""}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ user_id: user.id }),
        });
      } catch (e) {
        // Silent fail — motivational push is non-critical
        console.debug("Motivational push skipped:", e);
      }
    }, 60 * 1000); // 1 minute delay

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [user]);
}
