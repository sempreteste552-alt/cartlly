const MANIFEST_ID = "runtime-pwa-manifest";

const DEFAULT_ICONS = [
  { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png" },
  { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png" },
  { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
];

export interface PwaManifestOptions {
  /** App name shown on home screen */
  name?: string;
  /** Short name (max ~12 chars) */
  shortName?: string;
  /** Theme color (hex) */
  themeColor?: string;
  /** Background color (hex) */
  backgroundColor?: string;
  /** Custom icon URL (used for all sizes) */
  iconUrl?: string;
  /** Override start_url — defaults to current path */
  startUrl?: string;
  /** Override scope — defaults to current path */
  scope?: string;
}

function getCurrentPath() {
  const { origin, pathname } = window.location;
  // Ensure trailing slash for scope matching
  const cleanPath = pathname.endsWith("/") ? pathname : `${pathname}/`;
  return `${origin}${cleanPath}`;
}

/**
 * Apply (or update) a runtime PWA manifest in <head>.
 * Call this whenever tenant context changes so the install prompt
 * reflects the correct name, icon, start_url and scope.
 */
export function applyRuntimePwaManifest(options: PwaManifestOptions = {}) {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const currentPath = getCurrentPath();
  const startUrl = options.startUrl || currentPath;
  const scope = options.scope || currentPath;

  const icons = options.iconUrl
    ? [
        { src: options.iconUrl, sizes: "192x192", type: "image/png" },
        { src: options.iconUrl, sizes: "512x512", type: "image/png" },
        { src: options.iconUrl, sizes: "512x512", type: "image/png", purpose: "maskable" },
      ]
    : DEFAULT_ICONS;

  const manifest = {
    name: options.name || "Cartlly - Sua Loja Online",
    short_name: options.shortName || options.name?.slice(0, 12) || "Cartlly",
    description: options.name
      ? `Acesse ${options.name} direto da sua tela inicial`
      : "Gerencie sua loja online com facilidade",
    theme_color: options.themeColor || "#6d28d9",
    background_color: options.backgroundColor || "#ffffff",
    display: "standalone" as const,
    orientation: "portrait" as const,
    id: startUrl,
    start_url: startUrl,
    scope,
    icons,
  };

  const manifestBlob = new Blob([JSON.stringify(manifest)], {
    type: "application/manifest+json",
  });
  const manifestUrl = URL.createObjectURL(manifestBlob);

  // Revoke old blob if any
  const existing = document.getElementById(MANIFEST_ID) as HTMLLinkElement | null;
  if (existing?.href?.startsWith("blob:")) {
    URL.revokeObjectURL(existing.href);
  }

  const link = existing ?? document.createElement("link");
  link.id = MANIFEST_ID;
  link.rel = "manifest";
  link.href = manifestUrl;

  if (!existing) {
    // Remove any static manifest link first
    const staticManifest = document.querySelector('link[rel="manifest"]:not(#runtime-pwa-manifest)');
    staticManifest?.remove();
    document.head.appendChild(link);
  }
}
