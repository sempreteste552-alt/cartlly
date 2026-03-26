import { useMemo } from "react";
import { useAllTenants, useAllPlans } from "@/hooks/useUserRole";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, DollarSign, AlertTriangle, Package, ShoppingCart, Clock, ArrowUpRight, CheckCircle2, XCircle, ArrowUp } from "lucide-react";
import PaymentsDashboard from "@/components/PaymentsDashboard";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function SuperAdminDashboard() {
  const { data: tenants, isLoading } = useAllTenants();
  const { data: plans } = useAllPlans();
  const navigate = useNavigate();

  // Fetch pending plan change requests
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

  // Fetch recent notifications
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
    if (!tenants) return { total: 0, active: 0, trial: 0, blocked: 0, pending: 0, totalRevenue: 0, totalProducts: 0, totalOrders: 0 };
    return {
      total: tenants.length,
      active: tenants.filter((t) => t.subscription?.status === "active").length,
      trial: tenants.filter((t) => t.subscription?.status === "trial").length,
      blocked: tenants.filter((t) => ["blocked", "expired"].includes(t.subscription?.status || "") || t.status === "blocked").length,
      pending: tenants.filter((t) => t.status === "pending").length,
      totalRevenue: tenants.reduce((s, t) => s + (t.orders?.revenue || 0), 0),
      totalProducts: tenants.reduce((s, t) => s + (t.productCount || 0), 0),
      totalOrders: tenants.reduce((s, t) => s + (t.orders?.count || 0), 0),
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
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard Super Admin</h1>
        <p className="text-muted-foreground">Visão geral de todos os tenants</p>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total Tenants", value: String(metrics.total), icon: Users, desc: `${metrics.active} ativos, ${metrics.trial} teste`, gradient: "from-primary/10 to-primary/5", border: "border-primary/20", iconColor: "text-primary" },
          { label: "Receita Total", value: formatCurrency(metrics.totalRevenue), icon: DollarSign, desc: "Soma de todos", gradient: "from-green-500/10 to-green-500/5", border: "border-green-500/20", iconColor: "text-green-500" },
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

      {/* Alerts section */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Pending tenants */}
        {pendingTenants.length > 0 && (
          <Card className="border-amber-500/30 bg-gradient-to-r from-amber-500/10 to-transparent shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15">
                    <Clock className="h-4 w-4 text-amber-600 animate-pulse" />
                  </div>
                  <span className="font-bold text-amber-700">⏳ {pendingTenants.length} Aguardando Aprovação</span>
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
                  <span className="font-bold text-primary">📊 {pendingRequests.length} Solicitação(ões) de Plano</span>
                </div>
                <Button size="sm" variant="outline" onClick={() => navigate("/superadmin/tenants")}>
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
          <Card className="border-red-500/30 bg-gradient-to-r from-red-500/10 to-transparent shadow-sm">
            <CardContent className="flex items-center gap-3 p-4">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <div>
                <p className="font-medium text-red-600">{metrics.blocked} tenant(s) bloqueado(s)</p>
                <p className="text-xs text-muted-foreground">Verificar na aba Tenants</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Recent notifications */}
      {unreadNotifications.length > 0 && (
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">🔔 Notificações Recentes</CardTitle>
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
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Tenants Recentes</CardTitle></CardHeader>
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
        <h2 className="text-sm font-bold mb-4 flex items-center gap-2">💰 Transações de Todos os Tenants</h2>
        <PaymentsDashboard isSuperAdmin />
      </div>
    </div>
  );
}
