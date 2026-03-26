import { Lock, ArrowUpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface LockedFeatureProps {
  children: React.ReactNode;
  isLocked: boolean;
  featureName?: string;
  logoUrl?: string;
}

export function LockedFeature({ children, isLocked, featureName, logoUrl }: LockedFeatureProps) {
  const navigate = useNavigate();

  if (!isLocked) return <>{children}</>;

  return (
    <div className="relative">
      <div className="pointer-events-none select-none filter blur-[3px] opacity-50">
        {children}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/70 backdrop-blur-sm rounded-lg z-10">
        {logoUrl && (
          <img src={logoUrl} alt="Logo" className="h-12 w-auto mb-3 opacity-30" />
        )}
        <div className="flex flex-col items-center gap-3 text-center px-6 max-w-sm">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 border-2 border-primary/20">
            <Lock className="h-7 w-7 text-primary" />
          </div>
          <p className="text-base font-bold text-foreground">
            {featureName || "Funcionalidade"} Bloqueada 🔒
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Desbloqueie <strong>{featureName || "esta funcionalidade"}</strong> e acelere suas vendas! 
            Faça upgrade do seu plano para ter acesso completo.
          </p>
          <Button
            onClick={() => navigate("/admin/plano")}
            className="mt-1 gap-2"
            size="sm"
          >
            <ArrowUpCircle className="h-4 w-4" />
            Ver Planos e Fazer Upgrade
          </Button>
        </div>
      </div>
    </div>
  );
}
