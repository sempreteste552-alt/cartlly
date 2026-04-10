import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { Tables, TablesUpdate } from "@/integrations/supabase/types";

export type StoreSettings = Tables<"store_settings">;
export type StoreSettingsUpdate = TablesUpdate<"store_settings">;

export function useStoreSettings() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["store_settings", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_settings")
        .select("*")
        .eq("user_id", user!.id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      // Auto-create if not exists (fallback if trigger fails)
      if (!data && user) {
        const { data: created, error: createErr } = await supabase
          .from("store_settings")
          .insert({ 
            user_id: user.id,
            store_name: "Minha Loja"
          })
          .select()
          .single();
        if (createErr) throw createErr;
        return created as StoreSettings;
      }
      return data as StoreSettings;
    },
    enabled: !!user,
  });
}

export function useUpdateStoreSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: StoreSettingsUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from("store_settings")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store_settings"] });
      toast.success("Configurações salvas!");
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });
}

export function useUploadStoreLogo() {
  return useMutation({
    mutationFn: async (file: File) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const ext = file.name.split(".").pop();
      const fileName = `${user.id}/logo-${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("store-assets")
        .upload(fileName, file, { contentType: file.type, upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage
        .from("store-assets")
        .getPublicUrl(fileName);
      return urlData.publicUrl;
    },
    onError: (e) => toast.error("Erro no upload: " + e.message),
  });
}
