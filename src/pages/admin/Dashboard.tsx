import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProducts } from "@/hooks/useProducts";
import { useOrders } from "@/hooks/useOrders";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, ShoppingCart, DollarSign, TrendingUp, Users, AlertTriangle, Award, BarChart3 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line } from "recharts";
import { MultiStoreManager } from "@/components/MultiStoreManager";

const COLORS = ["hsl(243 75% 59%)", "hsl(220 9% 46%)", "hsl(142 71% 45%)", "hsl(38 92% 50%)", "hsl(0 72% 51%)"];

export default function Dashboard() {
  const { data: products } = useProducts();
  const { data: orders } = useOrders();
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState<string>("todos");

  // Fetch order items for top products analysis
  const { data: allOrderItems } = useQuery({
    queryKey: ["all_order_items", user?.id],
    queryFn: async () => {
      const orderIds = orders?.map((o) => o.id) ?? [];
      if (orderIds.length === 0) return [];
      const { data, error } = await supabase
        .from("order_items")
        .select("*")
        .in("order_id", orderIds);
      if (error) throw error;
      return data;
    },
    enabled: !!orders && orders.length > 0,
  });

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
  const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString();

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const metrics = useMemo(() => {
    const totalProducts = products?.length ?? 0;
    const monthOrders = orders?.filter((o) => o.created_at >= startOfMonth) ?? [];
    const monthRevenue = monthOrders.reduce((s, o) => s + Number(o.total), 0);
    const totalOrders = orders?.length ?? 0;
    const prevOrders = orders?.filter((o) => o.created_at >= prevMonthStart && o.created_at <= prevMonthEnd) ?? [];
    const prevRevenue = prevOrders.reduce((s, o) => s + Number(o.total), 0);
    const revenueGrowth = prevRevenue > 0 ? ((monthRevenue - prevRevenue) / prevRevenue) * 100 : 0;

    // Unique customers
    const uniqueCustomers = new Set(orders?.map((o) => o.customer_email || o.customer_phone || o.customer_name)).size;

    // Recurring customers (appeared 2+ times)
    const customerCounts: Record<string, number> = {};
    orders?.forEach((o) => {
      const key = o.customer_email || o.customer_phone || o.customer_name;
      customerCounts[key] = (customerCounts[key] || 0) + 1;
    });
    const recurringCustomers = Object.values(customerCounts).filter((c) => c >= 2).length;

    // Low stock products
    const lowStock = products?.filter((p) => p.stock <= 5 && p.stock > 0) ?? [];
    const outOfStock = products?.filter((p) => p.stock === 0) ?? [];

    return {
      totalProducts, monthOrdersCount: monthOrders.length, monthRevenue, totalOrders,
      revenueGrowth, uniqueCustomers, recurringCustomers, lowStock, outOfStock,
    };
  }, [products, orders, startOfMonth, prevMonthStart, prevMonthEnd]);

  // Top selling products
  const topProducts = useMemo(() => {
    if (!allOrderItems) return [];
    const counts: Record<string, { name: string; quantity: number; revenue: number }> = {};
    allOrderItems.forEach((item) => {
      const key = item.product_name;
      if (!counts[key]) counts[key] = { name: key, quantity: 0, revenue: 0 };
      counts[key].quantity += item.quantity;
      counts[key].revenue += Number(item.unit_price) * item.quantity;
    });
    return Object.values(counts).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [allOrderItems]);

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
    return Object.entries(days).map(([day, total]) => ({ day, total })).slice(-15);
  }, [orders]);

  // Orders by day (for line chart)
  const ordersByDay = useMemo(() => {
    if (!orders) return [];
    const days: Record<string, number> = {};
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    orders
      .filter((o) => new Date(o.created_at) >= thirtyDaysAgo)
      .forEach((o) => {
        const day = new Date(o.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
        days[day] = (days[day] || 0) + 1;
      });
    return Object.entries(days).map(([day, count]) => ({ day, count })).slice(-15);
  }, [orders]);

  // Orders by status
  const ordersByStatus = useMemo(() => {
    if (!orders) return [];
    const counts: Record<string, number> = {};
    orders.forEach((o) => { counts[o.status] = (counts[o.status] || 0) + 1; });
    const labels: Record<string, string> = { pendente: "Pendente", processando: "Processando", enviado: "Enviado", entregue: "Entregue", cancelado: "Cancelado" };
    return Object.entries(counts).map(([status, count]) => ({ name: labels[status] || status, value: count }));
  }, [orders]);

  // Coupon usage
  const couponStats = useMemo(() => {
    if (!orders) return { total: 0, withCoupon: 0, totalDiscount: 0 };
    const withCoupon = orders.filter((o) => o.coupon_code);
    const totalDiscount = withCoupon.reduce((s, o) => s + Number(o.discount_amount), 0);
    return { total: orders.length, withCoupon: withCoupon.length, totalDiscount };
  }, [orders]);

  // Filtered orders by status
  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    if (statusFilter === "todos") return orders;
    return orders.filter((o) => o.status === statusFilter);
  }, [orders, statusFilter]);

  const recentOrders = filteredOrders.slice(0, 10);

  const stats = [
    { label: "Produtos", value: String(metrics.totalProducts), icon: Package, desc: "Total cadastrados", color: "text-blue-500" },
    { label: "Pedidos do Mês", value: String(metrics.monthOrdersCount), icon: ShoppingCart, desc: `de ${metrics.totalOrders} total`, color: "text-purple-500" },
    { label: "Receita do Mês", value: formatCurrency(metrics.monthRevenue), icon: DollarSign, desc: metrics.revenueGrowth !== 0 ? `${metrics.revenueGrowth > 0 ? "+" : ""}${metrics.revenueGrowth.toFixed(1)}% vs mês anterior` : "Faturamento mensal", color: "text-green-500" },
    { label: "Ticket Médio", value: metrics.monthOrdersCount > 0 ? formatCurrency(metrics.monthRevenue / metrics.monthOrdersCount) : "R$ 0,00", icon: TrendingUp, desc: "Valor médio por pedido", color: "text-amber-500" },
    { label: "Clientes Únicos", value: String(metrics.uniqueCustomers), icon: Users, desc: `${metrics.recurringCustomers} recorrentes`, color: "text-cyan-500" },
    { label: "Estoque Baixo", value: String(metrics.lowStock.length), icon: AlertTriangle, desc: `${metrics.outOfStock.length} esgotados`, color: metrics.lowStock.length > 0 ? "text-red-500" : "text-muted-foreground" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">Visão geral da sua loja</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => (
          <Card key={s.label} className="border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
              <s.icon className={`h-4 w-4 ${s.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{s.value}</div>
              <p className="text-xs text-muted-foreground">{s.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Low stock alert */}
      {metrics.lowStock.length > 0 && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" /> Alerta de Estoque Baixo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {metrics.lowStock.map((p) => (
                <Badge key={p.id} variant="outline" className="border-amber-500/50">
                  {p.name} ({p.stock} un.)
                </Badge>
              ))}
              {metrics.outOfStock.map((p) => (
                <Badge key={p.id} variant="destructive">
                  {p.name} (esgotado)
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Multi-Store Manager */}
      <MultiStoreManager />

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

        {/* Orders trend line chart */}
        <Card className="border-border">
          <CardHeader><CardTitle className="text-lg">Pedidos por Dia</CardTitle></CardHeader>
          <CardContent>
            {ordersByDay.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={ordersByDay}>
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="hsl(243 75% 59%)" strokeWidth={2} dot={{ r: 3 }} name="Pedidos" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">Nenhum pedido ainda</p>
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

        {/* Coupon Stats */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-lg">Conversão de Cupons</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-foreground">{couponStats.total}</p>
                <p className="text-xs text-muted-foreground">Total pedidos</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{couponStats.withCoupon}</p>
                <p className="text-xs text-muted-foreground">Com cupom</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(couponStats.totalDiscount)}</p>
                <p className="text-xs text-muted-foreground">Total descontos</p>
              </div>
            </div>
            {couponStats.total > 0 && (
              <div className="text-center">
                <Badge variant="secondary">
                  {((couponStats.withCoupon / couponStats.total) * 100).toFixed(1)}% de conversão
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Products */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Award className="h-5 w-5 text-amber-500" /> Produtos Mais Vendidos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {topProducts.length > 0 ? (
            <div className="space-y-3">
              {topProducts.map((p, i) => (
                <div key={p.name} className="flex items-center justify-between border-b border-border pb-2 last:border-0">
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-sm font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.quantity} unidades vendidas</p>
                    </div>
                  </div>
                  <p className="text-sm font-bold">{formatCurrency(p.revenue)}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">Sem dados de vendas ainda</p>
          )}
        </CardContent>
      </Card>

      {/* Filtered Orders */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-lg">Pedidos</CardTitle>
          <Tabs value={statusFilter} onValueChange={setStatusFilter} className="mt-2">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="todos">Todos</TabsTrigger>
              <TabsTrigger value="pendente">Pendente</TabsTrigger>
              <TabsTrigger value="processando">Processando</TabsTrigger>
              <TabsTrigger value="enviado">Enviado</TabsTrigger>
              <TabsTrigger value="entregue">Entregue</TabsTrigger>
              <TabsTrigger value="cancelado">Cancelado</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-muted-foreground">
              {filteredOrders.length} pedido{filteredOrders.length !== 1 ? "s" : ""}
              {statusFilter !== "todos" && ` com status "${statusFilter}"`}
            </p>
            <Badge variant="outline">{filteredOrders.reduce((s, o) => s + Number(o.total), 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</Badge>
          </div>
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
                    <Badge variant={o.status === "entregue" ? "default" : o.status === "cancelado" ? "destructive" : "secondary"} className="text-[10px]">
                      {o.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum pedido encontrado.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
