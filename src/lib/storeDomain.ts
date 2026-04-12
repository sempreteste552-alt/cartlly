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
    "cartlly.com",
    "www.cartlly.com",
    "cartlly.com.br",
    "www.cartlly.com.br",
    "cartlly.lovable.app"
  ];

  if (platformDomains.includes(host)) return true;

  // Lovable subdomains
  return (
    host.endsWith(".lovable.app") ||
    host.endsWith(".lovableproject.com") ||
    host.endsWith(".lovable.dev")
  );
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
