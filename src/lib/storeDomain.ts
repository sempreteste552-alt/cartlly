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
  const cleanSlug = (slug || "").trim().replace(/^\/+|\/+$/g, "");

  // Domínio próprio ativo abre a vitrine diretamente na raiz e preserva sua
  // identidade na barra de endereço. O slug pertence apenas ao domínio da
  // plataforma e nunca deve ser anexado a um domínio personalizado.
  if (domain) {
    return `https://${domain}${normalizedPath === "/" ? "/" : normalizedPath}`;
  }

  // Sem domínio próprio, preserve o roteamento original por slug na mesma
  // origem em que o painel está aberto (produção, preview ou desenvolvimento).
  if (cleanSlug) {
    const base = `/loja/${cleanSlug}`;
    return normalizedPath === "/" ? base : `${base}${normalizedPath}`;
  }

  // Sem slug e sem domínio: não há loja pública para abrir
  return "";
}

