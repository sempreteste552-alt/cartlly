import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AIAlertLevel = "ok" | "info" | "warning" | "critical" | "blocking";

export interface AITenantUsage {
  tenant_id: string;
  ai_enabled: boolean;
  period_start: string;
  monthly_credit_limit: number;
  monthly_credits_used: number;
  topup_credits: number;
  available_credits: number;
  overage_credits: number;
  usage_percent: number;
  alert_level: AIAlertLevel;
  projected_credits_eom: number;
  hard_limit_enabled: boolean;
  total_requests: number;
  total_tokens: number;
  total_cost_usd: number;
  total_images: number;
  errors: number;
}

export function useAITenantUsage(tenantId?: string) {
  return useQuery({
    queryKey: ["ai-tenant-usage", tenantId ?? "self"],
    queryFn: async (): Promise<AITenantUsage> => {
      const { data, error } = await supabase.rpc("get_tenant_ai_usage_summary", {
        p_tenant_id: tenantId ?? undefined,
      });
      if (error) throw error;
      return data as unknown as AITenantUsage;
    },
    refetchInterval: 60_000,
  });
}

export function getAlertColor(level: AIAlertLevel) {
  switch (level) {
    case "blocking":
      return "text-destructive";
    case "critical":
      return "text-destructive";
    case "warning":
      return "text-amber-500";
    case "info":
      return "text-blue-500";
    default:
      return "text-emerald-500";
  }
}

export function getProgressColor(percent: number) {
  if (percent >= 90) return "bg-destructive";
  if (percent >= 75) return "bg-amber-500";
  if (percent >= 50) return "bg-blue-500";
  return "bg-emerald-500";
}
