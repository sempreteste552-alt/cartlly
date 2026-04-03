import { ArrowUpCircle, Lock, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTenantContext } from "@/hooks/useTenantContext";
import { PLAN_INFO, isBlocked, planLevel, type PlanSlug } from "@/lib/planPermissions";

interface PlanLockedSectionProps {
  children: React.ReactNode;
  featureName: string;
  minPlan: PlanSlug;
  compact?: boolean;
}

export function PlanLockedSection({ children, featureName, minPlan, compact = false }: PlanLockedSectionProps) {
  const navigate = useNavigate();
  const { ctx, isLoading } = useTenantContext();

  if (isLoading) {
    return <>{children}</>;
  }

  const unlocked = (ctx.isTrial && !ctx.isTrialExpired) || (!isBlocked(ctx) && planLevel(ctx.planSlug) >= planLevel(minPlan));

  if (unlocked) {
    return <>{children}</>;
  }

  const planInfo = PLAN_INFO[minPlan];

  return (
    <div className="relative">
      <div className="pointer-events-none select-none opacity-45 blur-[2px]">{children}</div>
      <div className={`absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-background/75 backdrop-blur-sm ${compact ? "p-3" : "p-6"}`}>
        <div className={`flex flex-col items-center text-center ${compact ? "max-w-xs gap-2" : "max-w-sm gap-3"}`}>
          <div className="relative">
            <div className={`flex items-center justify-center rounded-2xl bg-gradient-to-br ${planInfo.gradient} shadow-lg ${compact ? "h-10 w-10" : "h-14 w-14"}`}>
              <Lock className={`text-white ${compact ? "h-4 w-4" : "h-6 w-6"}`} />
            </div>
            <Badge className={`absolute ${compact ? "-right-3 -top-2" : "-right-4 -top-2"} ${planInfo.badgeClass} text-[10px]`}>
              <Sparkles className="mr-1 h-3 w-3" />
              {planInfo.label}
            </Badge>
          </div>
          <div className="space-y-1">
            <p className={`font-semibold text-foreground ${compact ? "text-xs" : "text-sm"}`}>{featureName}</p>
            <p className="text-xs text-muted-foreground">Disponível a partir do plano {planInfo.label}.</p>
          </div>
          <Button size="sm" className={`gap-2 bg-gradient-to-r ${planInfo.gradient} text-white hover:opacity-90 ${compact ? "h-8 px-3 text-xs" : ""}`} onClick={() => navigate("/admin/plano")}>
            <ArrowUpCircle className="h-4 w-4" />
            Fazer upgrade
          </Button>
        </div>
      </div>
    </div>
  );
}