import { buildStoreUrl } from "@/lib/storeDomain";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";


type Params = {
  storeId?: string | null;
  slug?: string | null;
  customDomain?: string | null;
  domainStatus?: string | null;
  path?: string;
};

export function useStorePublicUrl({ storeId, slug, customDomain, domainStatus, path = "/" }: Params) {
  const { data: registeredDomain } = useQuery({
    queryKey: ["store_public_primary_domain", storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_domains_public")
        .select("hostname, is_primary")
        .eq("store_id", storeId)
        .order("is_primary", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data?.hostname || null;
    },
    staleTime: 1000 * 60 * 10,
  });

  return buildStoreUrl({
    slug,
    customDomain: registeredDomain || customDomain,
    domainStatus,
    path,
  });
}
