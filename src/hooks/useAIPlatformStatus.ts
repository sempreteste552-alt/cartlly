import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AIPlatformStatus {
  enabled: boolean;
  has_provider: boolean;
  message: string;
  support_contact: string;
}

const FALLBACK: AIPlatformStatus = {
  enabled: false,
  has_provider: false,
  message:
    "Os recursos de Inteligência Artificial ainda não estão liberados para a sua loja. Fale com o suporte para ativar.",
  support_contact: "contato@cartlly.store",
};

/**
 * Status global da IA da plataforma.
 * A IA fica DESLIGADA por padrão — o suporte (super admin) precisa
 * ativar o switch global e cadastrar as chaves de API dos provedores.
 */
export function useAIPlatformStatus() {
  const { data, isLoading } = useQuery({
    queryKey: ["ai-platform-status"],
    staleTime: 60_000,
    queryFn: async (): Promise<AIPlatformStatus> => {
      const { data, error } = await supabase.rpc("get_ai_platform_status");
      if (error) return FALLBACK;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) return FALLBACK;
      return {
        enabled: !!(row as any).enabled,
        has_provider: !!(row as any).has_provider,
        message: (row as any).message || FALLBACK.message,
        support_contact: (row as any).support_contact || FALLBACK.support_contact,
      };
    },
  });

  return {
    status: data ?? FALLBACK,
    aiEnabled: data?.enabled ?? false,
    isLoading,
  };
}
