import { Link } from "react-router-dom";
import { useAITenantUsage, getProgressColor } from "@/hooks/useAITenantUsage";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Sparkles, Zap, AlertTriangle, TrendingUp, Crown, Activity,
  Brain, Settings2, BarChart3, ShieldCheck, ArrowUpRight, CircleDollarSign,
} from "lucide-react";
import { useParams } from "react-router-dom";

export default function AdminAI() {
  const { slug } = useParams();
  const adminBasePath = slug ? `/painel/${slug}` : "/admin";
  const { data: usage, isLoading } = useAITenantUsage();

  const { data: alerts } = useQuery({
    queryKey: ["ai-alerts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("ai_alerts")
        .select("*")
        .eq("read", false)
        .order("created_at", { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });

  const { data: featureUsage } = useQuery({
    queryKey: ["ai-feature-usage"],
    queryFn: async () => {
      const since = new Date();
      since.setDate(1);
      const { data } = await supabase
        .from("ai_usage_logs")
        .select("feature, credits_charged, estimated_cost")
        .gte("created_at", since.toISOString());
      const map = new Map<string, { credits: number; cost: number; count: number }>();
      (data ?? []).forEach((l) => {
        const k = l.feature || "outro";
        const cur = map.get(k) ?? { credits: 0, cost: 0, count: 0 };
        cur.credits += Number(l.credits_charged ?? 0);
        cur.cost += Number(l.estimated_cost ?? 0);
        cur.count += 1;
        map.set(k, cur);
      });
      return Array.from(map.entries())
        .map(([feature, v]) => ({ feature, ...v }))
        .sort((a, b) => b.credits - a.credits)
        .slice(0, 6);
    },
  });

  if (isLoading || !usage) {
    return (
      <div className="space-y-6 p-1">
        <Skeleton className="h-12 w-1/2" />
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const pct = usage.usage_percent;
  const level = usage.alert_level;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Sparkles className="h-7 w-7 text-primary" />
            Central de IA
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gerencie consumo, configurações e recursos inteligentes da sua loja.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to={`${adminBasePath}/ai/usage`}><BarChart3 className="h-4 w-4 mr-2" />Consumo</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to={`${adminBasePath}/ai/features`}><Settings2 className="h-4 w-4 mr-2" />Recursos</Link>
          </Button>
          <Button size="sm" asChild>
            <Link to={`${adminBasePath}/cerebro`}><Brain className="h-4 w-4 mr-2" />Cérebro</Link>
          </Button>
        </div>
      </div>

      {/* Alert if approaching limit */}
      {level !== "ok" && (
        <Alert variant={level === "critical" || level === "blocking" ? "destructive" : "default"}>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>
            {level === "blocking" && "Limite mensal de IA atingido"}
            {level === "critical" && "Atenção: 90% do limite de IA usado"}
            {level === "warning" && "Você atingiu 75% do limite de IA"}
            {level === "info" && "Você já usou metade dos créditos de IA"}
          </AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>
              {level === "blocking"
                ? usage.hard_limit_enabled
                  ? "Novas chamadas de IA estão bloqueadas até o próximo período ou upgrade."
                  : "Excedente liberado — você continuará podendo usar IA, mas pode haver custo extra."
                : "Considere fazer upgrade do plano para garantir IA sem interrupções."}
            </span>
            <Button size="sm" variant="secondary" asChild>
              <Link to={`${adminBasePath}/plano`}><Crown className="h-3 w-3 mr-1" />Upgrade</Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Main usage card */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader>
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                Uso de IA neste mês
              </CardTitle>
              <CardDescription>
                Cota do plano: {usage.monthly_credit_limit.toLocaleString("pt-BR")} créditos
                {usage.topup_credits > 0 && (
                  <> · <span className="text-primary font-medium">+{usage.topup_credits} extras</span></>
                )}
              </CardDescription>
            </div>
            <Badge variant={level === "ok" ? "secondary" : "destructive"} className="text-sm">
              {pct.toFixed(1)}% usado
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {usage.monthly_credits_used.toLocaleString("pt-BR")} de {usage.monthly_credit_limit.toLocaleString("pt-BR")} créditos
              </span>
              <span className="font-semibold">
                {usage.available_credits.toLocaleString("pt-BR")} disponíveis
              </span>
            </div>
            <Progress
              value={Math.min(pct, 100)}
              className="h-3"
              indicatorClassName={getProgressColor(pct)}
            />
            <div className="flex justify-between text-xs text-muted-foreground pt-1">
              <span>0%</span><span>50%</span><span>75%</span><span>90%</span><span>100%</span>
            </div>
          </div>

          {usage.projected_credits_eom > 0 && (
            <div className="flex items-center gap-2 text-sm bg-muted/40 rounded-lg p-3">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span>
                Previsão até o fim do mês:{" "}
                <strong className={usage.projected_credits_eom > usage.monthly_credit_limit ? "text-destructive" : ""}>
                  {usage.projected_credits_eom.toLocaleString("pt-BR")} créditos
                </strong>
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* KPI cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard icon={Activity} label="Chamadas de IA" value={usage.total_requests.toLocaleString("pt-BR")} hint="Este mês" />
        <KpiCard icon={CircleDollarSign} label="Custo estimado" value={`R$ ${(usage.total_cost_usd * 5).toFixed(2)}`} hint="Provedor" />
        <KpiCard icon={Sparkles} label="Tokens" value={usage.total_tokens.toLocaleString("pt-BR")} hint="Entrada + saída" />
        <KpiCard icon={ShieldCheck} label="Falhas" value={usage.errors.toString()} hint={`${usage.errors === 0 ? "Tudo certo" : "Verifique logs"}`} />
      </div>

      {/* Top features */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recursos de IA mais usados</CardTitle>
          <CardDescription>Ranking deste mês por consumo de créditos</CardDescription>
        </CardHeader>
        <CardContent>
          {!featureUsage || featureUsage.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Nenhuma atividade de IA neste mês.
            </div>
          ) : (
            <div className="space-y-3">
              {featureUsage.map((f) => {
                const max = featureUsage[0].credits || 1;
                const w = (f.credits / max) * 100;
                return (
                  <div key={f.feature} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium capitalize">{f.feature.replace(/_/g, " ")}</span>
                      <span className="text-muted-foreground">{f.credits} créd · {f.count} usos</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-primary transition-all" style={{ width: `${w}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent alerts */}
      {alerts && alerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Alertas recentes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {alerts.map((a) => (
              <div key={a.id} className="flex items-start gap-3 p-3 rounded-lg border bg-muted/20">
                <Badge variant={a.severity === "critical" || a.severity === "blocking" ? "destructive" : "secondary"}>
                  {a.threshold_percent}%
                </Badge>
                <div className="flex-1">
                  <p className="font-medium text-sm">{a.title}</p>
                  <p className="text-xs text-muted-foreground">{a.message}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Quick links */}
      <div className="grid gap-3 md:grid-cols-3">
        <QuickLink to={`${adminBasePath}/cerebro`} icon={Brain} title="Cérebro da IA" desc="Personalidade, regras, contexto da loja" />
        <QuickLink to={`${adminBasePath}/ai/usage`} icon={BarChart3} title="Consumo detalhado" desc="Logs, erros, gastos por dia" />
        <QuickLink to={`${adminBasePath}/ai/features`} icon={Settings2} title="Recursos de IA" desc="Ative/desative features inteligentes" />
      </div>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, hint }: { icon: any; label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function QuickLink({ to, icon: Icon, title, desc }: { to: string; icon: any; title: string; desc: string }) {
  return (
    <Link to={to}>
      <Card className="hover:border-primary/40 transition-colors h-full">
        <CardContent className="p-4 flex items-start gap-3">
          <div className="p-2 rounded-lg bg-primary/10"><Icon className="h-5 w-5 text-primary" /></div>
          <div className="flex-1">
            <div className="flex items-center gap-1 font-medium text-sm">{title} <ArrowUpRight className="h-3 w-3 opacity-60" /></div>
            <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
