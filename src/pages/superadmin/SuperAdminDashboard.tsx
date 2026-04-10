import { useMemo, useState } from "react";
import { useAllTenants, useAllPlans } from "@/hooks/useUserRole";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Users, DollarSign, AlertTriangle, Package, ShoppingCart, Clock,
  ArrowUpRight, CheckCircle2, ArrowUp, TrendingUp, Zap,
  Crown, Ban, Timer, CreditCard, Percent, Shield, Bell, Sparkles, Send
} from "lucide-react";
import PaymentsDashboard from "@/components/PaymentsDashboard";

export default function SuperAdminDashboard() {
  const { data: tenants, isLoading } = useAllTenants();
  const { data: plans } = useAllPlans();
  const navigate = useNavigate();

  const { data: pendingRequests } = useQuery({
    queryKey: ["all_plan_requests_pending"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plan_change_requests")
        .select("*, requested_plan:tenant_plans!plan_change_requests_requested_plan_id_fkey(*), current_plan:tenant_plans!plan_change_requests_current_plan_id_fkey(*)")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: recentNotifications } = useQuery({
    queryKey: ["recent_admin_notifications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });

  const metrics = useMemo(() => {
    if (!tenants) return {
      total: 0, active: 0, trial: 0, blocked: 0, pending: 0, expired: 0,
      totalRevenue: 0, monthlyRevenue: 0, totalProducts: 0, totalOrders: 0,
      trialConversion: 0, trialExpiringSoon: [] as any[],
      subscriptionCycles: [] as any[],
    };

    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    const active = tenants.filter((t) => t.subscription?.status === "active");
    const trial = tenants.filter((t) => t.subscription?.status === "trial");
    const blocked = tenants.filter((t) =>
      ["blocked", "expired"].includes(t.subscription?.status || "") || t.status === "blocked"
    );
    const expired = tenants.filter((t) => t.subscription?.status === "expired" || t.subscription?.status === "past_due");

    // Trial expiring within 3 days
    const trialExpiringSoon = trial.filter((t) => {
      const trialEnd = t.subscription?.trial_ends_at;
      if (!trialEnd) return false;
      const daysLeft = Math.ceil((new Date(trialEnd).getTime() - now) / (1000 * 60 * 60 * 24));
      return daysLeft >= 0 && daysLeft <= 3;
    }).map((t) => {
      const daysLeft = Math.ceil((new Date(t.subscription.trial_ends_at).getTime() - now) / (1000 * 60 * 60 * 24));
      return { ...t, trialDaysLeft: Math.max(0, daysLeft) };
    });

    // Trial → paid conversion rate
    const totalEverTrial = tenants.filter((t) =>
      t.subscription?.trial_ends_at || t.subscription?.status === "trial"
    ).length;
    const convertedFromTrial = tenants.filter((t) =>
      t.subscription?.status === "active" && t.subscription?.trial_ends_at
    ).length;
    const trialConversion = totalEverTrial > 0 ? Math.round((convertedFromTrial / totalEverTrial) * 100) : 0;

    // Monthly revenue (orders created in last 30 days)
    const monthlyRevenue = tenants.reduce((sum, t) => sum + (t.orders?.revenue || 0), 0);

    // Subscription cycles for active tenants
    const subscriptionCycles = active.slice(0, 5).map((t) => {
      const sub = t.subscription;
      const start = new Date(sub.current_period_start).getTime();
      const end = new Date(sub.current_period_end).getTime();
      const total = end - start;
      const elapsed = now - start;
      const progress = Math.min(100, Math.max(0, (elapsed / total) * 100));
      const daysLeft = Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));
      const planName = (sub as any).tenant_plans?.name || "—";
      return { ...t, progress, daysLeft, planName };
    });

    return {
      total: tenants.length,
      active: active.length,
      trial: trial.length,
      blocked: blocked.length,
      pending: tenants.filter((t) => t.status === "pending").length,
      expired: expired.length,
      totalRevenue: tenants.reduce((s, t) => s + (t.orders?.revenue || 0), 0),
      monthlyRevenue,
      totalProducts: tenants.reduce((s, t) => s + (t.productCount || 0), 0),
      totalOrders: tenants.reduce((s, t) => s + (t.orders?.count || 0), 0),
      trialConversion,
      trialExpiringSoon,
      subscriptionCycles,
    };
  }, [tenants]);

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const pendingTenants = tenants?.filter((t) => t.status === "pending") ?? [];
  const unreadNotifications = recentNotifications?.filter((n) => !n.read) ?? [];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard Super Admin</h1>
        <p className="text-muted-foreground">Visão geral da plataforma em tempo real</p>
      </div>

      {/* Primary KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total Tenants", value: String(metrics.total), icon: Users, desc: `${metrics.active} ativos, ${metrics.trial} teste`, gradient: "from-primary/10 to-primary/5", border: "border-primary/20", iconColor: "text-primary" },
          { label: "Receita Total", value: formatCurrency(metrics.totalRevenue), icon: DollarSign, desc: "Soma de todas as lojas", gradient: "from-green-500/10 to-green-500/5", border: "border-green-500/20", iconColor: "text-green-500" },
          { label: "Total Produtos", value: String(metrics.totalProducts), icon: Package, desc: "Em todas as lojas", gradient: "from-blue-500/10 to-blue-500/5", border: "border-blue-500/20", iconColor: "text-blue-500" },
          { label: "Total Pedidos", value: String(metrics.totalOrders), icon: ShoppingCart, desc: "Em todas as lojas", gradient: "from-amber-500/10 to-amber-500/5", border: "border-amber-500/20", iconColor: "text-amber-500" },
        ].map((s) => (
          <Card key={s.label} className={`${s.border} bg-gradient-to-br ${s.gradient} shadow-sm hover:shadow-md transition-shadow`}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-background/80 shadow-sm">
                <s.icon className={`h-4 w-4 ${s.iconColor}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{s.value}</div>
              <p className="text-xs text-muted-foreground">{s.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Secondary KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Percent className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{metrics.trialConversion}%</p>
              <p className="text-xs text-muted-foreground">Conversão trial → pago</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-transparent">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
              <Timer className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{metrics.trial}</p>
              <p className="text-xs text-muted-foreground">Em período de teste</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-destructive/20 bg-gradient-to-br from-destructive/5 to-transparent">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10">
              <Ban className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{metrics.blocked}</p>
              <p className="text-xs text-muted-foreground">Bloqueados / expirados</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-green-500/20 bg-gradient-to-br from-green-500/5 to-transparent">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-500/10">
              <Crown className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{metrics.active}</p>
              <p className="text-xs text-muted-foreground">Assinantes ativos</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Smart alerts */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Trial expiring soon */}
        {metrics.trialExpiringSoon.length > 0 && (
          <Card className="border-amber-500/30 bg-gradient-to-r from-amber-500/10 to-transparent shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15">
                    <Timer className="h-4 w-4 text-amber-600 animate-pulse" />
                  </div>
                  <span className="font-bold text-amber-700">
                    ⏳ {metrics.trialExpiringSoon.length} trial(s) expirando
                  </span>
                </div>
                <Button size="sm" variant="outline" onClick={() => navigate("/superadmin/tenants")}>
                  Ver <ArrowUpRight className="ml-1 h-3 w-3" />
                </Button>
              </div>
              <div className="space-y-2">
                {metrics.trialExpiringSoon.slice(0, 4).map((t: any) => (
                  <div key={t.id} className="flex items-center justify-between rounded-lg bg-background/60 p-2.5 text-sm">
                    <span className="font-medium">{t.display_name || "Sem nome"}</span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${
                        t.trialDaysLeft <= 1
                          ? "border-destructive/50 text-destructive"
                          : "border-amber-500/50 text-amber-600"
                      }`}
                    >
                      {t.trialDaysLeft === 0 ? "Expira hoje!" : `${t.trialDaysLeft} dia(s)`}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pending tenants */}
        {pendingTenants.length > 0 && (
          <Card className="border-blue-500/30 bg-gradient-to-r from-blue-500/10 to-transparent shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/15">
                    <Clock className="h-4 w-4 text-blue-600 animate-pulse" />
                  </div>
                  <span className="font-bold text-blue-700">
                    📋 {pendingTenants.length} aguardando aprovação
                  </span>
                </div>
                <Button size="sm" variant="outline" onClick={() => navigate("/superadmin/tenants")}>
                  Ver <ArrowUpRight className="ml-1 h-3 w-3" />
                </Button>
              </div>
              <div className="space-y-1.5">
                {pendingTenants.slice(0, 3).map((t) => (
                  <div key={t.id} className="flex items-center justify-between rounded-lg bg-background/60 p-2 text-sm">
                    <span className="font-medium">{t.display_name || "Sem nome"}</span>
                    <Badge variant="secondary" className="text-[10px]">Pendente</Badge>
                  </div>
                ))}
                {pendingTenants.length > 3 && (
                  <p className="text-xs text-muted-foreground text-center">+{pendingTenants.length - 3} mais</p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pending plan requests */}
        {pendingRequests && pendingRequests.length > 0 && (
          <Card className="border-primary/30 bg-gradient-to-r from-primary/10 to-transparent shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15">
                    <ArrowUp className="h-4 w-4 text-primary animate-bounce" />
                  </div>
                  <span className="font-bold text-primary">📊 {pendingRequests.length} solicitação(ões)</span>
                </div>
                <Button size="sm" variant="outline" onClick={() => navigate("/superadmin/solicitacoes")}>
                  Gerenciar <ArrowUpRight className="ml-1 h-3 w-3" />
                </Button>
              </div>
              <div className="space-y-1.5">
                {pendingRequests.slice(0, 3).map((req: any) => {
                  const tenant = tenants?.find((t) => t.user_id === req.user_id);
                  return (
                    <div key={req.id} className="flex items-center justify-between rounded-lg bg-background/60 p-2 text-sm">
                      <span className="font-medium">{tenant?.display_name || "Tenant"}</span>
                      <div className="flex items-center gap-1">
                        <Badge variant="outline" className="text-[10px]">{req.current_plan?.name || "Grátis"}</Badge>
                        <span className="text-xs text-muted-foreground">→</span>
                        <Badge variant="default" className="text-[10px]">{req.requested_plan?.name || "—"}</Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {metrics.blocked > 0 && (
          <Card className="border-destructive/30 bg-gradient-to-r from-destructive/10 to-transparent shadow-sm">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-destructive">{metrics.blocked} tenant(s) bloqueado(s)/expirado(s)</p>
                <p className="text-xs text-muted-foreground">Requer atenção — verificar na aba Tenants</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => navigate("/superadmin/tenants")}>
                Ver <ArrowUpRight className="ml-1 h-3 w-3" />
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Subscription cycles */}
      {metrics.subscriptionCycles.length > 0 && (
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary" />
              Ciclo de Assinatura — Tenants Ativos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {metrics.subscriptionCycles.map((t: any) => (
                <div key={t.id} className="rounded-lg border border-border/50 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-sm font-medium">{t.display_name || "Sem nome"}</p>
                      <p className="text-xs text-muted-foreground">{t.store?.store_name || "—"}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">{t.planName}</Badge>
                      <span className={`text-xs font-semibold ${
                        t.daysLeft <= 5 ? "text-destructive" : t.daysLeft <= 10 ? "text-amber-600" : "text-muted-foreground"
                      }`}>
                        {t.daysLeft} dias restantes
                      </span>
                    </div>
                  </div>
                  <Progress
                    value={t.progress}
                    className={`h-1.5 ${
                      t.daysLeft <= 5 ? "[&>div]:bg-destructive" : t.daysLeft <= 10 ? "[&>div]:bg-amber-500" : ""
                    }`}
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {Math.round(t.progress)}% do ciclo
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent notifications */}
      {unreadNotifications.length > 0 && (
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Bell className="h-4 w-4 text-primary" />
                Notificações Recentes
                <Badge variant="secondary" className="text-[10px]">{unreadNotifications.length} não lidas</Badge>
              </CardTitle>
              <Button size="sm" variant="ghost" onClick={() => navigate("/superadmin/notificacoes")}>
                Ver todas <ArrowUpRight className="ml-1 h-3 w-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {unreadNotifications.slice(0, 5).map((n) => (
                <div key={n.id} className="flex items-center justify-between rounded-lg border border-border/50 p-2.5 hover:bg-muted/30 transition-colors">
                  <div>
                    <p className="text-sm font-medium">{n.title}</p>
                    <p className="text-xs text-muted-foreground truncate max-w-xs">{n.message}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap ml-2">
                    {new Date(n.created_at).toLocaleDateString("pt-BR")}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent tenants */}
      <Card className="border-border shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Tenants Recentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tenants && tenants.length > 0 ? (
            <div className="space-y-1.5">
              {tenants.slice(0, 10).map((t) => (
                <div key={t.id} className="flex items-center justify-between rounded-lg border border-border/50 p-2.5 hover:bg-muted/30 transition-colors">
                  <div>
                    <p className="text-sm font-medium">{t.display_name || "Sem nome"}</p>
                    <p className="text-xs text-muted-foreground">{t.store?.store_name || "Sem loja"} • {t.productCount} produtos</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={
                      t.status === "pending" ? "secondary" :
                      t.subscription?.status === "active" ? "default" :
                      t.subscription?.status === "trial" ? "secondary" : "destructive"
                    } className="text-[10px]">
                      {t.status === "pending" ? "⏳ pendente" : t.subscription?.status || "sem plano"}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{formatCurrency(t.orders?.revenue || 0)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-muted-foreground">Nenhum tenant.</p>}
        </CardContent>
      </Card>

      {/* Payments */}
      <div>
        <h2 className="text-sm font-bold mb-4 flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-primary" />
          Transações de Todos os Tenants
        </h2>
        <PaymentsDashboard isSuperAdmin />
      </div>
    </div>
  );
}
