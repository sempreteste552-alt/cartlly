import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCustomerAuth } from "@/hooks/useCustomerAuth";

export function useCustomerNotifications(storeUserId?: string) {
  const { user } = useCustomerAuth();
  const qc = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["customer_notifications", storeUserId, user?.id],
    enabled: !!storeUserId && !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_messages")
        .select("*")
        .eq("source_tenant_id", storeUserId!)
        .in("target_area", ["public_store", "customer_account"])
        .in("audience_type", [
          "tenant_admin_to_all_customers",
          "tenant_admin_to_one_customer",
          "tenant_admin_to_customer_segment",
        ])
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      const filtered = (data || []).filter(
        (m: any) => !m.target_user_id || m.target_user_id === user!.id
      );

      const ids = filtered.map((m: any) => m.id);
      if (ids.length === 0) return [];

      const { data: reads } = await supabase
        .from("customer_message_reads")
        .select("message_id")
        .eq("user_id", user!.id)
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
    if (!storeUserId || !user) return;

    const channel = supabase
      .channel(`customer-notifs-${storeUserId}-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "tenant_messages",
          filter: `source_tenant_id=eq.${storeUserId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ["customer_notifications", storeUserId, user.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [storeUserId, user, qc]);

  const unreadCount = notifications.filter((n: any) => !n.read).length;

  const markAsRead = async (messageId: string) => {
    if (!user) return;
    await supabase.from("customer_message_reads").upsert(
      { message_id: messageId, user_id: user.id },
      { onConflict: "message_id,user_id" }
    );
    qc.invalidateQueries({ queryKey: ["customer_notifications"] });
  };

  const markAllAsRead = async () => {
    if (!user) return;
    const unread = notifications.filter((n: any) => !n.read);
    if (unread.length === 0) return;
    const rows = unread.map((n: any) => ({ message_id: n.id, user_id: user.id }));
    await supabase.from("customer_message_reads").upsert(rows, { onConflict: "message_id,user_id" });
    qc.invalidateQueries({ queryKey: ["customer_notifications"] });
  };

  return { notifications, unreadCount, isLoading, markAsRead, markAllAsRead };
}
