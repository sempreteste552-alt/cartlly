import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const SOUNDS = {
  RECEIVED: "https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3"
};

const playSound = (type: "RECEIVED") => {
  try {
    const audio = new Audio(SOUNDS[type]);
    audio.volume = 0.5;
    audio.play().catch(() => {});
  } catch (err) {
    console.error("Error playing sound:", err);
  }
};

export interface AdminNotification {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  created_at: string;
  sender_user_id: string;
  target_user_id: string | null;
}

export function useAdminNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const loadNotifications = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("admin_notifications")
      .select("*")
      .eq("target_user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) setNotifications(data as AdminNotification[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("admin-notifications")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "admin_notifications" }, (payload) => {
        const n = payload.new as AdminNotification;
        if (n.target_user_id === user.id || n.target_user_id === null) {
          setNotifications((prev) => [n, ...prev]);
          // Pop-up toast for 3 seconds
          const emoji = getNotificationEmoji(n.type);
          toast(`${emoji} ${n.title}`, {
            description: n.message,
            duration: 3000,
          });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const markAsRead = async (id: string) => {
    await supabase.from("admin_notifications").update({ read: true }).eq("id", id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const markAllAsRead = async () => {
    if (!user) return;
    await supabase
      .from("admin_notifications")
      .update({ read: true })
      .eq("target_user_id", user.id)
      .eq("read", false);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const deleteNotification = async (id: string) => {
    const { error } = await supabase.from("admin_notifications").delete().eq("id", id);
    if (!error) {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      toast.success("Notificação removida");
    } else {
      toast.error("Erro ao remover notificação");
    }
  };

  const clearAll = async () => {
    if (!user) return;
    const { error } = await supabase.from("admin_notifications").delete().eq("target_user_id", user.id);
    if (!error) {
      setNotifications([]);
      toast.success("Todas as notificações foram removidas");
    } else {
      toast.error("Erro ao limpar notificações");
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return { 
    notifications, 
    loading, 
    unreadCount, 
    markAsRead, 
    markAllAsRead, 
    deleteNotification,
    clearAll,
    refresh: loadNotifications 
  };
}

export function getNotificationEmoji(type: string): string {
  const emojis: Record<string, string> = {
    new_order: "🛒",
    order_confirmed: "✅",
    order_shipped: "📦",
    order_delivered: "🎉",
    order_cancelled: "❌",
    payment_approved: "💰",
    payment_refused: "🚫",
    abandoned_cart: "🛒💨",
    new_customer: "👤",
    low_stock: "⚠️",
    review: "⭐",
    info: "ℹ️",
    high_value_customer: "🔝",
  };
  return emojis[type] || "🔔";
}
