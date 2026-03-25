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
    queryFn: async () => {
      let query = supabase
        .from("store_banners")
        .select("*")
        .eq("active", true)
        .order("sort_order", { ascending: true });
      if (userId) query = query.eq("user_id", userId);
      const { data, error } = await query;
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
