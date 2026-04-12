import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCustomerAuth } from "@/hooks/useCustomerAuth";

const NOTIFICATION_SOUND = "/sounds/notification.mp3";

const playNotificationSound = () => {
  try {
    const audio = new Audio(NOTIFICATION_SOUND);
    audio.volume = 0.6;
    audio.play().catch(() => {});
  } catch (err) {
    console.error("Error playing sound:", err);
  }
};

export function useCustomerNotifications(storeUserId?: string) {
  const { user } = useCustomerAuth();
  const qc = useQueryClient();

  const sessionId = localStorage.getItem("chat_session_id");

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["customer_notifications", storeUserId, user?.id, sessionId],
    enabled: !!storeUserId,
    queryFn: async () => {
      // 1. Fetch tenant_messages (broadcasts/alerts)
      let tmQuery = supabase
        .from("tenant_messages")
        .select("*")
        .eq("source_tenant_id", storeUserId!)
        .in("target_area", ["public_store", "customer_account"])
        .order("created_at", { ascending: false })
        .limit(50);

      if (user) {
        tmQuery = tmQuery.in("audience_type", [
          "tenant_admin_to_all_customers",
          "tenant_admin_to_one_customer",
          "tenant_admin_to_customer_segment",
        ]);
      } else {
        tmQuery = tmQuery.eq("audience_type", "tenant_admin_to_all_customers");
      }

      const { data: tmData, error: tmError } = await tmQuery;
      if (tmError) throw tmError;

      const filteredTm = (tmData || []).filter(
        (m: any) => !m.target_user_id || (user && m.target_user_id === user.id)
      );

      // 2. Fetch support_messages (personal chat replies)
      let supportMsgs: any[] = [];
      if (sessionId) {
        const { data: conv } = await supabase
          .from("support_conversations")
          .select("id")
          .eq("tenant_id", storeUserId!)
          .eq("session_id", sessionId)
          .maybeSingle();

        if (conv) {
          const { data: msgs } = await supabase
            .from("support_messages")
            .select("*")
            .eq("conversation_id", conv.id)
            .eq("sender_type", "admin")
            .order("created_at", { ascending: false })
            .limit(10);
          
          if (msgs) {
            supportMsgs = msgs.map(m => ({
              id: m.id,
              title: "Nova mensagem do suporte",
              body: m.body,
              created_at: m.created_at,
              message_type: "support",
              read: !!m.read_at,
              source_tenant_id: storeUserId,
              is_chat: true // Tag to identify chat messages
            }));
          }
        }
      }

      const allMessages = [
        ...filteredTm.map(m => ({ ...m, is_chat: false })),
        ...supportMsgs
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      const ids = allMessages.map((m: any) => m.id);
      if (ids.length === 0) return [];

      if (!user) {
        // For guest users, we use localStorage to track the last seen notification ID to simulate unread status
        const lastSeenId = localStorage.getItem(`last_notif_${storeUserId}`);
        const lastSeenIdx = allMessages.findIndex(n => n.id === lastSeenId);
        
        return allMessages.map((m: any, idx) => ({
          ...m,
          read: m.read || (lastSeenIdx === -1 ? false : idx >= lastSeenIdx),
        }));
      }

      const { data: reads } = await supabase
        .from("customer_message_reads")
        .select("message_id")
        .eq("user_id", user.id)
        .in("message_id", ids);

      const readSet = new Set((reads || []).map((r: any) => r.message_id));

      return allMessages.map((m: any) => ({
        ...m,
        read: m.read || readSet.has(m.id),
      }));
    },
  });

  // Realtime: listen for new messages and refresh immediately
  useEffect(() => {
    if (!storeUserId) return;

    const channel = supabase
      .channel(`customer-notifs-${storeUserId}-${user?.id || "guest"}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "tenant_messages",
          filter: `source_tenant_id=eq.${storeUserId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ["customer_notifications", storeUserId, user?.id] });
          playSound("RECEIVED");
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "support_messages",
        },
        (payload: any) => {
          // Only invalidate if the message is from admin and we don't know the conversation ID yet,
          // or if we could check if it's for our session.
          // For simplicity, invalidate for all inserts since this is the customer's perspective.
          if (payload.new.sender_type === "admin") {
            qc.invalidateQueries({ queryKey: ["customer_notifications"] });
            playSound("RECEIVED");
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [storeUserId, user, qc, sessionId]);

  const unreadCount = notifications.filter((n: any) => !n.read).length;

  const markAsRead = async (message: any) => {
    if (message.is_chat) {
       await supabase.from("support_messages").update({ read_at: new Date().toISOString() }).eq("id", message.id);
       qc.invalidateQueries({ queryKey: ["customer_notifications"] });
       return;
    }

    if (!user) {
      localStorage.setItem(`last_notif_${storeUserId}`, message.id);
      qc.invalidateQueries({ queryKey: ["customer_notifications", storeUserId, null] });
      return;
    }
    await supabase.from("customer_message_reads").upsert(
      { message_id: message.id, user_id: user.id },
      { onConflict: "message_id,user_id" }
    );
    qc.invalidateQueries({ queryKey: ["customer_notifications"] });
  };

  const markAllAsRead = async () => {
    if (notifications.length === 0) return;
    
    // Mark support messages as read
    const chatMsgIds = notifications.filter((n: any) => n.is_chat && !n.read).map((n: any) => n.id);
    if (chatMsgIds.length > 0) {
      await supabase.from("support_messages").update({ read_at: new Date().toISOString() }).in("id", chatMsgIds);
    }

    if (!user) {
      localStorage.setItem(`last_notif_${storeUserId}`, notifications[0].id);
      qc.invalidateQueries({ queryKey: ["customer_notifications", storeUserId, null] });
      return;
    }
    const unread = notifications.filter((n: any) => !n.read && !n.is_chat);
    if (unread.length > 0) {
      const rows = unread.map((n: any) => ({ message_id: n.id, user_id: user.id }));
      await supabase.from("customer_message_reads").upsert(rows, { onConflict: "message_id,user_id" });
    }
    qc.invalidateQueries({ queryKey: ["customer_notifications"] });
  };

  return { notifications, unreadCount, isLoading, markAsRead, markAllAsRead };
}
