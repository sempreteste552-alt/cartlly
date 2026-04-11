import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export function useStoreBanners() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["store_banners", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_banners")
        .select("*")
        .eq("user_id", user!.id)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function usePublicBanners(userId?: string) {
  return useQuery({
    queryKey: ["public_banners", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_banners")
        .select("*")
        .eq("active", true)
        .eq("user_id", userId!)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateBanner() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ imageUrl, linkUrl, mediaType }: { imageUrl: string; linkUrl?: string; mediaType?: string }) => {
      const { error } = await supabase
        .from("store_banners")
        .insert({ user_id: user!.id, image_url: imageUrl, link_url: linkUrl || null, media_type: mediaType || "image" } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store_banners"] });
      toast.success("Banner adicionado!");
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });
}

export function useUpdateBannerLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, link_url, category_id }: { id: string; link_url?: string | null; category_id?: string | null }) => {
      const updates: Record<string, any> = {};
      if (link_url !== undefined) updates.link_url = link_url;
      if (category_id !== undefined) updates.category_id = category_id;
      const { error } = await supabase
        .from("store_banners")
        .update(updates as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store_banners"] });
      queryClient.invalidateQueries({ queryKey: ["public_banners"] });
      toast.success("Banner atualizado!");
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });
}

export function useReorderBanners() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const updates = orderedIds.map((id, index) =>
        supabase.from("store_banners").update({ sort_order: index } as any).eq("id", id)
      );
      const results = await Promise.all(updates);
      const err = results.find((r) => r.error);
      if (err?.error) throw err.error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store_banners"] });
    },
    onError: (e) => toast.error("Erro ao reordenar: " + e.message),
  });
}

export function useDeleteBanner() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("store_banners").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store_banners"] });
      toast.success("Banner removido!");
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });
}
