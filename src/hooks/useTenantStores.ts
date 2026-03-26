import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export function useTenantStores() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: stores, isLoading } = useQuery({
    queryKey: ["tenant_stores", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("tenant_stores")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at");
      if (error) throw error;
      return data as any[];
    },
  });

  const createStore = useMutation({
    mutationFn: async (params: { store_name: string; store_slug: string }) => {
      if ((stores?.length ?? 0) >= 2) {
        throw new Error("Limite de 2 lojas por assinatura atingido.");
      }
      const slug = params.store_slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");

      const { data: existingSlug } = await (supabase as any)
        .from("tenant_stores")
        .select("id")
        .eq("store_slug", slug)
        .maybeSingle();
      if (existingSlug) throw new Error("Este slug já está em uso.");

      const { data: existingStoreSettings } = await supabase
        .from("store_settings")
        .select("id")
        .eq("store_slug", slug)
        .maybeSingle();
      if (existingStoreSettings) throw new Error("Este slug já está em uso.");

      const { data, error } = await (supabase as any)
        .from("tenant_stores")
        .insert({
          user_id: user!.id,
          store_name: params.store_name,
          store_slug: slug,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Nova loja criada com sucesso! 🏪");
      queryClient.invalidateQueries({ queryKey: ["tenant_stores"] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const deleteStore = useMutation({
    mutationFn: async (storeId: string) => {
      const { error } = await (supabase as any)
        .from("tenant_stores")
        .delete()
        .eq("id", storeId)
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Loja removida.");
      queryClient.invalidateQueries({ queryKey: ["tenant_stores"] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  return {
    stores: stores ?? [],
    isLoading,
    canCreateMore: (stores?.length ?? 0) < 2,
    createStore,
    deleteStore,
  };
}
