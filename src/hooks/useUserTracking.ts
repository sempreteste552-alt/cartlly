import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";

export function useUserTracking(user: User | null) {
  useEffect(() => {
    if (!user) return;

    const updateLastSeen = async (isOnline: boolean) => {
      try {
        await supabase
          .from("profiles")
          .update({ 
            last_seen: new Date().toISOString(),
            is_online: isOnline
          })
          .eq("user_id", user.id);
      } catch (error) {
        console.error("Error updating last seen:", error);
      }
    };

    // Update once on mount
    updateLastSeen(true);

    // Update every 5 minutes if active
    const interval = setInterval(() => {
      updateLastSeen(true);
    }, 5 * 60 * 1000);

    // Update on visibility change
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        updateLastSeen(true);
      } else {
        updateLastSeen(false);
      }
    };

    // Update on window unload
    const handleUnload = () => {
      // Use navigator.sendBeacon or a synchronous fetch if possible, 
      // but Supabase client is async. 
      // We'll just try to set is_online to false.
      updateLastSeen(false);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleUnload);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleUnload);
      updateLastSeen(false);
    };
  }, [user]);
}
