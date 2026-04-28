import cartlyLogo from "@/assets/cartly-logo.webp";

type PlatformLogoSplashProps = {
  contained?: boolean;
};

export function PlatformLogoSplash({ contained = false }: PlatformLogoSplashProps) {
  return (
    <div
      className={contained ? "flex h-64 items-center justify-center" : "fixed inset-0 z-[9999] flex items-center justify-center bg-background"}
      style={contained ? undefined : { backgroundColor: "hsl(var(--background))" }}
    >
      <img
        src={cartlyLogo}
        alt="Scalify"
        className="object-contain store-logo-splash-pulse"
        style={{ maxHeight: contained ? "96px" : "min(34vh, 240px)", maxWidth: contained ? "220px" : "min(76vw, 360px)", width: "auto" }}
      />
    </div>
  );
}