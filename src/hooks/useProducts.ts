import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type Product = Tables<"products"> & { categories?: { name: string } | null };
export type ProductInsert = TablesInsert<"products">;
export type ProductUpdate = TablesUpdate<"products">;

export function useProducts() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["products", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*, categories(name)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Product[];
    },
    enabled: !!user,
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (product: Omit<ProductInsert, "user_id">) => {
      // Check published limit before creating
      const { count } = await supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .eq("published", true);

      const publishedCount = count ?? 0;

      // Fetch plan limit
      const { data: sub } = await supabase
        .from("tenant_subscriptions")
        .select("status, tenant_plans(max_products)")
        .eq("user_id", user!.id)
        .in("status", ["active", "trial", "trial_expired", "past_due", "canceled", "suspended"])
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const plan = sub?.tenant_plans as any;
      const maxProducts = plan?.max_products ?? 10;
      const isTrialActive = sub?.status === "trial";
      const blockedStatuses = ["trial_expired", "past_due", "canceled", "suspended"];
      const isBlocked = !sub || blockedStatuses.includes(sub.status);

      // If blocked or at limit, force unpublished
      const forceUnpublished = isBlocked || (!isTrialActive && publishedCount >= maxProducts);

      const { data, error } = await supabase
        .from("products")
        .insert({
          ...product,
          user_id: user!.id,
          published: forceUnpublished ? false : (product.published ?? true),
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Produto criado com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao criar produto: " + error.message);
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, ...updates }: ProductUpdate & { id: string }) => {
      // If trying to publish, check limit
      if (updates.published === true && user) {
        const { count } = await supabase
          .from("products")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("published", true);

        const { data: sub } = await supabase
          .from("tenant_subscriptions")
          .select("status, tenant_plans(max_products)")
          .eq("user_id", user.id)
          .in("status", ["active", "trial", "trial_expired", "past_due", "canceled", "suspended"])
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const plan = sub?.tenant_plans as any;
        const maxProducts = plan?.max_products ?? 10;
        const isTrialActive = sub?.status === "trial";
        const blockedStatuses = ["trial_expired", "past_due", "canceled", "suspended"];
        const isBlocked = !sub || blockedStatuses.includes(sub.status);

        if (isBlocked) {
          throw new Error("Sua assinatura está inativa. Ative seu plano para publicar produtos.");
        }

        if (!isTrialActive && (count ?? 0) >= maxProducts) {
          throw new Error(`Limite de ${maxProducts} produtos publicados atingido. Faça upgrade para publicar mais.`);
        }
      }

      const { data, error } = await supabase
        .from("products")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Produto atualizado!");
    },
    onError: (error) => {
      toast.error("Erro ao atualizar: " + error.message);
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Produto removido!");
    },
    onError: (error) => {
      toast.error("Erro ao remover: " + error.message);
    },
  });
}

export function useUploadProductImage() {
  return useMutation({
    mutationFn: async (file: File) => {
      const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
      const fileName = `${crypto.randomUUID()}.${ext}`;
      const contentType = file.type || "application/octet-stream";
      const { error } = await supabase.storage
        .from("product-images")
        .upload(fileName, file, { contentType, upsert: false });
      if (error) throw error;
      const { data: urlData } = supabase.storage
        .from("product-images")
        .getPublicUrl(fileName);
      return urlData.publicUrl;
    },
    onError: (error) => {
      toast.error("Erro no upload: " + error.message);
    },
  });
}
