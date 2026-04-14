import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { awardReferralReward } from "@/lib/loyalty";
import { toast } from "sonner";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";

export type OrderStatus = "pendente" | "processando" | "enviado" | "entregue" | "cancelado";

export const ORDER_STATUS_MAP: Record<OrderStatus, { label: string; color: string }> = {
  pendente: { label: "Pendente", color: "bg-yellow-500" },
  processando: { label: "Processando", color: "bg-blue-500" },
  enviado: { label: "Enviado", color: "bg-purple-500" },
  entregue: { label: "Entregue", color: "bg-green-500" },
  cancelado: { label: "Cancelado", color: "bg-red-500" },
};

export function useOrders() {
  const { user } = useAuth();
  useRealtimeSync("orders", [["orders", user?.id || ""]], user ? `user_id=eq.${user.id}` : undefined);
  return useQuery({
    queryKey: ["orders", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, payments(status, method)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useOrderItems(orderId: string | null) {
  return useQuery({
    queryKey: ["order_items", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_items")
        .select("*")
        .eq("order_id", orderId!);
      if (error) throw error;
      return data;
    },
    enabled: !!orderId,
  });
}

export function useOrderStatusHistory(orderId: string | null) {
  return useQuery({
    queryKey: ["order_status_history", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_status_history")
        .select("*")
        .eq("order_id", orderId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!orderId,
  });
}

export function useOrderPayment(orderId: string | null) {
  return useQuery({
    queryKey: ["order_payment", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .eq("order_id", orderId!)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!orderId,
  });
}

export function useUpdateOrderStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: OrderStatus }) => {
      const { error: updateErr } = await supabase
        .from("orders")
        .update({ status })
        .eq("id", orderId);
      if (updateErr) throw updateErr;

      // Handle referral rewards if order is delivered
      if (status === "entregue") {
        const { data: order } = await supabase
          .from("orders")
          .select("customer_email, user_id, id")
          .eq("id", orderId)
          .single();

        if (order) {
          const { data: customer } = await supabase
            .from("customers")
            .select("id")
            .eq("email", order.customer_email)
            .eq("store_user_id", order.user_id)
            .maybeSingle();

          if (customer) {
            await awardReferralReward(order.user_id, customer.id, "sale", order.id);
          }
        }
      }

      const { error: histErr } = await supabase
        .from("order_status_history")
        .insert({ order_id: orderId, status });
      if (histErr) throw histErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["order_status_history"] });
      toast.success("Status atualizado!");
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });
}
