import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface StoreHighlight {
  id: string;
  user_id: string;
  name: string;
  cover_url: string | null;
  sort_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
  items?: StoreHighlightItem[];
}

export interface StoreHighlightItem {
  id: string;
  highlight_id: string;
  media_type: string;
  media_url: string;
  sort_order: number;
  created_at: string;
}

export function useStoreHighlights() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["store_highlights", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_highlights" as any)
        .select("*, items:store_highlight_items(*)")
        .eq("user_id", user!.id)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as StoreHighlight[];
    },
  });
}

export function usePublicHighlights(userId?: string) {
  return useQuery({
    queryKey: ["public_highlights", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_highlights" as any)
        .select("*, items:store_highlight_items(*)")
        .eq("user_id", userId!)
        .eq("active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      const highlights = (data || []) as unknown as StoreHighlight[];
      return highlights.filter(h => h.items && h.items.length > 0);
    },
  });
}

export function useCreateHighlight() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; cover_url?: string }) => {
      const { data: row, error } = await supabase
        .from("store_highlights" as any)
        .insert({ ...data, user_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      return row as unknown as StoreHighlight;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["store_highlights"] });
      toast.success("Destaque criado!");
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });
}

export function useUpdateHighlight() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<StoreHighlight> & { id: string }) => {
      const { error } = await supabase
        .from("store_highlights" as any)
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["store_highlights"] }),
    onError: (e: any) => toast.error("Erro: " + e.message),
  });
}

export function useDeleteHighlight() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("store_highlights" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["store_highlights"] });
      toast.success("Destaque removido!");
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });
}

export function useAddHighlightItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { highlight_id: string; media_type: string; media_url: string; sort_order?: number }) => {
      const { error } = await supabase
        .from("store_highlight_items" as any)
        .insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["store_highlights"] });
      toast.success("Mídia adicionada!");
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });
}

export function useDeleteHighlightItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("store_highlight_items" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["store_highlights"] });
      toast.success("Mídia removida!");
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });
}
