import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useParams } from "react-router-dom";

export type CollaboratorRole = "admin" | "editor" | "viewer";
export type EffectiveUserResult = {
  effectiveId: string;
  role: "owner" | CollaboratorRole;
  isCollaborator: boolean;
  notFound?: boolean;
};

export function useEffectiveUser(): EffectiveUserResult & { isLoading: boolean } {
  const { user } = useAuth();
  const { slug: urlSlug } = useParams();

  const { data, isLoading } = useQuery({
    queryKey: ["effective_user", user?.id, urlSlug],
    enabled: !!user,
    queryFn: async () => {
      // 1. If no slug, we are probably in the user's own context
      if (!urlSlug) {
        return { 
          effectiveId: user!.id, 
          role: "owner" as const,
          isCollaborator: false 
        };
      }

      // 2. Find the store owner by slug
      const { data: store, error: storeError } = await supabase
        .from("store_settings")
        .select("user_id")
        .eq("store_slug", urlSlug)
        .maybeSingle();

      if (storeError) throw storeError;
      
      // If store not found (could be RLS) or it belongs to the user
      if (!store) {
        // If we are at /painel/:slug but store not found, we shouldn't be "owner" of it
        return { 
          effectiveId: user!.id, 
          role: "viewer" as const,
          isCollaborator: false,
          notFound: true
        };
      }

      if (store.user_id === user!.id) {
        return { 
          effectiveId: user!.id, 
          role: "owner" as const,
          isCollaborator: false 
        };
      }

      // 3. Check if user is a collaborator for this owner
      const { data: collab, error: collabError } = await supabase
        .from("store_collaborators")
        .select("role")
        .eq("store_owner_id", store.user_id)
        .eq("collaborator_id", user!.id)
        .maybeSingle();

      if (collabError) throw collabError;

      if (collab) {
        return { 
          effectiveId: store.user_id, 
          role: collab.role as CollaboratorRole,
          isCollaborator: true 
        };
      }

      // Fallback: If not a collaborator but trying to access a slug, 
      // return a restricted role to prevent accidental data leaks
      return { 
        effectiveId: user!.id, 
        role: "viewer" as const, // Safer fallback than owner
        isCollaborator: false 
      };
    }
  });

  return {
    effectiveId: data?.effectiveId ?? user?.id,
    role: data?.role ?? "owner",
    isCollaborator: data?.isCollaborator ?? false,
    isLoading
  };
}
