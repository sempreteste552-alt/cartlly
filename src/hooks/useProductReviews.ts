import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ProductReview {
  id: string;
  product_id: string;
  customer_name: string;
  customer_email: string | null;
  rating: number;
  comment: string | null;
  image_urls: string[];
  created_at: string;
}

export function useProductReviews(productId: string | undefined) {
  return useQuery({
    queryKey: ["product-reviews", productId],
    enabled: !!productId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_reviews_public")
        .select("*")
        .eq("product_id", productId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any[]).map((d) => ({ ...d, customer_email: null })) as ProductReview[];
    },
  });
}

export function useAverageRating(reviews: ProductReview[] | undefined) {
  if (!reviews || reviews.length === 0) return { average: 0, count: 0 };
  const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
  return { average: sum / reviews.length, count: reviews.length };
}

export function useCreateReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (review: {
      product_id: string;
      customer_name: string;
      customer_email?: string;
      rating: number;
      comment?: string;
      image_urls?: string[];
    }) => {
      const { data, error } = await supabase
        .from("product_reviews")
        .insert(review)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["product-reviews", variables.product_id] });
    },
  });
}
