import { Lock, ArrowUpCircle, Crown, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { useTenantContext } from "@/hooks/useTenantContext";
import { canAccess, getBlockedReason, FEATURE_CATALOG, type FeatureKey } from "@/lib/planPermissions";

interface PlanGateProps {
  feature: FeatureKey;
  children: React.ReactNode;
  /** If true, shows a compact inline lock instead of full overlay */
  inline?: boolean;
}

/**
 * Wraps content and shows a premium lock overlay if the feature is not available.
 * Uses the centralized permissions engine.
 */
export function PlanGate({ feature, children, inline }: PlanGateProps) {
  const { ctx } = useTenantContext();
  const navigate = useNavigate();

  const hasAccess = canAccess(feature, ctx);

  if (hasAccess) return <>{children}</>;

  const meta = FEATURE_CATALOG[feature];
  const reason = getBlockedReason(feature, ctx);
  const minPlan = meta?.minPlan ?? "PRO";

  if (inline) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
          <Lock className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">{meta?.label ?? feature}</p>
          <p className="text-xs text-muted-foreground truncate">{reason}</p>
        </div>
        <Button size="sm" variant="outline" className="shrink-0 gap-1 text-xs border-primary/30 text-primary hover:bg-primary/10" onClick={() => navigate("/admin/plano")}>
          <Crown className="h-3 w-3" /> Upgrade
        </Button>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="pointer-events-none select-none filter blur-[3px] opacity-40">
        {children}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg z-10">
        <div className="flex flex-col items-center gap-4 text-center px-8 max-w-md">
          <div className="relative">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 shadow-lg">
              <Lock className="h-8 w-8 text-primary" />
            </div>
            <Badge className="absolute -top-2 -right-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 text-[10px] px-2 py-0.5 shadow-md">
              <Sparkles className="h-3 w-3 mr-0.5" /> {minPlan}
            </Badge>
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground">
              {meta?.label ?? "Recurso Premium"}
            </h3>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
              {meta?.description ?? "Este recurso não está disponível no seu plano atual."}
            </p>
          </div>
          <p className="text-xs text-muted-foreground/80">
            {reason}
          </p>
          <Button
            onClick={() => navigate("/admin/plano")}
            className="gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-md"
            size="sm"
          >
            <ArrowUpCircle className="h-4 w-4" />
            Fazer Upgrade → {minPlan}
          </Button>
        </div>
      </div>
    </div>
  );
}
