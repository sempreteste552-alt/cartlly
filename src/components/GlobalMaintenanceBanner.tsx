import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, Info, Bell, X } from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "./ui/button";

export function GlobalMaintenanceBanner() {
  const [closed, setClosed] = useState(false);

  const { data: globalNotification } = useQuery({
    queryKey: ["global_admin_notification"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_notifications")
        .select("*")
        .is("target_user_id", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) return null;
      return data;
    },
    refetchInterval: 30000, // Check every 30 seconds
  });

  // Reset closed state if a new notification arrives
  useEffect(() => {
    if (globalNotification) {
      const lastSeenId = localStorage.getItem("last_global_notification_id");
      if (lastSeenId !== globalNotification.id) {
        setClosed(false);
      }
    }
  }, [globalNotification]);

  if (!globalNotification || closed) return null;

  const handleClose = () => {
    setClosed(true);
    localStorage.setItem("last_global_notification_id", globalNotification.id);
  };

  const getStyles = () => {
    switch (globalNotification.type) {
      case "warning":
        return {
          bg: "bg-amber-500",
          icon: <AlertTriangle className="h-5 w-5 text-white" />,
          text: "text-white",
        };
      case "alert":
        return {
          bg: "bg-destructive",
          icon: <Bell className="h-5 w-5 text-white" />,
          text: "text-white",
        };
      default:
        return {
          bg: "bg-primary",
          icon: <Info className="h-5 w-5 text-white" />,
          text: "text-white",
        };
    }
  };

  const styles = getStyles();

  return (
    <div className={`${styles.bg} ${styles.text} px-4 py-2 flex items-center justify-between shadow-md animate-in slide-in-from-top duration-300 relative z-50`}>
      <div className="flex items-center gap-3 max-w-[90%] mx-auto">
        {styles.icon}
        <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
          <span className="font-bold text-sm whitespace-nowrap">{globalNotification.title}:</span>
          <span className="text-sm opacity-90">{globalNotification.message}</span>
        </div>
      </div>
      <Button 
        variant="ghost" 
        size="icon" 
        className="h-8 w-8 text-white hover:bg-white/20 shrink-0"
        onClick={handleClose}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
