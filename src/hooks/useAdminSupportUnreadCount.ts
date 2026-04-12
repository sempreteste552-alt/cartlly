import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useAdminSupportUnreadCount() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data = 0 } = useQuery({
    queryKey: ["admin_support_unread", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_conversations")
        .select(`
          id,
          messages:support_messages(sender_type, read_at)
        `)
        .eq("tenant_id", user!.id);

      if (error) throw error;

      return (data || []).reduce((total: number, conversation: any) => {
        const unreadInConversation = (conversation.messages || []).filter(
          (message: any) => message.sender_type === "customer" && !message.read_at
        ).length;

        return total + unreadInConversation;
      }, 0);
    },
  });

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`admin-support-unread-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "support_messages" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["admin_support_unread", user.id] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "support_conversations" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["admin_support_unread", user.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  return data;
}
