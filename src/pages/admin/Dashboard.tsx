import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProducts } from "@/hooks/useProducts";
import { useOrders } from "@/hooks/useOrders";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, ShoppingCart, DollarSign, TrendingUp, Users, AlertTriangle, Award, CreditCard, CheckCircle2, XCircle, BarChart3 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line, AreaChart, Area } from "recharts";
import { MultiStoreManager } from "@/components/MultiStoreManager";
import { TrialBanner } from "@/components/TrialBanner";
import { WelcomeTrialCard } from "@/components/WelcomeTrialCard";

const COLORS = ["hsl(243 75% 59%)", "hsl(142 71% 45%)", "hsl(38 92% 50%)", "hsl(0 72% 51%)", "hsl(220 70% 55%)"];

export default function Dashboard() {
  const { data: products } = useProducts();
  const { data: orders } = useOrders();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>("todos");

  const { data: allOrderItems } = useQuery({
    queryKey: ["all_order_items", user?.id],
    queryFn: async () => {
      const orderIds = orders?.map((o) => o.id) ?? [];
      if (orderIds.length === 0) return [];
      const { data, error } = await supabase.from("order_items").select("*").in("order_id", orderIds);
      if (error) throw error;
      return data;
    },
    enabled: !!orders && orders.length > 0,
  });

  const { data: payments } = useQuery({
    queryKey: ["dashboard_payments", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("payments").select("*").eq("user_id", user!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
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
    const uniqueCustomers = new Set(orders?.map((o) => o.customer_email || o.customer_phone || o.customer_name)).size;
    const customerCounts: Record<string, number> = {};
    orders?.forEach((o) => {
      const key = o.customer_email || o.customer_phone || o.customer_name;
      customerCounts[key] = (customerCounts[key] || 0) + 1;
    });
    const recurringCustomers = Object.values(customerCounts).filter((c) => c >= 2).length;
    const lowStock = products?.filter((p) => p.stock <= 5 && p.stock > 0) ?? [];
    const outOfStock = products?.filter((p) => p.stock === 0) ?? [];
    return { totalProducts, monthOrdersCount: monthOrders.length, monthRevenue, totalOrders, revenueGrowth, uniqueCustomers, recurringCustomers, lowStock, outOfStock };
  }, [products, orders, startOfMonth, prevMonthStart, prevMonthEnd]);

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

  const mostViewedProducts = useMemo(() => {
    if (!products) return [];
    return [...products]
      .sort((a, b) => (b.views || 0) - (a.views || 0))
      .filter(p => (p.views || 0) > 0)
      .slice(0, 5);
  }, [products]);

  const revenueByDay = useMemo(() => {
    if (!orders) return [];
    const days: Record<string, number> = {};
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    orders.filter((o) => new Date(o.created_at) >= thirtyDaysAgo).forEach((o) => {
      const day = new Date(o.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      days[day] = (days[day] || 0) + Number(o.total);
    });
    return Object.entries(days).map(([day, total]) => ({ day, total })).slice(-15);
  }, [orders]);

  const ordersByDay = useMemo(() => {
    if (!orders) return [];
    const days: Record<string, number> = {};
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    orders.filter((o) => new Date(o.created_at) >= thirtyDaysAgo).forEach((o) => {
      const day = new Date(o.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      days[day] = (days[day] || 0) + 1;
    });
    return Object.entries(days).map(([day, count]) => ({ day, count })).slice(-15);
  }, [orders]);

  const ordersByStatus = useMemo(() => {
    if (!orders) return [];
    const counts: Record<string, number> = {};
    orders.forEach((o) => { counts[o.status] = (counts[o.status] || 0) + 1; });
    const labels: Record<string, string> = { pendente: "Pendente", processando: "Processando", enviado: "Enviado", entregue: "Entregue", cancelado: "Cancelado" };
    return Object.entries(counts).map(([status, count]) => ({ name: labels[status] || status, value: count }));
  }, [orders]);

  const couponStats = useMemo(() => {
    if (!orders) return { total: 0, withCoupon: 0, totalDiscount: 0 };
    const withCoupon = orders.filter((o) => o.coupon_code);
    return { total: orders.length, withCoupon: withCoupon.length, totalDiscount: withCoupon.reduce((s, o) => s + Number(o.discount_amount), 0) };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    if (statusFilter === "todos") return orders;
    return orders.filter((o) => o.status === statusFilter);
  }, [orders, statusFilter]);

  const recentOrders = filteredOrders.slice(0, 10);

  const paymentMetrics = useMemo(() => {
    const all = payments ?? [];
    const approved = all.filter((p) => p.status === "approved" || p.status === "paid");
    const rejected = all.filter((p) => ["rejected", "refused", "cancelled"].includes(p.status));
    const pending = all.filter((p) => p.status === "pending");
    const approvedRevenue = approved.reduce((s, p) => s + Number(p.amount), 0);
    const avgTicket = approved.length > 0 ? approvedRevenue / approved.length : 0;
    return {
      approved: approved.length, rejected: rejected.length, pending: pending.length,
      approvedRevenue, avgTicket,
      byMethod: {
        pix: all.filter((p) => p.method === "pix").length,
        credit_card: all.filter((p) => p.method === "credit_card").length,
        boleto: all.filter((p) => p.method === "boleto").length,
      },
    };
  }, [payments]);

  return (
    <div className="space-y-6">
      <WelcomeTrialCard />

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-primary" /> Dashboard
        </h1>
        <p className="text-sm text-muted-foreground">Visão geral da sua loja</p>
      </div>

      {/* KPI Cards - Premium gradient style */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { label: "Produtos", value: String(metrics.totalProducts), icon: Package, desc: "Total cadastrados", gradient: "from-blue-500/10 to-blue-500/5", border: "border-blue-500/20", iconColor: "text-blue-500" },
          { label: "Pedidos do Mês", value: String(metrics.monthOrdersCount), icon: ShoppingCart, desc: `de ${metrics.totalOrders} total`, gradient: "from-purple-500/10 to-purple-500/5", border: "border-purple-500/20", iconColor: "text-purple-500" },
          { label: "Receita Aprovada", value: formatCurrency(paymentMetrics.approvedRevenue), icon: DollarSign, desc: `${paymentMetrics.approved} pagamentos`, gradient: "from-green-500/10 to-green-500/5", border: "border-green-500/20", iconColor: "text-green-500" },
          { label: "Ticket Médio", value: formatCurrency(paymentMetrics.avgTicket), icon: TrendingUp, desc: "Apenas aprovados", gradient: "from-amber-500/10 to-amber-500/5", border: "border-amber-500/20", iconColor: "text-amber-500" },
          { label: "Clientes Únicos", value: String(metrics.uniqueCustomers), icon: Users, desc: `${metrics.recurringCustomers} recorrentes`, gradient: "from-cyan-500/10 to-cyan-500/5", border: "border-cyan-500/20", iconColor: "text-cyan-500" },
          { label: "Estoque Baixo", value: String(metrics.lowStock.length), icon: AlertTriangle, desc: `${metrics.outOfStock.length} esgotados`, gradient: metrics.lowStock.length > 0 ? "from-red-500/10 to-red-500/5" : "from-muted/50 to-muted/30", border: metrics.lowStock.length > 0 ? "border-red-500/20" : "border-border", iconColor: metrics.lowStock.length > 0 ? "text-red-500" : "text-muted-foreground" },
        ].map((s) => (
          <Card key={s.label} className={`${s.border} bg-gradient-to-br ${s.gradient} shadow-sm hover:shadow-md transition-shadow`}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-background/80 shadow-sm`}>
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

      {/* Payment Summary - Compact */}
      <div className="grid gap-3 sm:grid-cols-4">
        <Card className="border-green-500/20 bg-gradient-to-br from-green-500/10 to-transparent shadow-sm">
          <CardContent className="p-3">
            <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-600" /><span className="text-xs text-muted-foreground">Aprovados</span></div>
            <p className="text-xl font-bold text-green-600 mt-1">{paymentMetrics.approved}</p>
          </CardContent>
        </Card>
        <Card className="border-yellow-500/20 bg-gradient-to-br from-yellow-500/10 to-transparent shadow-sm">
          <CardContent className="p-3">
            <div className="flex items-center gap-2"><CreditCard className="h-4 w-4 text-yellow-600" /><span className="text-xs text-muted-foreground">Pendentes</span></div>
            <p className="text-xl font-bold text-yellow-600 mt-1">{paymentMetrics.pending}</p>
          </CardContent>
        </Card>
        <Card className="border-red-500/20 bg-gradient-to-br from-red-500/10 to-transparent shadow-sm">
          <CardContent className="p-3">
            <div className="flex items-center gap-2"><XCircle className="h-4 w-4 text-red-600" /><span className="text-xs text-muted-foreground">Recusados</span></div>
            <p className="text-xl font-bold text-red-600 mt-1">{paymentMetrics.rejected}</p>
          </CardContent>
        </Card>
        <Card className="border-border shadow-sm">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground mb-1">Por Método</p>
            <div className="flex gap-2 text-xs">
              <Badge variant="outline" className="text-[10px] px-1.5">💰 {paymentMetrics.byMethod.pix}</Badge>
              <Badge variant="outline" className="text-[10px] px-1.5">💳 {paymentMetrics.byMethod.credit_card}</Badge>
              <Badge variant="outline" className="text-[10px] px-1.5">📄 {paymentMetrics.byMethod.boleto}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Low stock - clickable cards */}
      {(metrics.lowStock.length > 0 || metrics.outOfStock.length > 0) && (
        <Card className="border-amber-500/30 bg-gradient-to-r from-amber-500/10 to-transparent shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-medium text-amber-700 dark:text-amber-400">Alerta de Estoque</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {metrics.outOfStock.map((p) => (
                <button
                  key={p.id}
                  onClick={() => navigate("/admin/produtos", { state: { editProductId: p.id } })}
                  className="flex items-center gap-3 p-3 rounded-lg border border-red-500/30 bg-red-500/5 hover:bg-red-500/10 transition-colors text-left w-full"
                >
                  {p.image_url ? (
                    <img src={p.image_url} alt="" className="h-10 w-10 rounded object-cover flex-shrink-0" />
                  ) : (
                    <div className="h-10 w-10 rounded bg-red-500/10 flex items-center justify-center flex-shrink-0">
                      <Package className="h-5 w-5 text-red-500" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate text-foreground">{p.name}</p>
                    <p className="text-xs text-red-600 font-semibold">🚨 Esgotado</p>
                  </div>
                </button>
              ))}
              {metrics.lowStock.map((p) => (
                <button
                  key={p.id}
                  onClick={() => navigate("/admin/produtos", { state: { editProductId: p.id } })}
                  className="flex items-center gap-3 p-3 rounded-lg border border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 transition-colors text-left w-full"
                >
                  {p.image_url ? (
                    <img src={p.image_url} alt="" className="h-10 w-10 rounded object-cover flex-shrink-0" />
                  ) : (
                    <div className="h-10 w-10 rounded bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                      <Package className="h-5 w-5 text-amber-500" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate text-foreground">{p.name}</p>
                    <p className="text-xs text-amber-600 font-semibold">⚠️ {p.stock} restantes</p>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <MultiStoreManager />

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Receita (30 dias)</CardTitle></CardHeader>
          <CardContent>
            {revenueByDay.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={revenueByDay}>
                  <defs>
                    <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(243 75% 59%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(243 75% 59%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `R$${v}`} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Area type="monotone" dataKey="total" stroke="hsl(243 75% 59%)" fill="url(#revenueGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-muted-foreground py-8 text-center">Sem dados</p>}
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Pedidos por Dia</CardTitle></CardHeader>
          <CardContent>
            {ordersByDay.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={ordersByDay}>
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="hsl(142 71% 45%)" strokeWidth={2} dot={{ r: 3 }} name="Pedidos" />
                </LineChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-muted-foreground py-8 text-center">Sem dados</p>}
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Status dos Pedidos</CardTitle></CardHeader>
          <CardContent>
            {ordersByStatus.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={ordersByStatus}
                    cx="50%"
                    cy="45%"
                    innerRadius={50}
                    outerRadius={80}
                    dataKey="value"
                    label={false}
                  >
                    {ordersByStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Legend
                    layout="horizontal"
                    verticalAlign="bottom"
                    align="center"
                    wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                    formatter={(value: string, entry: any) => `${value}: ${entry.payload?.value ?? ''}`}
                  />
                  <Tooltip formatter={(v: number, name: string) => [v, name]} />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-muted-foreground py-8 text-center">Sem dados</p>}
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Cupons</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xl font-bold text-foreground">{couponStats.total}</p>
                <p className="text-[10px] text-muted-foreground">Pedidos</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xl font-bold text-foreground">{couponStats.withCoupon}</p>
                <p className="text-[10px] text-muted-foreground">Com cupom</p>
              </div>
              <div className="p-3 rounded-lg bg-green-500/10">
                <p className="text-xl font-bold text-green-600">{formatCurrency(couponStats.totalDiscount)}</p>
                <p className="text-[10px] text-muted-foreground">Descontos</p>
              </div>
            </div>
            {couponStats.total > 0 && (
              <div className="text-center mt-3">
                <Badge variant="secondary">{((couponStats.withCoupon / couponStats.total) * 100).toFixed(1)}% conversão</Badge>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Products & Most Viewed */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Award className="h-4 w-4 text-amber-500" /> Top 5 Mais Vendidos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topProducts.length > 0 ? (
              <div className="space-y-2">
                {topProducts.map((p, i) => (
                  <div key={p.name} className="flex items-center justify-between rounded-lg border border-border/50 p-2.5 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{i + 1}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.quantity} vendidos</p>
                      </div>
                    </div>
                    <p className="text-sm font-bold shrink-0">{formatCurrency(p.revenue)}</p>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground text-center py-4">Sem vendas</p>}
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Eye className="h-4 w-4 text-blue-500" /> Top 5 Mais Visitados
            </CardTitle>
          </CardHeader>
          <CardContent>
            {mostViewedProducts.length > 0 ? (
              <div className="space-y-2">
                {mostViewedProducts.map((p, i) => (
                  <div key={p.id} className="flex items-center justify-between rounded-lg border border-border/50 p-2.5 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-500/10 text-xs font-bold text-blue-500">{i + 1}</span>
                      <div className="flex items-center gap-2 min-w-0">
                        {p.image_url && (
                          <img src={p.image_url} alt="" className="h-8 w-8 rounded object-cover flex-shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{p.name}</p>
                          <p className="text-xs text-muted-foreground">{p.views || 0} visualizações</p>
                        </div>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => navigate("/admin/produtos", { state: { editProductId: p.id } })}>
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground text-center py-4">Sem visualizações</p>}
          </CardContent>
        </Card>
      </div>

      {/* Recent Orders */}
      <Card className="border-border shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Pedidos Recentes</CardTitle>
          <Tabs value={statusFilter} onValueChange={setStatusFilter} className="mt-2">
            <TabsList className="h-8">
              {[
                { key: "todos", label: "Todos" },
                { key: "pendente", label: "Pendente" },
                { key: "processando", label: "Process." },
                { key: "enviado", label: "Enviado" },
                { key: "entregue", label: "Entregue" },
                { key: "cancelado", label: "Cancelado" },
              ].map((t) => (
                <TabsTrigger key={t.key} value={t.key} className="text-xs px-2 h-7">{t.label}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-muted-foreground">{filteredOrders.length} pedido(s)</p>
            <Badge variant="outline" className="text-xs">{formatCurrency(filteredOrders.reduce((s, o) => s + Number(o.total), 0))}</Badge>
          </div>
          {recentOrders.length > 0 ? (
            <div className="space-y-1.5">
              {recentOrders.map((o) => (
                <div key={o.id} className="flex items-center justify-between rounded-lg border border-border/50 p-2.5 hover:bg-muted/30 transition-colors">
                  <div>
                    <p className="text-sm font-medium">{o.customer_name}</p>
                    <p className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleDateString("pt-BR")}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">{formatCurrency(Number(o.total))}</p>
                    <Badge variant={o.status === "entregue" ? "default" : o.status === "cancelado" ? "destructive" : "secondary"} className="text-[10px]">{o.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-muted-foreground text-center py-4">Nenhum pedido</p>}
        </CardContent>
      </Card>
    </div>
  );
}
