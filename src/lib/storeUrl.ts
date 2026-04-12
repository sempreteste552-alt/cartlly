import { StoreSettings } from "@/hooks/useStoreSettings";

export function getStorePublicUrl(settings: StoreSettings | null | undefined) {
  if (!settings) return "/";

  // Priority 1: Custom domain (if verified/active)
  if (settings.custom_domain && settings.domain_status === "verified") {
    return `https://${settings.custom_domain}`;
  }

  // Priority 2: Subdomain / Slug
  if (settings.store_slug) {
    // If we are on local development, we use the local origin
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/loja/${settings.store_slug}`;
  }

  return "/";
}
