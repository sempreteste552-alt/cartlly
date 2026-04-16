import { useMutation } from "@tanstack/react-query";

interface CreatePaymentParams {
  order_id: string;
  method: "pix" | "credit_card" | "boleto" | "debit_card" | "express";
  store_user_id: string;
  card_token?: string;
  card_type?: "credit" | "debit";
  installments?: number;
  payer_cpf?: string;
  payer_first_name?: string;
  payer_last_name?: string;
  device_id?: string;
  payment_method_id?: string;
  issuer_id?: string;
}

export function useCreatePayment() {
  return useMutation({
    mutationFn: async (params: CreatePaymentParams) => {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/create-payment`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": anonKey,
            "Authorization": `Bearer ${anonKey}`,
          },
          body: JSON.stringify(params),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erro ao processar pagamento");
      return data;
    },
  });
}
