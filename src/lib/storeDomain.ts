export function normalizeDomain(value?: string | null) {
  return (value || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "") // Remove 'www.' prefix
    .replace(/\/.*$/, "")
    .replace(/\.$/, "")
    .replace(/:\d+$/, "");
}

export function isPlatformHost(hostname?: string | null) {
  const host = normalizeDomain(hostname);
  
  // Hardcoded platform domains
  const platformDomains = [
    "localhost",
    "127.0.0.1",
    "cartlly.lovable.app",
    "cartlly.com.br",
    "cartlly.com",
    "cartlly.store",
    "app.cartlly.com.br",
    "app.cartlly.com",
  ];

  if (platformDomains.includes(host)) return true;

  // Handle Lovable Cloud preview/dev domains
  if (host.includes(".lovable.app") && (host.includes("-preview-") || host.includes("--"))) {
    return true;
  }

  // Handle lovableproject.com subdomains (dev/preview environments)
  if (host.endsWith(".lovableproject.com")) {
    return true;
  }

  // ONLY treat specific platform subdomains as platform
  // Don't treat ALL .lovable.app subdomains as platform, 
  // as they are used for tenant stores (e.g. store-slug.lovable.app)
  return (
    host === "lovable.app" ||
    host === "www.lovable.app" ||
    host === "lovableproject.com" ||
    host === "lovable.dev"
  );
}

export function getSlugFromHostname(hostname: string) {
  const host = normalizeDomain(hostname);
  const platformDomains = ["cartlly.com", "cartlly.com.br", "cartlly.store", "lovable.app", "lovableproject.com"];
  
  // Only proceed if it ends with one of our platform domains
  const baseDomain = platformDomains.find(d => host.endsWith("." + d));
  if (!baseDomain) return null;

  const subdomain = host.replace("." + baseDomain, "");
  // Ignore 'www' and other platform-reserved subdomains
  if (["www", "cartlly", "admin", "app"].includes(subdomain)) return null;

  // Don't treat preview URLs as slugs
  if (subdomain.includes("-preview-") || subdomain.includes("--")) return null;

  return subdomain;
}


export function getStoreBasePath(slug?: string | null) {
  return slug ? `/loja/${slug}` : "";
}

/**
 * Origem pública da plataforma. Se o admin estiver aberto em um domínio
 * personalizado de loja, usamos o domínio oficial para montar links /loja/slug.
 */
export function getPlatformOrigin() {
  if (typeof window === "undefined") return "https://cartlly.store";
  const host = window.location.hostname;
  if (isPlatformHost(host)) return window.location.origin;
  return "https://cartlly.store";
}

export function buildStoreUrl({
  slug,
  customDomain,
  domainStatus,
  sslReady,
  path = "/",
}: {
  slug?: string | null;
  customDomain?: string | null;
  domainStatus?: string | null;
  sslReady?: boolean | null;
  path?: string;
}) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const domain = normalizeDomain(customDomain);

  // Prioridade 1: domínio personalizado verificado/ativo
  if (domain && ["verified", "active", "published", "live"].includes(String(domainStatus || ""))) {
    return `https://${domain}${normalizedPath === "/" ? "/" : normalizedPath}`;
  }

  // Prioridade 2: slug na plataforma (sempre absoluto, para funcionar
  // mesmo quando o admin está aberto em um domínio personalizado)
  const cleanSlug = (slug || "").trim().replace(/^\/+|\/+$/g, "");
  if (cleanSlug) {
    const base = `/loja/${cleanSlug}`;
    const resultPath = normalizedPath === "/" ? base : `${base}${normalizedPath}`;
    return `${getPlatformOrigin()}${resultPath}`;
  }

  // Sem slug e sem domínio: não há loja pública para abrir
  return "";
}

