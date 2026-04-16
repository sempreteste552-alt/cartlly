import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffectiveUser } from "@/hooks/useEffectiveUser";

export function useProductVideos(tenantId?: string) {
  return useQuery({
    queryKey: ["product-videos", tenantId],
    queryFn: async () => {
      // Since we are currently storing videos in product_images, we fetch from there
      // We filter by extension
      const { data, error } = await supabase
        .from("product_images")
        .select(`
          id,
          image_url,
          product_id,
          products (
            id,
            name,
            price,
            image_url,
            slug
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Filter for videos only
      return data.filter((item: any) => 
        item.image_url?.match(/\.(mp4|webm|ogg|mov|avi|mkv|flv|wmv|mov)$/i) || 
        item.image_url?.includes("product-videos")
      ).map((item: any) => ({
        id: item.id,
        video_url: item.image_url,
        product_id: item.product_id,
        product: item.products
      }));
    },
  });
}
