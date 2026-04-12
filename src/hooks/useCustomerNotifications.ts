import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCustomerAuth } from "@/hooks/useCustomerAuth";

export function useCustomerNotifications(storeUserId?: string) {
  const { user } = useCustomerAuth();
  const qc = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["customer_notifications", storeUserId, user?.id],
    enabled: !!storeUserId, // Enabled for all users, even guest
    queryFn: async () => {
      let query = supabase
        .from("tenant_messages")
        .select("*")
        .eq("source_tenant_id", storeUserId!)
        .in("target_area", ["public_store", "customer_account"])
        .order("created_at", { ascending: false })
        .limit(50);

      if (user) {
        // Logged in: show global messages OR messages specifically for this user
        query = query.in("audience_type", [
          "tenant_admin_to_all_customers",
          "tenant_admin_to_one_customer",
          "tenant_admin_to_customer_segment",
        ]);
      } else {
        // Guest: show ONLY global messages for all customers
        query = query.eq("audience_type", "tenant_admin_to_all_customers");
      }

      const { data, error } = await query;
      if (error) throw error;

      const filtered = (data || []).filter(
        (m: any) => !m.target_user_id || (user && m.target_user_id === user.id)
      );

      const ids = filtered.map((m: any) => m.id);
      if (ids.length === 0) return [];

      if (!user) {
        // For guest users, we use localStorage to track the last seen notification ID to simulate unread status
        const lastSeenId = localStorage.getItem(`last_notif_${storeUserId}`);
        const lastSeenIdx = filtered.findIndex(n => n.id === lastSeenId);
        
        return filtered.map((m: any, idx) => ({
          ...m,
          read: lastSeenIdx === -1 ? false : idx >= lastSeenIdx,
        }));
      }

      const { data: reads } = await supabase
        .from("customer_message_reads")
        .select("message_id")
        .eq("user_id", user.id)
        .in("message_id", ids);

      const readSet = new Set((reads || []).map((r: any) => r.message_id));

      return filtered.map((m: any) => ({
        ...m,
        read: readSet.has(m.id),
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
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [storeUserId, user, qc]);

  const unreadCount = notifications.filter((n: any) => !n.read).length;

  const markAsRead = async (messageId: string) => {
    if (!user) {
      // Guest: save the latest message ID to localStorage
      localStorage.setItem(`last_notif_${storeUserId}`, messageId);
      qc.invalidateQueries({ queryKey: ["customer_notifications", storeUserId, null] });
      return;
    }
    await supabase.from("customer_message_reads").upsert(
      { message_id: messageId, user_id: user.id },
      { onConflict: "message_id,user_id" }
    );
    qc.invalidateQueries({ queryKey: ["customer_notifications"] });
  };

  const markAllAsRead = async () => {
    if (notifications.length === 0) return;
    if (!user) {
      // Guest: mark latest as seen
      localStorage.setItem(`last_notif_${storeUserId}`, notifications[0].id);
      qc.invalidateQueries({ queryKey: ["customer_notifications", storeUserId, null] });
      return;
    }
    const unread = notifications.filter((n: any) => !n.read);
    if (unread.length === 0) return;
    const rows = unread.map((n: any) => ({ message_id: n.id, user_id: user.id }));
    await supabase.from("customer_message_reads").upsert(rows, { onConflict: "message_id,user_id" });
    qc.invalidateQueries({ queryKey: ["customer_notifications"] });
  };

  return { notifications, unreadCount, isLoading, markAsRead, markAllAsRead };
}
