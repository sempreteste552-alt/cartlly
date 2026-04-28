import { useEffect, useState } from "react";
import cartlyLogo from "@/assets/cartly-logo.webp";

type PlatformLogoSplashProps = {
  contained?: boolean;
};

export function PlatformLogoSplash({ contained = false }: PlatformLogoSplashProps) {
  // Wait for the logo to actually finish decoding before showing it
  // (prevents the "logo flashes after the page is already visible" bug)
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const img = new Image();
    img.src = cartlyLogo;
    if ((img as any).decode) {
      (img as any).decode().then(() => setReady(true)).catch(() => setReady(true));
    } else {
      img.onload = () => setReady(true);
      img.onerror = () => setReady(true);
    }
  }, []);

  return (
    <div
      className={
        (contained
          ? "flex h-64 items-center justify-center"
          : "app-splash-overlay fixed inset-0 z-[9999] flex items-center justify-center bg-background")
      }
      style={contained ? undefined : { backgroundColor: "hsl(var(--background))" }}
    >
      <img
        src={cartlyLogo}
        alt="Scalify"
        className="object-contain store-logo-splash-pulse"
        style={{
          maxHeight: contained ? "96px" : "min(34vh, 240px)",
          maxWidth: contained ? "220px" : "min(76vw, 360px)",
          width: "auto",
          opacity: ready ? 1 : 0,
          transition: "opacity 200ms ease-out",
        }}
      />
    </div>
  );
}