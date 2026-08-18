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
    const res = await fetch(`https://${host}/favicon.ico?probe=${Date.now()}`, {
      method: "GET",
      mode: "no-cors",
      redirect: "manual",
      cache: "no-store",
    });
    // "opaqueredirect" = o domínio redireciona para outro lugar (não serve a loja)
    const ok = res.type !== "opaqueredirect";
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
