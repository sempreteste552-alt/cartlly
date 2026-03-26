import { useMemo } from "react";
import { useAllTenants, useAllPlans } from "@/hooks/useUserRole";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Store, DollarSign, AlertTriangle, Package, ShoppingCart, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function SuperAdminDashboard() {
  const { data: tenants, isLoading } = useAllTenants();
  const { data: plans } = useAllPlans();

  const metrics = useMemo(() => {
    if (!tenants) return { total: 0, active: 0, trial: 0, blocked: 0, pending: 0, totalRevenue: 0, totalProducts: 0, totalOrders: 0 };
    const active = tenants.filter((t) => t.subscription?.status === "active").length;
    const trial = tenants.filter((t) => t.subscription?.status === "trial").length;
    const blocked = tenants.filter((t) => t.subscription?.status === "blocked" || t.subscription?.status === "expired").length;
    const pending = tenants.filter((t) => t.status === "pending").length;
    const totalRevenue = tenants.reduce((s, t) => s + (t.orders?.revenue || 0), 0);
    const totalProducts = tenants.reduce((s, t) => s + (t.productCount || 0), 0);
    const totalOrders = tenants.reduce((s, t) => s + (t.orders?.count || 0), 0);
    return { total: tenants.length, active, trial, blocked, pending, totalRevenue, totalProducts, totalOrders };
  }, [tenants]);

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

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

  const stats = [
    { label: "Total Tenants", value: String(metrics.total), icon: Users, desc: `${metrics.active} ativos, ${metrics.trial} em teste` },
    { label: "Receita Total", value: formatCurrency(metrics.totalRevenue), icon: DollarSign, desc: "Soma de todos os pedidos" },
    { label: "Total Produtos", value: String(metrics.totalProducts), icon: Package, desc: "Em todas as lojas" },
    { label: "Total Pedidos", value: String(metrics.totalOrders), icon: ShoppingCart, desc: "Em todas as lojas" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard Super Admin</h1>
        <p className="text-muted-foreground">Visão geral de todos os tenants</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
              <s.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{s.value}</div>
              <p className="text-xs text-muted-foreground">{s.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {metrics.blocked > 0 && (
        <Card className="border-destructive">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <div>
              <p className="font-medium text-destructive">{metrics.blocked} tenant(s) bloqueado(s)</p>
              <p className="text-xs text-muted-foreground">Verificar inadimplências na aba Tenants</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent tenants */}
      <Card className="border-border">
        <CardHeader><CardTitle className="text-lg">Tenants Recentes</CardTitle></CardHeader>
        <CardContent>
          {tenants && tenants.length > 0 ? (
            <div className="space-y-3">
              {tenants.slice(0, 10).map((t) => (
                <div key={t.id} className="flex items-center justify-between border-b border-border pb-2 last:border-0">
                  <div>
                    <p className="text-sm font-medium">{t.display_name || "Sem nome"}</p>
                    <p className="text-xs text-muted-foreground">{t.store?.store_name || "Sem loja"} • {t.productCount} produtos</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={
                      t.subscription?.status === "active" ? "default" :
                      t.subscription?.status === "trial" ? "secondary" :
                      "destructive"
                    }>
                      {t.subscription?.status || "sem plano"}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{formatCurrency(t.orders?.revenue || 0)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum tenant cadastrado ainda.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
