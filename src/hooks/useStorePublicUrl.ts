import { useEffect, useState } from "react";
import { buildStoreUrl, normalizeDomain } from "@/lib/storeDomain";

/**
 * Verifica se um domínio personalizado realmente serve a loja.
 * Alguns domínios ficam apenas "conectados" e redirecionam para o domínio
 * principal da plataforma — nesse caso o cliente cairia na página errada.
 * O resultado fica em cache na sessão para não repetir a checagem.
 */
export async function domainServesStore(domain: string): Promise<boolean> {
  const host = normalizeDomain(domain);
  if (!host) return false;
  if (typeof window === "undefined") return false;

  const cacheKey = `domain_serves_${host}`;
  const cached = sessionStorage.getItem(cacheKey);
  if (cached !== null) return cached === "1";

  try {
    const base = import.meta.env.VITE_SUPABASE_URL;
    const res = await fetch(
      `${base}/functions/v1/domain-probe?host=${encodeURIComponent(host)}`,
      {
        headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string },
      }
    );
    if (!res.ok) return true;
    const json = await res.json();
    const ok = json?.serves !== false;
    sessionStorage.setItem(cacheKey, ok ? "1" : "0");
    return ok;
  } catch {
    // Em caso de falha de rede, não assumimos que está quebrado
    return true;
  }
}


type Params = {
  slug?: string | null;
  customDomain?: string | null;
  domainStatus?: string | null;
  path?: string;
};

/**
 * URL pública da loja com fallback automático para /loja/slug
 * quando o domínio personalizado não estiver servindo o conteúdo.
 */
export function useStorePublicUrl({ slug, customDomain, domainStatus, path = "/" }: Params) {
  const slugUrl = buildStoreUrl({ slug, path });
  const domainUrl = buildStoreUrl({ slug, customDomain, domainStatus, path });
  const [url, setUrl] = useState(domainUrl || slugUrl);

  useEffect(() => {
    let active = true;
    const hasDomain = !!domainUrl && domainUrl !== slugUrl && !!customDomain;

    if (!hasDomain) {
      setUrl(slugUrl);
      return;
    }

    setUrl(domainUrl);
    domainServesStore(customDomain!).then((ok) => {
      if (!active) return;
      setUrl(ok ? domainUrl : slugUrl || domainUrl);
    });

    return () => {
      active = false;
    };
  }, [slugUrl, domainUrl, customDomain]);

  return url;
}
