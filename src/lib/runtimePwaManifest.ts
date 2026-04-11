const MANIFEST_ID = "runtime-pwa-manifest";
const APPLE_ICON_SIZES = ["180x180", "167x167", "152x152", "120x120"];
let _lastAppliedTenantId: string | undefined;

const DEFAULT_ICONS = [
  { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png" },
  { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png" },
  { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
];

export interface PwaManifestOptions {
  id?: string;
  name?: string;
  shortName?: string;
  themeColor?: string;
  backgroundColor?: string;
  iconUrl?: string;
  iconVersion?: string;
  startUrl?: string;
  scope?: string;
}

function getCurrentPath() {
  const { origin, pathname } = window.location;
  const cleanPath = pathname.endsWith("/") ? pathname : `${pathname}/`;
  return `${origin}${cleanPath}`;
}

function withCacheBust(url: string, version?: string) {
  if (!version) return url;

  try {
    const parsed = new URL(url, window.location.origin);
    parsed.searchParams.set("v", version);
    return parsed.toString();
  } catch {
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}v=${encodeURIComponent(version)}`;
  }
}

function upsertMeta(name: string, content: string) {
  let meta = document.querySelector(`meta[name='${name}']`) as HTMLMetaElement | null;
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", name);
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", content);
}

function upsertLink(selector: string, attributes: Record<string, string>, href: string) {
  const existing = document.querySelector(selector) as HTMLLinkElement | null;
  const link = existing ?? document.createElement("link");

  Object.entries(attributes).forEach(([key, value]) => {
    link.setAttribute(key, value);
  });

  link.href = href;

  if (!existing) {
    document.head.appendChild(link);
  }
}

export function clearRuntimePwaManifest() {
  const existing = document.getElementById(MANIFEST_ID) as HTMLLinkElement | null;
  if (existing?.href?.startsWith("blob:")) {
    URL.revokeObjectURL(existing.href);
  }
  existing?.remove();
  _lastAppliedTenantId = undefined;
}

export function applyRuntimePwaManifest(options: PwaManifestOptions = {}) {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  // Prevent applying manifest without a tenant-specific id
  if (!options.id) return;

  const currentPath = getCurrentPath();
  const startUrl = options.startUrl || currentPath;
  const scope = options.scope || currentPath;
  const manifestId = options.id || startUrl;
  const appName = options.name || "Cartlly - Sua Loja Online";
  const shortName = options.shortName || appName.slice(0, 12) || "Cartlly";
  const resolvedIconUrl = options.iconUrl
    ? withCacheBust(options.iconUrl, options.iconVersion)
    : undefined;

  const icons = resolvedIconUrl
    ? [
        { src: resolvedIconUrl, sizes: "192x192", type: "image/png" },
        { src: resolvedIconUrl, sizes: "512x512", type: "image/png" },
        { src: resolvedIconUrl, sizes: "512x512", type: "image/png", purpose: "maskable" },
      ]
    : DEFAULT_ICONS;

  const manifest = {
    name: appName,
    short_name: shortName,
    description: `Acesse ${appName} direto da sua tela inicial`,
    theme_color: options.themeColor || "#6d28d9",
    background_color: options.backgroundColor || "#ffffff",
    display: "standalone" as const,
    orientation: "portrait" as const,
    id: manifestId,
    start_url: startUrl,
    scope,
    icons,
  };

  const manifestBlob = new Blob([JSON.stringify(manifest)], {
    type: "application/manifest+json",
  });
  const manifestUrl = URL.createObjectURL(manifestBlob);

  const existing = document.getElementById(MANIFEST_ID) as HTMLLinkElement | null;
  if (existing?.href?.startsWith("blob:")) {
    URL.revokeObjectURL(existing.href);
  }

  const link = existing ?? document.createElement("link");
  link.id = MANIFEST_ID;
  link.rel = "manifest";
  link.href = manifestUrl;

  if (!existing) {
    const staticManifest = document.querySelector('link[rel="manifest"]:not(#runtime-pwa-manifest)');
    staticManifest?.remove();
    document.head.appendChild(link);
  }

  document.title = appName;
  upsertMeta("theme-color", manifest.theme_color);
  upsertMeta("application-name", appName);
  upsertMeta("apple-mobile-web-app-title", shortName);

  if (resolvedIconUrl) {
    upsertLink('link[rel="icon"]', { rel: "icon" }, resolvedIconUrl);
    upsertLink('link[rel="shortcut icon"]', { rel: "shortcut icon" }, resolvedIconUrl);
    upsertLink('link[rel="apple-touch-icon"]:not([sizes])', { rel: "apple-touch-icon" }, resolvedIconUrl);

    APPLE_ICON_SIZES.forEach((size) => {
      upsertLink(
        `link[rel="apple-touch-icon"][sizes="${size}"]`,
        { rel: "apple-touch-icon", sizes: size },
        resolvedIconUrl,
      );
    });
  }
}
