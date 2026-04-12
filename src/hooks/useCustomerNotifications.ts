import { useEffect, useMemo } from "react";
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
  const { user, customer } = useCustomerAuth();
  const qc = useQueryClient();
  const sessionId = localStorage.getItem("chat_session_id");

  const notificationQueryKey = useMemo(
    () => ["customer_notifications", storeUserId, user?.id ?? "guest", sessionId ?? "no-session"],
    [storeUserId, user?.id, sessionId]
  );

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: notificationQueryKey,
    enabled: !!storeUserId,
    queryFn: async () => {
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
        (message: any) => !message.target_user_id || (user && message.target_user_id === user.id)
      );

      const conversationMap = new Map<string, any>();

      if (customer?.id) {
        const { data, error } = await supabase
          .from("support_conversations")
          .select(`
            id,
            customer_id,
            session_id,
            tenant:store_settings(store_name)
          `)
          .eq("tenant_id", storeUserId!)
          .eq("customer_id", customer.id);

        if (error) throw error;
        for (const conversation of data || []) {
          conversationMap.set(conversation.id, conversation);
        }
      }

      if (sessionId) {
        const { data, error } = await supabase
          .from("support_conversations")
          .select(`
            id,
            customer_id,
            session_id,
            tenant:store_settings(store_name)
          `)
          .eq("tenant_id", storeUserId!)
          .eq("session_id", sessionId);

        if (error) throw error;
        for (const conversation of data || []) {
          conversationMap.set(conversation.id, conversation);
        }
      }

      let supportMsgs: any[] = [];
      const conversationIds = [...conversationMap.keys()];

      if (conversationIds.length > 0) {
        const { data: msgs, error: msgsError } = await supabase
          .from("support_messages")
          .select("id, conversation_id, body, created_at, read_at, sender_type")
          .in("conversation_id", conversationIds)
          .eq("sender_type", "admin")
          .order("created_at", { ascending: false })
          .limit(30);

        if (msgsError) throw msgsError;

        supportMsgs = (msgs || []).map((message: any) => ({
          id: message.id,
          title: conversationMap.get(message.conversation_id)?.tenant?.store_name || "Suporte",
          body: message.body,
          created_at: message.created_at,
          message_type: "support",
          read: !!message.read_at,
          source_tenant_id: storeUserId,
          is_chat: true,
        }));
      }

      const allMessages = [
        ...filteredTm.map((message: any) => ({ ...message, is_chat: false })),
        ...supportMsgs,
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      if (allMessages.length === 0) return [];

      if (!user) {
        const lastSeenNotificationId = localStorage.getItem(`last_notif_${storeUserId}`);
        const lastSeenNotificationIdx = filteredTm.findIndex((notification: any) => notification.id === lastSeenNotificationId);

        return allMessages.map((message: any) => ({
          ...message,
          read: message.is_chat
            ? message.read
            : message.read || (lastSeenNotificationIdx === -1
              ? false
              : filteredTm.findIndex((notification: any) => notification.id === message.id) <= lastSeenNotificationIdx),
        }));
      }

      const tenantMessageIds = filteredTm.map((message: any) => message.id);
      let readSet = new Set<string>();

      if (tenantMessageIds.length > 0) {
        const { data: reads } = await supabase
          .from("customer_message_reads")
          .select("message_id")
          .eq("user_id", user.id)
          .in("message_id", tenantMessageIds);

        readSet = new Set((reads || []).map((read: any) => read.message_id));
      }

      return allMessages.map((message: any) => ({
        ...message,
        read: message.is_chat ? message.read : message.read || readSet.has(message.id),
      }));
    },
  });

  useEffect(() => {
    if (!storeUserId) return;

    const channel = supabase
      .channel(`customer-notifs-${storeUserId}-${user?.id || "guest"}-${sessionId || "no-session"}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "tenant_messages",
          filter: `source_tenant_id=eq.${storeUserId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: notificationQueryKey });
          playNotificationSound();
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
          if (payload.new.sender_type === "admin") {
            qc.invalidateQueries({ queryKey: notificationQueryKey });
            playNotificationSound();
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "support_messages",
        },
        () => {
          qc.invalidateQueries({ queryKey: notificationQueryKey });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [storeUserId, user?.id, sessionId, qc, notificationQueryKey]);

  const unreadCount = notifications.filter((notification: any) => !notification.read).length;
  const chatUnreadCount = notifications.filter((notification: any) => notification.is_chat && !notification.read).length;

  const markAsRead = async (message: any) => {
    if (message.is_chat) {
      await supabase.from("support_messages").update({ read_at: new Date().toISOString() }).eq("id", message.id);
      qc.invalidateQueries({ queryKey: notificationQueryKey });
      return;
    }

    if (!user) {
      localStorage.setItem(`last_notif_${storeUserId}`, message.id);
      qc.invalidateQueries({ queryKey: notificationQueryKey });
      return;
    }

    await supabase.from("customer_message_reads").upsert(
      { message_id: message.id, user_id: user.id },
      { onConflict: "message_id,user_id" }
    );
    qc.invalidateQueries({ queryKey: notificationQueryKey });
  };

  const markAllAsRead = async () => {
    if (notifications.length === 0) return;

    const chatMsgIds = notifications
      .filter((notification: any) => notification.is_chat && !notification.read)
      .map((notification: any) => notification.id);

    if (chatMsgIds.length > 0) {
      await supabase.from("support_messages").update({ read_at: new Date().toISOString() }).in("id", chatMsgIds);
    }

    if (!user) {
      const latestNotification = notifications.find((notification: any) => !notification.is_chat);
      if (latestNotification) {
        localStorage.setItem(`last_notif_${storeUserId}`, latestNotification.id);
      }
      qc.invalidateQueries({ queryKey: notificationQueryKey });
      return;
    }

    const unreadTenantNotifications = notifications.filter((notification: any) => !notification.read && !notification.is_chat);
    if (unreadTenantNotifications.length > 0) {
      const rows = unreadTenantNotifications.map((notification: any) => ({
        message_id: notification.id,
        user_id: user.id,
      }));
      await supabase.from("customer_message_reads").upsert(rows, { onConflict: "message_id,user_id" });
    }

    qc.invalidateQueries({ queryKey: notificationQueryKey });
  };

  return { notifications, unreadCount, chatUnreadCount, isLoading, markAsRead, markAllAsRead };
}
