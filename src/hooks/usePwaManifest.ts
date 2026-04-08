import { useEffect } from "react";
import { applyRuntimePwaManifest, PwaManifestOptions } from "@/lib/runtimePwaManifest";

/**
 * Hook that applies a dynamic PWA manifest based on the current
 * tenant/route context. Re-applies whenever options change.
 */
export function usePwaManifest(options: PwaManifestOptions) {
  useEffect(() => {
    applyRuntimePwaManifest(options);
  }, [
    options.name,
    options.shortName,
    options.themeColor,
    options.backgroundColor,
    options.iconUrl,
    options.startUrl,
    options.scope,
  ]);
}
