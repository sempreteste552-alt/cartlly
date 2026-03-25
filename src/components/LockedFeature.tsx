import { Lock } from "lucide-react";

interface LockedFeatureProps {
  children: React.ReactNode;
  isLocked: boolean;
  featureName?: string;
  logoUrl?: string;
}

export function LockedFeature({ children, isLocked, featureName, logoUrl }: LockedFeatureProps) {
  if (!isLocked) return <>{children}</>;

  return (
    <div className="relative">
      <div className="pointer-events-none select-none filter blur-[3px] opacity-50">
        {children}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/60 backdrop-blur-sm rounded-lg z-10">
        {logoUrl && (
          <img src={logoUrl} alt="Logo" className="h-12 w-auto mb-3 opacity-30" />
        )}
        <div className="flex flex-col items-center gap-2 text-center px-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Lock className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-semibold text-foreground">
            {featureName || "Funcionalidade"} Bloqueada
          </p>
          <p className="text-xs text-muted-foreground max-w-xs">
            Faça upgrade do seu plano ou contrate o administrador para acessar essa funcionalidade.
          </p>
        </div>
      </div>
    </div>
  );
}
