import { buildStoreUrl } from "@/lib/storeDomain";


type Params = {
  slug?: string | null;
  customDomain?: string | null;
  domainStatus?: string | null;
  path?: string;
};

export function useStorePublicUrl({ slug, customDomain, domainStatus, path = "/" }: Params) {
  return buildStoreUrl({ slug, customDomain, domainStatus, path });
}
