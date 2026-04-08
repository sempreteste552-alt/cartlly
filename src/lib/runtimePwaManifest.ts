const MANIFEST_ID = "runtime-pwa-manifest";

const DEFAULT_MANIFEST = {
  name: "Cartlly - Sua Loja Online",
  short_name: "Cartlly",
  description: "Gerencie sua loja online com facilidade",
  theme_color: "#6d28d9",
  background_color: "#ffffff",
  display: "standalone",
  orientation: "portrait",
  icons: [
    { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png" },
    { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png" },
    { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
};

function getInstallPath() {
  const { origin, pathname, search } = window.location;
  const cleanPath = pathname.endsWith("/") ? pathname : `${pathname}/`;
  return `${origin}${cleanPath}${search}`;
}

export function applyRuntimePwaManifest() {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const startUrl = getInstallPath();
  const manifest = {
    ...DEFAULT_MANIFEST,
    id: startUrl,
    start_url: startUrl,
    scope: startUrl,
  };

  const manifestBlob = new Blob([JSON.stringify(manifest)], { type: "application/manifest+json" });
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
    document.head.appendChild(link);
  }
}
