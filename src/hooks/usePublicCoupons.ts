import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PublicCoupon {
  code: string;
  discount_type: string;
  discount_value: number;
  expires_at: string | null;
  min_order_value: number | null;
}

export function usePublicCoupons(storeUserId?: string) {
  return useQuery({
    queryKey: ["public_coupons", storeUserId],
    enabled: !!storeUserId,
    staleTime: 60_000,
    queryFn: async (): Promise<PublicCoupon[]> => {
      const { data, error } = await supabase.functions.invoke("public-coupons", {
        body: { storeUserId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      return Array.isArray(data?.coupons) ? data.coupons : [];
    },
  });
}
