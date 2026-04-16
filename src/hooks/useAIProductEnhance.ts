import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AIEnhanceParams {
  action: "generate_description" | "suggest_price" | "analyze_image" | "generate_restock_phrases" | "generate_social_post";
  productName?: string;
  productDescription?: string;
  productPrice?: number;
  productCategory?: string;
  imageUrl?: string;
  platform?: string;
  userId?: string;
}

export interface SEOResult {
  action: "generate_description";
  seo_title: string;
  description: string;
  meta_description: string;
  tags: string[];
}

export interface PriceResult {
  action: "suggest_price";
  suggested_price: number;
  min_price: number;
  premium_price: number;
  promo_price: number;
  promo_discount_percent: number;
  reasoning: string;
}

export interface ImageAnalysisResult {
  action: "analyze_image";
  suggested_name: string;
  description: string;
  suggested_category: string;
  colors: string[];
  tags: string[];
  estimated_price_min: number;
  estimated_price_max: number;
}

export interface RestockPhrasesResult {
  action: "generate_restock_phrases";
  phrases: string[];
}

export interface SocialPostResult {
  action: "generate_social_post";
  instagram_caption: string;
  tiktok_caption: string;
  art_suggestion: string;
}

export type AIResult = SEOResult | PriceResult | ImageAnalysisResult | RestockPhrasesResult | SocialPostResult;

export function useAIProductEnhance() {
  return useMutation({
    mutationFn: async (params: AIEnhanceParams): Promise<AIResult> => {
      const { data, error } = await supabase.functions.invoke("ai-product-enhance", {
        body: params,
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onError: (e) => {
      toast.error("Erro na IA: " + (e instanceof Error ? e.message : "Erro desconhecido"));
    },
  });
}
