import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface StoreHomeSection {
  id: string;
  user_id: string;
  section_type: string;
  enabled: boolean;
  sort_order: number;
  title: string | null;
  subtitle: string | null;
  description: string | null;
  image_url: string | null;
  video_url: string | null;
  button_text: string | null;
  button_link: string | null;
  config: Record<string, any>;
  desktop_visible: boolean;
  mobile_visible: boolean;
  created_at: string;
  updated_at: string;
}

export const SECTION_TYPES = [
  { value: "hero_banner", label: "Hero Banner", icon: "🖼️" },
  { value: "slider", label: "Slider de Imagens", icon: "🎠" },
  { value: "categories", label: "Categorias em Destaque", icon: "📂" },
  { value: "best_sellers", label: "Mais Vendidos", icon: "🏆" },
  { value: "featured_products", label: "Produtos em Destaque", icon: "⭐" },
  { value: "new_arrivals", label: "Novidades", icon: "🆕" },
  { value: "collections", label: "Coleções", icon: "📦" },
  { value: "testimonials", label: "Depoimentos", icon: "💬" },
  { value: "instagram_feed", label: "Feed Instagram", icon: "📸" },
  { value: "faq", label: "FAQ", icon: "❓" },
  { value: "countdown", label: "Contagem Regressiva", icon: "⏰" },
  { value: "video", label: "Seção de Vídeo", icon: "🎬" },
  { value: "video_text", label: "Vídeo + Texto", icon: "📝" },
  { value: "newsletter", label: "Newsletter", icon: "✉️" },
  { value: "custom_html", label: "HTML / Texto Livre", icon: "🔧" },
  { value: "highlights", label: "Destaques (Stories)", icon: "💫" },
] as const;

export function useStoreHomeSections() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["store_home_sections", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_home_sections" as any)
        .select("*")
        .eq("user_id", user!.id)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as StoreHomeSection[];
    },
  });
}

export function useCreateHomeSection() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (section: Partial<StoreHomeSection> & { section_type: string }) => {
      const { data, error } = await supabase
        .from("store_home_sections" as any)
        .insert({ ...section, user_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store_home_sections"] });
      toast.success("Seção adicionada!");
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });
}

export function useUpdateHomeSection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<StoreHomeSection> & { id: string }) => {
      const { data, error } = await supabase
        .from("store_home_sections" as any)
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store_home_sections"] });
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });
}

export function useDeleteHomeSection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("store_home_sections" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store_home_sections"] });
      toast.success("Seção removida!");
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });
}

export function useReorderHomeSections() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (sections: { id: string; sort_order: number }[]) => {
      const promises = sections.map(({ id, sort_order }) =>
        supabase.from("store_home_sections" as any).update({ sort_order }).eq("id", id)
      );
      await Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store_home_sections"] });
    },
    onError: (e) => toast.error("Erro ao reordenar: " + e.message),
  });
}
