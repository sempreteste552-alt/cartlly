import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";

export function useProductImages(productId: string | undefined) {
  useRealtimeSync("product_images", [["product_images", productId || ""]], productId ? `product_id=eq.${productId}` : undefined);
  return useQuery({
    queryKey: ["product_images", productId],
    enabled: !!productId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_images")
        .select("*")
        .eq("product_id", productId!)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function usePublicProductImages(productIds: string[]) {
  return useQuery({
    queryKey: ["public_product_images", productIds],
    enabled: productIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_images")
        .select("product_id, image_url, sort_order")
        .in("product_id", productIds)
        .order("sort_order");
      if (error) throw error;
      const map: Record<string, string[]> = {};
      data?.forEach((img: any) => {
        if (!img.image_url?.trim()) return;
        if (!map[img.product_id]) map[img.product_id] = [];
        if (!map[img.product_id].includes(img.image_url)) map[img.product_id].push(img.image_url);
      });
      return map;
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
}

export function useAddProductImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ productId, imageUrl, sortOrder }: { productId: string; imageUrl: string; sortOrder: number }) => {
      const { data, error } = await supabase
        .from("product_images")
        .insert({ product_id: productId, image_url: imageUrl, sort_order: sortOrder })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["product_images", vars.productId] });
    },
    onError: (error) => {
      toast.error("Erro ao adicionar imagem: " + error.message);
    },
  });
}

export function useDeleteProductImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, productId }: { id: string; productId: string }) => {
      const { error } = await supabase.from("product_images").delete().eq("id", id);
      if (error) throw error;
      return productId;
    },
    onSuccess: (productId) => {
      queryClient.invalidateQueries({ queryKey: ["product_images", productId] });
    },
    onError: (error) => {
      toast.error("Erro ao remover imagem: " + error.message);
    },
  });
}
