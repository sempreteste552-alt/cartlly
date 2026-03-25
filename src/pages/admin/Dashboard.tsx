import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProducts } from "@/hooks/useProducts";
import { useOrders } from "@/hooks/useOrders";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, ShoppingCart, DollarSign, TrendingUp, Star } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

const COLORS = ["hsl(243 75% 59%)", "hsl(220 9% 46%)", "hsl(142 71% 45%)", "hsl(38 92% 50%)", "hsl(0 72% 51%)"];

export default function Dashboard() {
  const { data: products } = useProducts();
  const { data: orders } = useOrders();

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const metrics = useMemo(() => {
    const totalProducts = products?.length ?? 0;
    const monthOrders = orders?.filter((o) => o.created_at >= startOfMonth) ?? [];
    const monthRevenue = monthOrders.reduce((s, o) => s + Number(o.total), 0);
    const totalOrders = orders?.length ?? 0;
    return { totalProducts, monthOrdersCount: monthOrders.length, monthRevenue, totalOrders };
  }, [products, orders, startOfMonth]);

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  // Revenue by day (last 30 days)
  const revenueByDay = useMemo(() => {
    if (!orders) return [];
    const days: Record<string, number> = {};
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    orders
      .filter((o) => new Date(o.created_at) >= thirtyDaysAgo)
      .forEach((o) => {
        const day = new Date(o.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
        days[day] = (days[day] || 0) + Number(o.total);
      });
    return Object.entries(days)
      .map(([day, total]) => ({ day, total }))
      .slice(-15);
  }, [orders]);

  // Orders by status
  const ordersByStatus = useMemo(() => {
    if (!orders) return [];
    const counts: Record<string, number> = {};
    orders.forEach((o) => { counts[o.status] = (counts[o.status] || 0) + 1; });
    const labels: Record<string, string> = { pendente: "Pendente", processando: "Processando", enviado: "Enviado", entregue: "Entregue", cancelado: "Cancelado" };
    return Object.entries(counts).map(([status, count]) => ({ name: labels[status] || status, value: count }));
  }, [orders]);

  // Recent orders
  const recentOrders = orders?.slice(0, 5) ?? [];

  const stats = [
    { label: "Produtos", value: String(metrics.totalProducts), icon: Package, desc: "Total cadastrados" },
    { label: "Pedidos do Mês", value: String(metrics.monthOrdersCount), icon: ShoppingCart, desc: `de ${metrics.totalOrders} total` },
    { label: "Receita do Mês", value: formatCurrency(metrics.monthRevenue), icon: DollarSign, desc: "Faturamento mensal" },
    { label: "Ticket Médio", value: metrics.monthOrdersCount > 0 ? formatCurrency(metrics.monthRevenue / metrics.monthOrdersCount) : "R$ 0,00", icon: TrendingUp, desc: "Valor médio por pedido" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">Visão geral da sua loja</p>
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

      <div className="grid gap-4 md:grid-cols-2">
        {/* Revenue chart */}
        <Card className="border-border">
          <CardHeader><CardTitle className="text-lg">Receita (últimos 30 dias)</CardTitle></CardHeader>
          <CardContent>
            {revenueByDay.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={revenueByDay}>
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${v}`} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Bar dataKey="total" fill="hsl(243 75% 59%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">Sem dados de receita ainda</p>
            )}
          </CardContent>
        </Card>

        {/* Status pie */}
        <Card className="border-border">
          <CardHeader><CardTitle className="text-lg">Pedidos por Status</CardTitle></CardHeader>
          <CardContent>
            {ordersByStatus.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={ordersByStatus} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                    {ordersByStatus.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">Nenhum pedido ainda</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent orders */}
      <Card className="border-border">
        <CardHeader><CardTitle className="text-lg">Pedidos Recentes</CardTitle></CardHeader>
        <CardContent>
          {recentOrders.length > 0 ? (
            <div className="space-y-3">
              {recentOrders.map((o) => (
                <div key={o.id} className="flex items-center justify-between border-b border-border pb-2 last:border-0">
                  <div>
                    <p className="text-sm font-medium">{o.customer_name}</p>
                    <p className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleDateString("pt-BR")}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">{formatCurrency(Number(o.total))}</p>
                    <p className="text-xs text-muted-foreground capitalize">{o.status}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum pedido recente. Comece adicionando produtos à sua loja!</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
