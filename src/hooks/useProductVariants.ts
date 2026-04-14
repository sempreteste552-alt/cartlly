import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";

export interface ProductVariant {
  id: string;
  product_id: string;
  variant_type: string;
  variant_value: string;
  stock: number;
  price_modifier: number;
  sku: string | null;
  created_at: string;
}

export function useProductVariants(productId: string | undefined) {
  useRealtimeSync("product_variants", [["product_variants", productId || ""]], productId ? `product_id=eq.${productId}` : undefined);
  return useQuery({
    queryKey: ["product_variants", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_variants")
        .select("*")
        .eq("product_id", productId!)
        .order("variant_type", { ascending: true });
      if (error) throw error;
      return data as ProductVariant[];
    },
    enabled: !!productId,
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
}

export function useCreateVariant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (variant: Omit<ProductVariant, "id" | "created_at">) => {
      const { data, error } = await supabase
        .from("product_variants")
        .insert(variant as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["product_variants", vars.product_id] });
      toast.success("Variante adicionada!");
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });
}

export function useDeleteVariant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, productId }: { id: string; productId: string }) => {
      const { error } = await supabase.from("product_variants").delete().eq("id", id);
      if (error) throw error;
      return productId;
    },
    onSuccess: (productId) => {
      queryClient.invalidateQueries({ queryKey: ["product_variants", productId] });
      toast.success("Variante removida!");
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });
}

export function useUpdateVariantStock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, stock, productId }: { id: string; stock: number; productId: string }) => {
      const { error } = await supabase
        .from("product_variants")
        .update({ stock } as any)
        .eq("id", id);
      if (error) throw error;
      return productId;
    },
    onSuccess: (productId) => {
      queryClient.invalidateQueries({ queryKey: ["product_variants", productId] });
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });
}
