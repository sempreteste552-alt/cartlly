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
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.endsWith(".lovable.app") ||
    host.endsWith(".lovableproject.com")
  );
}

export function getStoreBasePath(slug?: string | null) {
  return slug ? `/loja/${slug}` : "";
}

export function buildStoreUrl({
  slug,
  customDomain,
  domainStatus,
  path = "/",
}: {
  slug?: string | null;
  customDomain?: string | null;
  domainStatus?: string | null;
  path?: string;
}) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const domain = normalizeDomain(customDomain);

  if (domain && domainStatus === "verified") {
    return `https://${domain}${normalizedPath}`;
  }

  if (slug) {
    const base = `/loja/${slug}`;
    return normalizedPath === "/" ? base : `${base}${normalizedPath}`;
  }

  return normalizedPath;
}
