import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface ShippingZone {
  id: string;
  user_id: string;
  zone_name: string;
  cep_start: string;
  cep_end: string;
  price: number;
  estimated_days: string;
  active: boolean;
  created_at: string;
}

export function useShippingZones() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["shipping_zones", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shipping_zones")
        .select("*")
        .eq("user_id", user!.id)
        .order("cep_start", { ascending: true });
      if (error) throw error;
      return data as ShippingZone[];
    },
    enabled: !!user,
  });
}

export function usePublicShippingZones(storeUserId: string | undefined) {
  return useQuery({
    queryKey: ["public_shipping_zones", storeUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shipping_zones")
        .select("*")
        .eq("user_id", storeUserId!)
        .eq("active", true)
        .order("cep_start", { ascending: true });
      if (error) throw error;
      return data as ShippingZone[];
    },
    enabled: !!storeUserId,
  });
}

export function useCreateShippingZone() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (zone: Omit<ShippingZone, "id" | "user_id" | "created_at">) => {
      const { data, error } = await supabase
        .from("shipping_zones")
        .insert({ ...zone, user_id: user!.id } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shipping_zones"] });
      toast.success("Zona de frete criada!");
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });
}

export function useDeleteShippingZone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("shipping_zones").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shipping_zones"] });
      toast.success("Zona removida!");
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });
}
