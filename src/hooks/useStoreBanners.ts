import { useEffect } from "react";
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
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
}

export function usePublicBanners(userId?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
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
    // Keep data fresh so a newly published banner appears without cache tricks.
    staleTime: 30 * 1000, // 30s
    gcTime: 5 * 60 * 1000, // 5 min
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  // Realtime sync: any INSERT / UPDATE / DELETE on this tenant's banners
  // immediately invalidates the public cache for every visitor.
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`public-banners-rt-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "store_banners",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["public_banners", userId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

  return query;
}

function invalidateBannerCaches(queryClient: ReturnType<typeof useQueryClient>, userId?: string) {
  queryClient.invalidateQueries({ queryKey: ["store_banners"] });
  queryClient.invalidateQueries({ queryKey: ["public_banners"] });
  if (userId) {
    queryClient.invalidateQueries({ queryKey: ["public_banners", userId] });
  }
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
      invalidateBannerCaches(queryClient, user?.id);
      toast.success("Banner adicionado!");
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });
}

export function useUpdateBannerLink() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ id, link_url, category_id, active }: { id: string; link_url?: string | null; category_id?: string | null; active?: boolean }) => {
      const updates: Record<string, any> = {};
      if (link_url !== undefined) updates.link_url = link_url;
      if (category_id !== undefined) updates.category_id = category_id;
      if (active !== undefined) updates.active = active;
      const { error } = await supabase
        .from("store_banners")
        .update(updates as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateBannerCaches(queryClient, user?.id);
      toast.success("Banner atualizado!");
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });
}

export function useReorderBanners() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
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
      invalidateBannerCaches(queryClient, user?.id);
    },
    onError: (e) => toast.error("Erro ao reordenar: " + e.message),
  });
}

export function useDeleteBanner() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("store_banners").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateBannerCaches(queryClient, user?.id);
      toast.success("Banner removido!");
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });
}
