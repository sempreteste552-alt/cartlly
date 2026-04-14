import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Crown, Clock, Sparkles, ArrowRight, Lock } from "lucide-react";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";

export function TrialBanner() {
  const { subscription } = usePlanFeatures();
  const navigate = useNavigate();

  if (!subscription.isTrial && !subscription.isTrialExpired && !subscription.isBlocked) {
    return null;
  }

  // Trial active
  if (subscription.isTrial && !subscription.isTrialExpired) {
    const progress = Math.max(0, ((7 - subscription.trialDaysLeft) / 7) * 100);
    return (
      <Card className="border-primary/30 bg-gradient-to-r from-primary/[0.06] via-primary/[0.03] to-transparent overflow-hidden relative">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <CardContent className="p-4 sm:p-5 relative">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 shrink-0">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-foreground">Período de Teste</p>
                  <Badge variant="outline" className="border-primary/30 text-primary text-[10px]">
                    <Clock className="h-3 w-3 mr-1" />
                    {subscription.trialDaysLeft} {subscription.trialDaysLeft === 1 ? "dia" : "dias"} restantes
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Aproveite todos os recursos premium durante o teste
                </p>
              </div>
            </div>
            <Button size="sm" onClick={() => navigate(`/painel/${slug}/plano`)} className="gap-1.5 shrink-0">
              <Crown className="h-3.5 w-3.5" />
              Ativar Plano
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
          <Progress value={progress} className="mt-3 h-1.5" />
        </CardContent>
      </Card>
    );
  }

  // Trial expired or blocked
  return (
    <Card className="border-destructive/30 bg-gradient-to-r from-destructive/[0.06] via-destructive/[0.03] to-transparent overflow-hidden relative">
      <CardContent className="p-4 sm:p-5 relative">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10 shrink-0">
              <Lock className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="font-semibold text-foreground">
                {subscription.isTrialExpired ? "Teste Expirado" : "Acesso Limitado"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {subscription.isTrialExpired
                  ? "Seu período de teste terminou. Ative um plano para continuar usando todos os recursos."
                  : "Alguns recursos estão bloqueados. Ative ou renove seu plano."}
              </p>
            </div>
          </div>
          <Button size="sm" onClick={() => navigate(`/painel/${slug}/plano`)} className="gap-1.5 shrink-0 bg-destructive hover:bg-destructive/90">
            <Crown className="h-3.5 w-3.5" />
            Ativar Plano
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
