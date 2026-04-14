export function normalizeDomain(value?: string | null) {
  return (value || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/\.$/, "")
    .replace(/:\d+$/, "");
}

export function isPlatformHost(hostname?: string | null) {
  const host = (hostname || "").toLowerCase();
  
  // Hardcoded platform domains
  const platformDomains = [
    "localhost",
    "127.0.0.1",
    "cartlly.lovable.app",
    "www.cartlly.lovable.app",
    "cartlly.com.br",
    "www.cartlly.com.br",
  ];

  if (platformDomains.includes(host)) return true;

  // Handle Lovable Cloud preview domains
  if (host.includes(".lovable.app") && (host.includes("-preview-") || host.includes("--"))) {
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
  const host = hostname.toLowerCase();
  const platformDomains = ["cartlly.com", "cartlly.com.br", "lovable.app", "lovableproject.com"];
  
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

  // Priority 1: Verified Custom Domain with SSL
  // Status 'active' or 'verified' are considered valid for public use
  if (domain && (domainStatus === "verified" || domainStatus === "active")) {
    // If sslReady is explicitly false, we might want to wait, 
    // but usually if status is 'active', SSL is already verified by the edge function
    return `https://${domain}${normalizedPath}`;
  }

  // Priority 2: Platform Slug-based URL (Fallback)
  if (slug) {
    const base = `/loja/${slug}`;
    const resultPath = normalizedPath === "/" ? base : `${base}${normalizedPath}`;
    return resultPath;
  }

  return normalizedPath;
}
