import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";

export function useStorePolicies() {
  const { user } = useAuth();
  useRealtimeSync("store_policies", [["store_policies", user?.id || ""]], user ? `user_id=eq.${user.id}` : undefined);

  return useQuery({
    queryKey: ["store_policies", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_policies")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useUpdateStorePolicies() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (updates: {
      privacy_policy?: string;
      terms_of_service?: string;
      cookie_policy?: string;
    }) => {
      if (!user) throw new Error("Not authenticated");

      // Upsert
      const { data: existing } = await supabase
        .from("store_policies")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("store_policies")
          .update(updates)
          .eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("store_policies")
          .insert({ user_id: user.id, ...updates });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store_policies", user?.id] });
      toast.success("Políticas salvas com sucesso!");
    },
    onError: () => {
      toast.error("Erro ao salvar políticas");
    },
  });
}

export function usePublicStorePolicies(storeUserId: string | undefined) {
  return useQuery({
    queryKey: ["store_policies_public", storeUserId],
    enabled: !!storeUserId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_policies")
        .select("privacy_policy, terms_of_service, cookie_policy")
        .eq("user_id", storeUserId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}
