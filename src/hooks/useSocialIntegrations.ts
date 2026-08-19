import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export type SocialProvider = "instagram" | "facebook";

export interface SocialConnection {
  id: string;
  tenant_id: string;
  provider: SocialProvider;
  provider_account_id: string | null;
  account_name: string | null;
  account_username: string | null;
  page_id: string | null;
  status: string;
  token_expires_at: string | null;
  connected_at: string;
}

export interface SocialSuggestion {
  id: string;
  tenant_id: string;
  social_post_id: string | null;
  product_id: string | null;
  suggested_name: string | null;
  suggested_description: string | null;
  suggested_category: string | null;
  suggested_price: number | null;
  suggested_brand: string | null;
  suggested_sku: string | null;
  image_url: string | null;
  ai_confidence: number | null;
  status: "PENDING" | "REVIEWING" | "APPROVED" | "REJECTED" | "IMPORTED";
  created_at: string;
  social_media_posts?: any;
}

export function useSocialConnections() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["social_connections", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("social_connections" as any)
        .select("*")
        .eq("tenant_id", user!.id)
        .neq("status", "disconnected")
        .order("connected_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as SocialConnection[];
    },
  });
}

export function useSocialSettings() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["tenant_social_settings", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("tenant_social_settings" as any)
        .select("*")
        .eq("tenant_id", user!.id)
        .maybeSingle();
      return (data || null) as any;
    },
  });

  const save = useMutation({
    mutationFn: async (patch: Record<string, unknown>) => {
      const { error } = await supabase
        .from("tenant_social_settings" as any)
        .upsert({ tenant_id: user!.id, ...patch }, { onConflict: "tenant_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenant_social_settings", user?.id] });
      toast.success("Configurações salvas");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao salvar"),
  });

  return { settings: query.data, isLoading: query.isLoading, save };
}

export function useSocialSuggestions(status?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["social_suggestions", user?.id, status],
    enabled: !!user,
    queryFn: async () => {
      let q = supabase
        .from("social_product_suggestions" as any)
        .select("*, social_media_posts(provider, post_url, media_url, caption, published_at)")
        .eq("tenant_id", user!.id)
        .order("created_at", { ascending: false });
      if (status) q = q.eq("status", status);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as SocialSuggestion[];
    },
  });
}

export function useSocialAnalytics() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["social_analytics", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("social_import_analytics" as any)
        .select("*")
        .eq("tenant_id", user!.id);
      const rows = (data || []) as any[];
      return rows.reduce(
        (acc, r) => ({
          posts_detected: acc.posts_detected + (r.posts_detected || 0),
          products_detected: acc.products_detected + (r.products_detected || 0),
          products_imported: acc.products_imported + (r.products_imported || 0),
          products_rejected: acc.products_rejected + (r.products_rejected || 0),
          products_ignored: acc.products_ignored + (r.products_ignored || 0),
          credits_consumed: acc.credits_consumed + Number(r.credits_consumed || 0),
        }),
        { posts_detected: 0, products_detected: 0, products_imported: 0, products_rejected: 0, products_ignored: 0, credits_consumed: 0 },
      );
    },
  });
}

const SOCIAL_ERRORS: Record<string, string> = {
  META_NOT_CONFIGURED: "A conexão com Instagram/Facebook ainda não foi liberada pela plataforma. Fale com o suporte.",
  PLAN_REQUIRED: "Recurso disponível apenas no plano Premium.",
};

/** Lê o corpo JSON mesmo quando a função responde com status de erro (400/500). */
async function invokeSocial(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("social-oauth", { body });
  let payload: any = data;
  if (error) {
    const res = (error as any)?.context;
    if (res && typeof res.json === "function") {
      try { payload = await res.json(); } catch { /* corpo não-JSON */ }
    }
    if (!payload?.error) throw new Error(error.message || "Falha na comunicação com o servidor.");
  }
  if (payload?.error) throw new Error(SOCIAL_ERRORS[payload.error] || payload.error);
  return payload;
}

export async function startSocialConnect(provider: SocialProvider) {
  const data = await invokeSocial({
    action: "authorize_url",
    provider,
    return_url: window.location.href,
  });
  if (!data?.url) throw new Error("Não foi possível iniciar a conexão.");
  window.location.href = data.url;
}

export async function disconnectSocial(connectionId: string) {
  const { data, error } = await supabase.functions.invoke("social-oauth", {
    body: { action: "disconnect", connection_id: connectionId },
  });
  if (error || data?.error) throw new Error(data?.error || error?.message);
}

export async function syncSocialNow(connectionId: string) {
  const { data, error } = await supabase.functions.invoke("social-oauth", {
    body: { action: "sync_now", connection_id: connectionId },
  });
  if (error || data?.error) throw new Error(data?.error || error?.message);
  return data as { new_posts: number };
}
