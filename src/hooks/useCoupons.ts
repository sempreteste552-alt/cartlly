import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export function useCoupons() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["coupons", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coupons")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateCoupon() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (coupon: {
      code: string;
      discount_type: string;
      discount_value: number;
      min_order_value?: number;
      max_uses?: number | null;
      expires_at?: string | null;
    }) => {
      const { data, error } = await supabase
        .from("coupons")
        .insert({ ...coupon, user_id: user!.id } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coupons"] });
      toast.success("Cupom criado!");
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });
}

export function useUpdateCoupon() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; [key: string]: any }) => {
      const { error } = await supabase.from("coupons").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coupons"] });
      toast.success("Cupom atualizado!");
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });
}

export function useDeleteCoupon() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("coupons").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coupons"] });
      toast.success("Cupom removido!");
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });
}

export function useValidateCoupon() {
  return useMutation({
    mutationFn: async ({ code, storeUserId }: { code: string; storeUserId: string }) => {
      const { data, error } = await supabase
        .from("coupons")
        .select("*")
        .eq("code", code.toUpperCase().trim())
        .eq("user_id", storeUserId)
        .eq("active", true)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Cupom inválido ou expirado");

      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        throw new Error("Cupom expirado");
      }

      if (data.max_uses && data.used_count >= data.max_uses) {
        throw new Error("Cupom atingiu o limite de usos");
      }

      return data;
    },
  });
}
