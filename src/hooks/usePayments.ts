import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface CreatePaymentParams {
  order_id: string;
  method: "pix" | "credit_card" | "boleto";
  store_user_id: string;
  card_token?: string;
  installments?: number;
}

export function useCreatePayment() {
  return useMutation({
    mutationFn: async (params: CreatePaymentParams) => {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/create-payment`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erro ao processar pagamento");
      return data;
    },
  });
}
