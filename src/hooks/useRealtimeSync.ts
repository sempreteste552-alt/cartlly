import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Subscribes to Supabase Realtime changes on a given table
 * and invalidates the related React Query cache keys automatically.
 */
export function useRealtimeSync(
  tableName: string,
  queryKeys: string[][],
  filter?: string
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channelName = `realtime-${tableName}-${filter || "all"}`;
    const channelConfig: any = {
      event: "*",
      schema: "public",
      table: tableName,
    };
    if (filter) channelConfig.filter = filter;

    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", channelConfig, () => {
        queryKeys.forEach((qk) => {
          queryClient.invalidateQueries({ queryKey: qk });
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tableName, filter, queryClient]);
}
