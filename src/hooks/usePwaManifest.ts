import { useLayoutEffect } from "react";
import { applyRuntimePwaManifest, clearRuntimePwaManifest, PwaManifestOptions } from "@/lib/runtimePwaManifest";

export function usePwaManifest(options: PwaManifestOptions) {
  useLayoutEffect(() => {
    // Don't apply manifest without a tenant-specific id
    if (!options.id) return;

    applyRuntimePwaManifest(options);

    return () => {
      // Clean up manifest when component unmounts (e.g. logout)
      clearRuntimePwaManifest();
    };
  }, [
    options.id,
    options.name,
    options.shortName,
    options.themeColor,
    options.backgroundColor,
    options.iconUrl,
    options.iconVersion,
    options.startUrl,
    options.scope,
  ]);
}
