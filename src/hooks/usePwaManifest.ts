import { useLayoutEffect } from "react";
import { applyRuntimePwaManifest, PwaManifestOptions } from "@/lib/runtimePwaManifest";

export function usePwaManifest(options: PwaManifestOptions) {
  useLayoutEffect(() => {
    applyRuntimePwaManifest(options);
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
