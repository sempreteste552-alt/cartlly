import { Lock, ArrowUpCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { useTenantContext } from "@/hooks/useTenantContext";
import { canAccess, getBlockedReason, FEATURE_CATALOG, PLAN_INFO, type FeatureKey } from "@/lib/planPermissions";

interface PlanGateProps {
  feature: FeatureKey;
  children: React.ReactNode;
  inline?: boolean;
}

export function PlanGate({ feature, children, inline }: PlanGateProps) {
  const { ctx } = useTenantContext();
  const navigate = useNavigate();

  const hasAccess = canAccess(feature, ctx);
  if (hasAccess) return <>{children}</>;

  const meta = FEATURE_CATALOG[feature];
  const reason = getBlockedReason(feature, ctx);
  const minPlan = meta?.minPlan ?? "PRO";
  const planInfo = PLAN_INFO[minPlan];

  if (inline) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3 shadow-sm">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
          <Lock className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">{meta?.label ?? feature}</p>
          <p className="text-xs text-muted-foreground truncate">{reason}</p>
        </div>
        <Button size="sm" variant="outline" className="shrink-0 gap-1.5 text-xs" onClick={() => navigate("/admin/plano")}>
          <Sparkles className="h-3 w-3" /> {minPlan}
        </Button>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="pointer-events-none select-none filter blur-[3px] opacity-30">{children}</div>
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/60 backdrop-blur-md rounded-xl z-10">
        <div className="flex flex-col items-center gap-5 text-center px-8 max-w-md">
          <div className="relative">
            <div className={`flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${planInfo.gradient} shadow-lg`}>
              <Lock className="h-7 w-7 text-white" />
            </div>
            <Badge className={`absolute -top-2 -right-4 ${planInfo.badgeClass} text-[10px] px-2 py-0.5 shadow-sm`}>
              <Sparkles className="h-3 w-3 mr-0.5" /> {planInfo.label}
            </Badge>
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground">{meta?.label ?? "Recurso Premium"}</h3>
            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{meta?.description ?? "Este recurso não está disponível no seu plano atual."}</p>
          </div>
          <p className="text-xs text-muted-foreground/70">{reason}</p>
          <Button onClick={() => navigate("/admin/plano")} className={`gap-2 bg-gradient-to-r ${planInfo.gradient} hover:opacity-90 text-white shadow-md`} size="sm">
            <ArrowUpCircle className="h-4 w-4" /> Fazer Upgrade → {planInfo.label}
          </Button>
        </div>
      </div>
    </div>
  );
}
