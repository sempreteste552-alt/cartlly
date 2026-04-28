import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getSlugFromHostname, isPlatformHost, normalizeDomain } from "@/lib/storeDomain";
import cartlyLogo from "@/assets/cartly-logo.webp";

type StoreLogoSplashProps = {
  logoUrl?: string | null;
  storeName?: string | null;
  cacheKey?: string | null;
};

export function StoreLogoSplash({ logoUrl, storeName, cacheKey }: StoreLogoSplashProps) {
  const inferred = useMemo(() => {
    if (typeof window === "undefined") return { key: cacheKey || "store", slug: null as string | null, hostname: "" };
    const hostname = normalizeDomain(window.location.hostname);
    const pathSlug = window.location.pathname.match(/^\/loja\/([^/]+)/)?.[1]?.toLowerCase() || null;
    const hostSlug = !pathSlug ? getSlugFromHostname(hostname) : null;
    const slug = pathSlug || hostSlug;
    return { key: cacheKey || slug || hostname || "store", slug, hostname };
  }, [cacheKey]);

  const cachedLogo = typeof window !== "undefined" ? localStorage.getItem(`splash_logo_${inferred.key}`) : null;
  const cachedName = typeof window !== "undefined" ? localStorage.getItem(`splash_name_${inferred.key}`) : null;
  const [resolvedLogo, setResolvedLogo] = useState<string | null>(logoUrl || cachedLogo || null);
  const [resolvedName, setResolvedName] = useState<string | null>(storeName || cachedName || inferred.slug || null);

  useEffect(() => {
    if (logoUrl) setResolvedLogo(logoUrl);
    if (storeName) setResolvedName(storeName);
  }, [logoUrl, storeName]);

  useEffect(() => {
    if (logoUrl || typeof window === "undefined") return;
    let cancelled = false;

    const loadStoreLogo = async () => {
      try {
        let storeData: any = null;
        if (inferred.slug) {
          const { data } = await supabase
            .from("store_settings_public")
            .select("logo_url, store_name")
            .eq("store_slug", inferred.slug)
            .limit(1)
            .maybeSingle();
          storeData = data;
        } else if (inferred.hostname && !isPlatformHost(inferred.hostname)) {
          const { data: domainData } = await supabase
            .from("store_domains_public")
            .select("store_id")
            .eq("hostname", inferred.hostname)
            .limit(1)
            .maybeSingle();

          if (domainData?.store_id) {
            const { data } = await supabase
              .from("store_settings_public")
              .select("logo_url, store_name")
              .eq("id", domainData.store_id)
              .limit(1)
              .maybeSingle();
            storeData = data;
          } else {
            const { data } = await supabase
              .from("store_settings_public")
              .select("logo_url, store_name")
              .eq("custom_domain", inferred.hostname)
              .limit(1)
              .maybeSingle();
            storeData = data;
          }
        }

        if (cancelled || !storeData) return;
        if (storeData.logo_url) {
          setResolvedLogo(storeData.logo_url);
          localStorage.setItem(`splash_logo_${inferred.key}`, storeData.logo_url);
        }
        if (storeData.store_name) {
          setResolvedName(storeData.store_name);
          localStorage.setItem(`splash_name_${inferred.key}`, storeData.store_name);
        }
      } catch {
        // Keep the branded fallback visible without showing a spinner.
      }
    };

    loadStoreLogo();
    return () => {
      cancelled = true;
    };
  }, [logoUrl, inferred.hostname, inferred.key, inferred.slug]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-card"
      style={{ backgroundColor: "hsl(0 0% 100%)" }}
    >
      <img
        src={resolvedLogo || cartlyLogo}
        alt={resolvedName || "Loja"}
        className="object-contain store-logo-splash-pulse"
        style={{ maxHeight: "min(48vh, 360px)", maxWidth: "min(88vw, 460px)", width: "auto" }}
      />
    </div>
  );
}