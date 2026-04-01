import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

export interface SuperAdminBadges {
  tenants: number;       // pending + blocked + trial expiring
  solicitacoes: number;  // pending plan change requests
  notificacoes: number;  // unread notifications
  isLoading: boolean;
}

export function useSuperAdminBadges(): SuperAdminBadges {
  const queryClient = useQueryClient();

  // Real-time subscription for relevant tables
  useEffect(() => {
    const channel = supabase
      .channel("superadmin-badges")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => {
        queryClient.invalidateQueries({ queryKey: ["sa_badge_tenants"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "plan_change_requests" }, () => {
        queryClient.invalidateQueries({ queryKey: ["sa_badge_requests"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "admin_notifications" }, () => {
        queryClient.invalidateQueries({ queryKey: ["sa_badge_notifications"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "tenant_subscriptions" }, () => {
        queryClient.invalidateQueries({ queryKey: ["sa_badge_tenants"] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  // Tenant issues: pending approval + blocked + trial expiring soon (<=2 days)
  const { data: tenantBadge = 0, isLoading: l1 } = useQuery({
    queryKey: ["sa_badge_tenants"],
    queryFn: async () => {
      // Get super admin IDs to exclude
      const { data: saRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "super_admin");
      const saIds = new Set(saRoles?.map((r) => r.user_id) || []);

      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, status");

      const { data: subs } = await supabase
        .from("tenant_subscriptions")
        .select("user_id, status, trial_ends_at");

      let count = 0;
      const subMap = new Map(subs?.map((s) => [s.user_id, s]) || []);

      for (const p of profiles || []) {
        if (saIds.has(p.user_id)) continue;
        // Pending approval
        if (p.status === "pending") { count++; continue; }
        // Blocked
        if (p.status === "blocked") { count++; continue; }
        // Trial expiring within 2 days
        const sub = subMap.get(p.user_id);
        if (sub?.status === "trial" && sub.trial_ends_at) {
          const daysLeft = Math.ceil((new Date(sub.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          if (daysLeft <= 2 && daysLeft >= 0) count++;
        }
        // Expired subscription
        if (sub?.status === "expired" || sub?.status === "past_due") count++;
      }
      return count;
    },
    refetchInterval: 30000,
  });

  // Pending plan change requests
  const { data: requestBadge = 0, isLoading: l2 } = useQuery({
    queryKey: ["sa_badge_requests"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("plan_change_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");
      if (error) return 0;
      return count || 0;
    },
    refetchInterval: 30000,
  });

  // Unread notifications targeted to current user (super admin)
  const { data: notifBadge = 0, isLoading: l3 } = useQuery({
    queryKey: ["sa_badge_notifications"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("admin_notifications")
        .select("id", { count: "exact", head: true })
        .eq("read", false);
      if (error) return 0;
      return count || 0;
    },
    refetchInterval: 15000,
  });

  return {
    tenants: tenantBadge,
    solicitacoes: requestBadge,
    notificacoes: notifBadge,
    isLoading: l1 || l2 || l3,
  };
}
