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
}

export function PlanLockedSection({ children, featureName, minPlan }: PlanLockedSectionProps) {
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
      <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-background/75 p-6 backdrop-blur-sm">
        <div className="flex max-w-sm flex-col items-center gap-3 text-center">
          <div className="relative">
            <div className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${planInfo.gradient} shadow-lg`}>
              <Lock className="h-6 w-6 text-white" />
            </div>
            <Badge className={`absolute -right-4 -top-2 ${planInfo.badgeClass} text-[10px]`}>
              <Sparkles className="mr-1 h-3 w-3" />
              {planInfo.label}
            </Badge>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">{featureName}</p>
            <p className="text-xs text-muted-foreground">Disponível a partir do plano {planInfo.label}.</p>
          </div>
          <Button size="sm" className={`gap-2 bg-gradient-to-r ${planInfo.gradient} text-white hover:opacity-90`} onClick={() => navigate("/admin/plano")}>
            <ArrowUpCircle className="h-4 w-4" />
            Fazer upgrade
          </Button>
        </div>
      </div>
    </div>
  );
}