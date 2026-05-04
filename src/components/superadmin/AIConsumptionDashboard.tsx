import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingUp, DollarSign, Image as ImageIcon, FileText, AlertTriangle,
  Activity, Crown, Server, Zap, Users, Sparkles, ShieldAlert, Gauge,
} from "lucide-react";

const BRL = (usd: number) => `R$ ${(usd * 5).toFixed(2)}`;

export function AIConsumptionDashboard() {
  // Aggregated logs of current month
  const { data: monthLogs, isLoading } = useQuery({
    queryKey: ["sa-ai-month-logs"],
    queryFn: async () => {
      const since = new Date();
      since.setDate(1); since.setHours(0, 0, 0, 0);
      const { data, error } = await supabase
        .from("ai_usage_logs")
        .select("user_id, provider, model, feature, status, total_tokens, estimated_cost, images_count, latency_ms, error_message, created_at")
        .gte("created_at", since.toISOString())
        .limit(10000);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: globalSettings } = useQuery({
    queryKey: ["ai-global-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("ai_global_settings").select("*").maybeSingle();
      return data;
    },
  });

  const { data: tenantUsage } = useQuery({
    queryKey: ["sa-ai-tenant-usage"],
    enabled: !!monthLogs,
    queryFn: async () => {
      const ids = Array.from(new Set((monthLogs ?? []).map((l) => l.user_id).filter(Boolean))) as string[];
      if (ids.length === 0) return { stores: new Map(), plans: new Map() };
      const [{ data: stores }, { data: subs }] = await Promise.all([
        supabase.from("store_settings").select("user_id, store_name, store_slug").in("user_id", ids),
        supabase.from("tenant_subscriptions").select("user_id, status, tenant_plans(name, price)").in("user_id", ids),
      ]);
      const storeMap = new Map<string, { name: string; slug: string }>();
      (stores ?? []).forEach((s: any) => storeMap.set(s.user_id, { name: s.store_name, slug: s.store_slug }));
      const planMap = new Map<string, { plan: string; price: number; status: string }>();
      (subs ?? []).forEach((s: any) =>
        planMap.set(s.user_id, { plan: s.tenant_plans?.name ?? "FREE", price: Number(s.tenant_plans?.price ?? 0), status: s.status }),
      );
      return { stores: storeMap, plans: planMap };
    },
  });

  if (isLoading || !monthLogs) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24" />
        <div className="grid gap-4 md:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
        <Skeleton className="h-72" />
      </div>
    );
  }

  // ---- aggregate ----
  const totalCost = monthLogs.reduce((a, l) => a + Number(l.estimated_cost ?? 0), 0);
  const totalTokens = monthLogs.reduce((a, l) => a + Number(l.total_tokens ?? 0), 0);
  const totalImages = monthLogs.reduce((a, l) => a + Number(l.images_count ?? 0), 0);
  const errors = monthLogs.filter((l) => l.status !== "success").length;
  const limit = Number(globalSettings?.global_monthly_limit_usd ?? 100);
  const usagePct = Math.min((totalCost / limit) * 100, 100);

  // projection
  const now = new Date();
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const factor = daysInMonth / Math.max(1, dayOfMonth);
  const projectedCost = totalCost * factor;

  // by tenant
  const byTenant = new Map<string, { cost: number; tokens: number; calls: number; errors: number }>();
  monthLogs.forEach((l) => {
    if (!l.user_id) return;
    const cur = byTenant.get(l.user_id) ?? { cost: 0, tokens: 0, calls: 0, errors: 0 };
    cur.cost += Number(l.estimated_cost ?? 0);
    cur.tokens += Number(l.total_tokens ?? 0);
    cur.calls += 1;
    if (l.status !== "success") cur.errors += 1;
    byTenant.set(l.user_id, cur);
  });
  const topTenants = Array.from(byTenant.entries())
    .map(([id, v]) => {
      const store = tenantUsage?.stores.get(id);
      const plan = tenantUsage?.plans.get(id);
      const revenue = (plan?.price ?? 0) / 5; // BRL→USD-like for margin in same unit
      const margin = revenue - v.cost;
      return { id, ...v, name: store?.name ?? id.slice(0, 8), slug: store?.slug, plan: plan?.plan ?? "FREE", price: plan?.price ?? 0, margin };
    })
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 10);

  const abusers = topTenants.filter((t) => t.margin < 0).slice(0, 5);

  // by feature
  const byFeature = new Map<string, { cost: number; calls: number }>();
  monthLogs.forEach((l) => {
    const k = l.feature || "outro";
    const cur = byFeature.get(k) ?? { cost: 0, calls: 0 };
    cur.cost += Number(l.estimated_cost ?? 0);
    cur.calls += 1;
    byFeature.set(k, cur);
  });
  const features = Array.from(byFeature.entries()).map(([f, v]) => ({ feature: f, ...v })).sort((a, b) => b.cost - a.cost);

  // by provider (health)
  const byProvider = new Map<string, { calls: number; errors: number; cost: number; latencySum: number; latencyN: number; lastError: string | null; lastErrorAt: string | null }>();
  monthLogs.forEach((l) => {
    const k = l.provider || "desconhecido";
    const cur = byProvider.get(k) ?? { calls: 0, errors: 0, cost: 0, latencySum: 0, latencyN: 0, lastError: null, lastErrorAt: null };
    cur.calls += 1;
    cur.cost += Number(l.estimated_cost ?? 0);
    if (l.latency_ms) { cur.latencySum += Number(l.latency_ms); cur.latencyN += 1; }
    if (l.status !== "success") {
      cur.errors += 1;
      if (!cur.lastErrorAt || l.created_at > cur.lastErrorAt) {
        cur.lastError = l.error_message || l.status;
        cur.lastErrorAt = l.created_at;
      }
    }
    byProvider.set(k, cur);
  });
  const providers = Array.from(byProvider.entries()).map(([name, v]) => ({
    name,
    ...v,
    errorRate: v.calls > 0 ? (v.errors / v.calls) * 100 : 0,
    avgLatency: v.latencyN > 0 ? Math.round(v.latencySum / v.latencyN) : 0,
  })).sort((a, b) => b.cost - a.cost);

  // global alert level
  const globalLevel: "ok" | "info" | "warning" | "critical" | "blocking" =
    usagePct >= 100 ? "blocking" : usagePct >= 90 ? "critical" : usagePct >= 75 ? "warning" : usagePct >= 50 ? "info" : "ok";

  return (
    <div className="space-y-6">
      {/* Global alert */}
      {globalLevel !== "ok" && (
        <Alert variant={globalLevel === "critical" || globalLevel === "blocking" ? "destructive" : "default"}>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>
            {globalLevel === "blocking" && "Limite mensal global da plataforma atingido"}
            {globalLevel === "critical" && "Alerta: 90% do orçamento global de IA usado"}
            {globalLevel === "warning" && "Atenção: 75% do orçamento global de IA"}
            {globalLevel === "info" && "Plataforma já consumiu metade do orçamento de IA"}
          </AlertTitle>
          <AlertDescription>
            Custo atual: <strong>{BRL(totalCost)}</strong> · Limite: {BRL(limit)} · Projeção fim do mês:{" "}
            <strong className={projectedCost > limit ? "text-destructive" : ""}>{BRL(projectedCost)}</strong>
          </AlertDescription>
        </Alert>
      )}

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={DollarSign} label="Custo do mês" value={BRL(totalCost)} hint={`Limite: ${BRL(limit)}`} progress={usagePct} />
        <Kpi icon={TrendingUp} label="Projeção fim do mês" value={BRL(projectedCost)}
          hint={projectedCost > limit ? "Acima do orçamento" : "Dentro do orçamento"} danger={projectedCost > limit} />
        <Kpi icon={FileText} label="Tokens" value={totalTokens.toLocaleString("pt-BR")} hint={`${monthLogs.length.toLocaleString("pt-BR")} chamadas`} />
        <Kpi icon={AlertTriangle} label="Taxa de erro" value={`${monthLogs.length ? ((errors / monthLogs.length) * 100).toFixed(1) : 0}%`} hint={`${errors} falhas`} danger={errors > 0} />
      </div>

      {/* Provider health */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Server className="h-4 w-4 text-primary" />Saúde dos provedores</CardTitle>
          <CardDescription>Latência, taxa de erro e custo por provedor neste mês</CardDescription>
        </CardHeader>
        <CardContent>
          {providers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Sem chamadas neste mês.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {providers.map((p) => {
                const status = p.errorRate >= 10 ? "down" : p.errorRate >= 3 ? "degraded" : "ok";
                return (
                  <div key={p.name} className="rounded-lg border p-4 space-y-2 bg-card">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${
                          status === "ok" ? "bg-emerald-500" : status === "degraded" ? "bg-amber-500" : "bg-destructive animate-pulse"
                        }`} />
                        <span className="font-semibold capitalize">{p.name}</span>
                      </div>
                      <Badge variant={status === "ok" ? "secondary" : "destructive"} className="text-[10px]">
                        {status === "ok" ? "Saudável" : status === "degraded" ? "Degradado" : "Instável"}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div>
                        <div className="text-muted-foreground">Erros</div>
                        <div className="font-bold">{p.errorRate.toFixed(1)}%</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground flex items-center justify-center gap-1"><Gauge className="h-3 w-3" />Latência</div>
                        <div className="font-bold">{p.avgLatency}ms</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Custo</div>
                        <div className="font-bold">{BRL(p.cost)}</div>
                      </div>
                    </div>
                    {p.lastError && (
                      <div className="text-[10px] text-destructive truncate" title={p.lastError}>
                        Último erro: {p.lastError}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top tenants + margin */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4 text-primary" />Top tenants por consumo</CardTitle>
            <CardDescription>Inclui margem (receita do plano − custo de IA)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {topTenants.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Sem consumo neste mês.</p>
            ) : topTenants.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-2 p-2 rounded-md hover:bg-muted/40">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">{t.name}</span>
                    <Badge variant="outline" className="text-[9px]">{t.plan}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">{t.calls} chamadas · {t.tokens.toLocaleString("pt-BR")} tokens</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-semibold">{BRL(t.cost)}</div>
                  <div className={`text-[10px] ${t.margin >= 0 ? "text-emerald-600" : "text-destructive font-bold"}`}>
                    Margem: R$ {(t.margin * 5 + (t.price - t.price)).toFixed(2)}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" />Distribuição por feature</CardTitle>
            <CardDescription>Ranking por custo neste mês</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {features.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Sem dados.</p>
            ) : features.map((f) => {
              const max = features[0].cost || 1;
              const w = (f.cost / max) * 100;
              return (
                <div key={f.feature} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="capitalize font-medium">{f.feature.replace(/_/g, " ")}</span>
                    <span className="text-muted-foreground">{BRL(f.cost)} · {f.calls}x</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${w}%` }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Abusers / negative margin */}
      {abusers.length > 0 && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-destructive" />
              Tenants em margem negativa
            </CardTitle>
            <CardDescription>Custo de IA superior à receita do plano — considere bloquear ou ajustar limites</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {abusers.map((t) => (
              <div key={t.id} className="flex items-center justify-between p-2 rounded-md border bg-background">
                <div>
                  <div className="font-medium text-sm">{t.name} <Badge variant="outline" className="text-[9px] ml-1">{t.plan}</Badge></div>
                  <div className="text-xs text-muted-foreground">Custo: {BRL(t.cost)} · Receita: R$ {t.price.toFixed(2)}</div>
                </div>
                <Button size="sm" variant="destructive" asChild>
                  <Link to="#tenants">Configurar limites</Link>
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, hint, progress, danger }:
  { icon: any; label: string; value: string; hint?: string; progress?: number; danger?: boolean }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className={`h-4 w-4 ${danger ? "text-destructive" : "text-muted-foreground"}`} />
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${danger ? "text-destructive" : ""}`}>{value}</div>
        {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
        {typeof progress === "number" && <Progress value={progress} className="h-2 mt-3" />}
      </CardContent>
    </Card>
  );
}
