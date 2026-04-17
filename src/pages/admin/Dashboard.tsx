import { useMemo, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProducts } from "@/hooks/useProducts";
import { useOrders } from "@/hooks/useOrders";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Package, ShoppingCart, DollarSign, TrendingUp, Users, AlertTriangle, 
  Award, CreditCard, CheckCircle2, XCircle, BarChart3, Eye, Search, 
  Lock, Sparkles, ExternalLink, Calendar, Filter, Activity, Cpu, 
  Layers, Zap, RefreshCw, ChevronUp, ChevronDown
} from "lucide-react";
import { buildStoreUrl } from "@/lib/storeDomain";
import { useStoreSettings } from "@/hooks/useStoreSettings";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line, AreaChart, Area, CartesianGrid } from "recharts";
import { MultiStoreManager } from "@/components/MultiStoreManager";
import { TrialBanner } from "@/components/TrialBanner";
import { WelcomeTrialCard } from "@/components/WelcomeTrialCard";
import { useTenantContext } from "@/hooks/useTenantContext";
import { canAccess } from "@/lib/planPermissions";
import { useTranslation } from "@/i18n";
import { AITrainingAlert } from "@/components/admin/AITrainingAlert";
import { useRolePermissions } from "@/components/RoleGate";
import dashboardHeroBg from "@/assets/dashboard-hero-bg.png";

const COLORS = ["hsl(243 75% 59%)", "hsl(142 71% 45%)", "hsl(38 92% 50%)", "hsl(0 72% 51%)", "hsl(220 70% 55%)"];

interface LockedDashboardCardProps {
  children: ReactNode;
  locked: boolean;
  minPlan: "STARTER" | "PRO" | "PREMIUM";
  title: string;
  description: string;
}

function LockedDashboardCard({ children, locked, minPlan, title, description }: LockedDashboardCardProps) {
  if (!locked) return <>{children}</>;

  return (
    <div className="relative h-full overflow-hidden rounded-xl">
      <div className="pointer-events-none select-none opacity-45 blur-[3px] h-full">
        {children}
      </div>
      <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-background/82 p-4 backdrop-blur-sm">
        <div className="max-w-xs text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-primary/20 bg-primary/10">
            <Lock className="h-5 w-5 text-primary" />
          </div>
          <p className="text-sm font-semibold text-foreground">{title} bloqueado</p>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            {description} No plano <strong>{minPlan}</strong> isso é liberado para você parar de decidir no escuro e vender melhor.
          </p>
          <Button size="sm" className="mt-3" onClick={() => window.location.assign(`/admin/plano?upgrade=${minPlan}`)}>
            Fazer upgrade para {minPlan}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { isViewer, isAdmin, canViewMetrics } = useRolePermissions();
  const { slug } = useParams();
  const { user } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: settings } = useStoreSettings();
  const storeUrl = buildStoreUrl({
    slug: settings?.store_slug,
    customDomain: settings?.custom_domain,
    domainStatus: settings?.domain_status,
  });
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [timeRange, setTimeRange] = useState<string>("30d");
  const { ctx, effectiveId } = useTenantContext();
  const hasGateway = canAccess("gateway", ctx);
  const hasStarterAnalytics = canAccess("coupons", ctx);
  const hasProAnalytics = canAccess("restock_alerts", ctx);
  const hasPremiumAnalytics = canAccess("analytics_advanced", ctx);
  const hasAiTools = canAccess("ai_tools", ctx);

  // Optimized metrics fetch via RPC
  const { data: dashboardStats, isLoading: loadingStats } = useQuery({
    queryKey: ["dashboard_stats", effectiveId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_dashboard_stats", { p_user_id: effectiveId });
      if (error) throw error;
      return data as any;
    },
    enabled: !!effectiveId,
  });

  // Optimized rich insights fetch via RPC
  const { data: insights, isLoading: loadingInsights } = useQuery({
    queryKey: ["store_rich_insights", effectiveId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_store_rich_insights", { p_user_id: effectiveId });
      if (error) throw error;
      return data as any;
    },
    enabled: !!effectiveId && hasPremiumAnalytics,
  });

  const { data: aiConfig } = useQuery({
    queryKey: ["tenant-ai-brain-config", effectiveId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_ai_brain_config")
        .select("*")
        .eq("user_id", effectiveId)
        .maybeSingle();
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    enabled: !!effectiveId,
  });

  const { data: products } = useProducts();
  const { data: orders } = useOrders();

  const { data: payments } = useQuery({
    queryKey: ["dashboard_payments", effectiveId],
    queryFn: async () => {
      const { data, error } = await supabase.from("payments").select("*").eq("user_id", effectiveId).order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data;
    },
    enabled: !!effectiveId,
  });

  const { data: topSearches } = useQuery({
    queryKey: ["top_searches", effectiveId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("search_logs")
        .select("term")
        .eq("user_id", effectiveId);
      
      if (error) throw error;
      
      const counts: Record<string, number> = {};
      data.forEach(log => {
        counts[log.term] = (counts[log.term] || 0) + 1;
      });
      
      return Object.entries(counts)
        .map(([term, count]) => ({ term, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
    },
    enabled: !!effectiveId,
  });

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const metrics = useMemo(() => {
    if (!dashboardStats) return { totalProducts: 0, monthOrdersCount: 0, monthRevenue: 0, totalOrders: 0, revenueGrowth: 0, uniqueCustomers: 0, recurringCustomers: 0, lowStock: [], outOfStock: [] };
    
    return { 
      totalProducts: dashboardStats.total_products, 
      monthOrdersCount: dashboardStats.month_orders, 
      monthRevenue: dashboardStats.month_revenue, 
      totalOrders: dashboardStats.total_orders, 
      revenueGrowth: 0, // Simplified for performance
      uniqueCustomers: dashboardStats.unique_customers, 
      recurringCustomers: 0, // Simplified
      lowStock: products?.filter(p => p.stock <= 5 && p.stock > 0) || [], 
      outOfStock: products?.filter(p => p.stock === 0) || [] 
    };
  }, [dashboardStats, products]);

  const topProducts = useMemo(() => {
    return insights?.top_products?.map((p: any) => ({
      name: p.name,
      quantity: p.total_sold,
      revenue: 0 // Aggregated on server
    })) || [];
  }, [insights]);

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

  const kpiCards = [
    { label: "Produtos", value: String(metrics.totalProducts), icon: Layers, desc: "Ecossistema de itens", gradient: "from-blue-600/20 to-indigo-600/10", border: "border-blue-500/30", iconColor: "text-blue-400", locked: false, minPlan: "STARTER" as const, lockDescription: "" },
    ...(canViewMetrics ? [
      { label: "Pedidos do Mês", value: String(metrics.monthOrdersCount), icon: ShoppingCart, desc: `Fluxo: ${metrics.totalOrders} total`, gradient: "from-purple-600/20 to-pink-600/10", border: "border-purple-500/30", iconColor: "text-purple-400", locked: !hasStarterAnalytics, minPlan: "STARTER" as const, lockDescription: "Sem esse painel você não enxerga o ritmo real de vendas da sua loja." },
    ] : []),
    ...(hasGateway && canViewMetrics ? [
      { label: "Faturamento", value: formatCurrency(paymentMetrics.approvedRevenue), icon: DollarSign, desc: "Capital processado", gradient: "from-emerald-600/20 to-teal-600/10", border: "border-emerald-500/30", iconColor: "text-emerald-400", locked: false, minPlan: "STARTER" as const, lockDescription: "" },
      { label: "Eficiência/Ticket", value: formatCurrency(paymentMetrics.avgTicket), icon: TrendingUp, desc: "Média por conversão", gradient: "from-amber-600/20 to-orange-600/10", border: "border-amber-500/30", iconColor: "text-amber-400", locked: false, minPlan: "STARTER" as const, lockDescription: "" },
    ] : []),
    { label: "Base de Usuários", value: String(metrics.uniqueCustomers), icon: Users, desc: "Retenção de leads", gradient: "from-cyan-600/20 to-blue-600/10", border: "border-cyan-500/30", iconColor: "text-cyan-400", locked: !hasStarterAnalytics, minPlan: "STARTER" as const, lockDescription: "Sem isso você nem sabe quem volta, quem some e onde está perdendo recompra." },
    { label: "Nível de Estoque", value: String(metrics.lowStock.length), icon: Cpu, desc: `${metrics.outOfStock.length} itens críticos`, gradient: metrics.lowStock.length > 0 ? "from-red-600/20 to-rose-600/10" : "from-slate-600/20 to-slate-600/10", border: metrics.lowStock.length > 0 ? "border-red-500/30" : "border-slate-500/30", iconColor: metrics.lowStock.length > 0 ? "text-red-400" : "text-slate-400", locked: !hasProAnalytics, minPlan: "PRO" as const, lockDescription: "Sem alerta de estoque você descobre a perda de venda tarde demais." },
  ];

  return (
    <>
      {/* Fundo full-screen do dashboard - mobile e desktop */}
      <div
        className="fixed inset-0 -z-10 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${dashboardHeroBg})` }}
        aria-hidden="true"
      />
      <div className="fixed inset-0 -z-10 bg-background/80 backdrop-blur-sm" aria-hidden="true" />

      <div className="space-y-6 relative">
        <WelcomeTrialCard />

        {hasAiTools && (!aiConfig || !aiConfig.niche || !aiConfig.personality) && (
          <AITrainingAlert />
        )}

        {/* Header */}
        <div id="dashboard-header" className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-6 rounded-2xl border border-primary/10 shadow-lg bg-transparent backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/20 backdrop-blur-md rounded-xl border border-primary/20">
              <Activity className="h-6 w-6 text-primary animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                {t.dashboard.title}
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1.5 font-medium">
                <Zap className="h-3.5 w-3.5 text-amber-500" />
                Monitoramento em tempo real
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {loadingStats && <Badge variant="outline" className="animate-pulse text-xs bg-primary/10 border-primary/30 text-primary">{t.common.loading}</Badge>}

            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-[140px] bg-background/60 backdrop-blur-md border-primary/20 h-9 text-xs">
                <Calendar className="mr-2 h-3.5 w-3.5 text-primary" />
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Hoje</SelectItem>
                <SelectItem value="7d">Últimos 7 dias</SelectItem>
                <SelectItem value="30d">Últimos 30 dias</SelectItem>
                <SelectItem value="year">Este ano</SelectItem>
              </SelectContent>
            </Select>

            <Button size="sm" variant="outline" className="gap-2 border-primary/20 h-9 text-xs bg-background/60 backdrop-blur-md" asChild>
              <a href={storeUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
                Ver Minha Loja
              </a>
            </Button>

            <Button size="sm" className="gap-2 h-9 text-xs shadow-lg shadow-primary/20">
              <RefreshCw className="h-3.5 w-3.5" />
              Atualizar
            </Button>
          </div>
        </div>

      <div id="kpi-cards" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {kpiCards.map((s, idx) => {
          const card = (
            <Card key={s.label} className={`relative overflow-hidden ${s.border} bg-transparent backdrop-blur-sm shadow-xl hover:shadow-2xl transition-all duration-300 h-full group`}>
              {/* Subtle background glow */}
              <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full blur-3xl opacity-20 bg-gradient-to-br ${s.gradient}`} />
              
              <CardHeader className="flex flex-row items-center justify-between pb-2 z-10">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">{s.label}</CardTitle>
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-background/50 border border-primary/5 shadow-inner transition-transform duration-500 group-hover:rotate-[360deg]`}>
                  <s.icon className={`h-5 w-5 ${s.iconColor}`} />
                </div>
              </CardHeader>
              <CardContent className="z-10 relative">
                <div className="flex items-baseline gap-1">
                  <div className="text-3xl font-black text-foreground tracking-tighter tabular-nums drop-shadow-sm">{s.value}</div>
                  {idx === 2 && <ChevronUp className="h-4 w-4 text-emerald-500" />}
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <div className="h-1 w-12 rounded-full bg-primary/20 overflow-hidden">
                    <div className="h-full bg-primary animate-progress-line" style={{ width: '60%' }} />
                  </div>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-tight">{s.desc}</p>
                </div>
              </CardContent>
            </Card>
          );

          return s.locked ? (
            <LockedDashboardCard
              key={s.label}
              locked={s.locked}
              minPlan={s.minPlan}
              title={s.label}
              description={s.lockDescription}
            >
              {card}
            </LockedDashboardCard>
          ) : card;
        })}
      </div>

      {/* Payment Summary - only for plans with gateway and admins */}
      {hasGateway && canViewMetrics && (
        <div className="grid gap-4 sm:grid-cols-4">
          <Card className="border-emerald-500/20 bg-transparent backdrop-blur-sm shadow-sm transition-all hover:bg-emerald-500/10">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-emerald-500/10 rounded-lg">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Aprovados</span>
                </div>
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <p className="text-2xl font-black text-emerald-500 mt-1 tabular-nums">{paymentMetrics.approved}</p>
            </CardContent>
          </Card>
          
          <Card className="border-amber-500/20 bg-transparent backdrop-blur-sm shadow-sm transition-all hover:bg-amber-500/10">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-amber-500/10 rounded-lg">
                    <CreditCard className="h-4 w-4 text-amber-500" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Pendentes</span>
                </div>
                <div className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
              </div>
              <p className="text-2xl font-black text-amber-500 mt-1 tabular-nums">{paymentMetrics.pending}</p>
            </CardContent>
          </Card>
          
          <Card className="border-rose-500/20 bg-transparent backdrop-blur-sm shadow-sm transition-all hover:bg-rose-500/10">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-rose-500/10 rounded-lg">
                    <XCircle className="h-4 w-4 text-rose-500" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Falhas</span>
                </div>
              </div>
              <p className="text-2xl font-black text-rose-500 mt-1 tabular-nums">{paymentMetrics.rejected}</p>
            </CardContent>
          </Card>
          
          <Card className="border-primary/10 bg-transparent backdrop-blur-sm shadow-sm overflow-hidden relative">
            <div className="absolute top-0 right-0 p-1 opacity-20">
              <Layers className="h-12 w-12 text-primary rotate-12" />
            </div>
            <CardContent className="p-4 relative z-10">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Distribuição</p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="text-[10px] px-1.5 bg-background/50 border-emerald-500/20 text-emerald-500">PIX: {paymentMetrics.byMethod.pix}</Badge>
                <Badge variant="outline" className="text-[10px] px-1.5 bg-background/50 border-blue-500/20 text-blue-500">CARD: {paymentMetrics.byMethod.credit_card}</Badge>
                <Badge variant="outline" className="text-[10px] px-1.5 bg-background/50 border-slate-500/20 text-slate-400">BOL: {paymentMetrics.byMethod.boleto}</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Low stock - clickable cards */}
      {(metrics.lowStock.length > 0 || metrics.outOfStock.length > 0 || !hasProAnalytics) && (
        <LockedDashboardCard
          locked={!hasProAnalytics}
          minPlan="PRO"
          title="Alerta de Estoque"
          description="Você continua correndo risco de anunciar produto sem saldo e perder pedido bom por falta de aviso."
        >
          <Card className="border-amber-500/30 bg-transparent backdrop-blur-sm shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-medium text-amber-700 dark:text-amber-400">Alerta de Estoque</span>
                <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground animate-pulse leading-none">Novo</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {metrics.outOfStock.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => navigate(`/painel/${slug}/produtos`, { state: { editProductId: p.id } })}
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
                    onClick={() => navigate(`/painel/${slug}/produtos`, { state: { editProductId: p.id } })}
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
                {metrics.lowStock.length === 0 && metrics.outOfStock.length === 0 && (
                  <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                    Nenhum alerta crítico no momento.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </LockedDashboardCard>
      )}

      <MultiStoreManager />

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-primary/10 bg-transparent backdrop-blur-md shadow-lg">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                Performance de Receita
              </CardTitle>
              <Badge variant="outline" className="text-[10px] bg-primary/5">30 DIAS</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {revenueByDay.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={revenueByDay}>
                  <defs>
                    <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--primary)/0.05)" />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => `R$${v}`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--primary)/0.2)', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    formatter={(v: number) => [formatCurrency(v), "Faturamento"]} 
                  />
                  <Area type="monotone" dataKey="total" stroke="hsl(var(--primary))" fill="url(#revenueGrad)" strokeWidth={3} />
                </AreaChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-muted-foreground py-12 text-center italic">Aguardando dados de transação...</p>}
          </CardContent>
        </Card>

        <LockedDashboardCard
          locked={!hasPremiumAnalytics}
          minPlan="PREMIUM"
          title="Pedidos por Dia"
          description="Sem esse gráfico você vende sem ritmo, reage tarde e deixa tendência passar batida."
        >
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
        </LockedDashboardCard>

        <LockedDashboardCard
          locked={!hasPremiumAnalytics}
          minPlan="PREMIUM"
          title="Status dos Pedidos"
          description="Sem essa leitura você só descobre gargalo quando o cliente já está impaciente ou foi embora."
        >
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
        </LockedDashboardCard>

        {hasStarterAnalytics && (
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
        )}
      </div>

      {/* Insights Section */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Top Mais Vendidos */}
        <LockedDashboardCard
          locked={!hasPremiumAnalytics}
          minPlan="PREMIUM"
          title="Top Vendidos"
          description="Sem essa lista você insiste no produto errado e deixa de empurrar o que realmente gira caixa."
        >
          <Card className="border-border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Award className="h-4 w-4 text-amber-500" /> Top Vendidos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {topProducts.length > 0 ? (
                <div className="space-y-2">
                  {topProducts.map((p, i) => (
                    <div key={p.name} className="flex items-center justify-between rounded-lg border border-border/50 p-2 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">{i + 1}</span>
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate">{p.name}</p>
                          <p className="text-[10px] text-muted-foreground">{p.quantity} vendidos</p>
                        </div>
                      </div>
                      <p className="text-xs font-bold shrink-0">{formatCurrency(p.revenue)}</p>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-muted-foreground text-center py-4">Sem vendas</p>}
            </CardContent>
          </Card>
        </LockedDashboardCard>

        {/* Top Mais Visitados */}
        <LockedDashboardCard
          locked={!hasPremiumAnalytics}
          minPlan="PREMIUM"
          title="Top Visitados"
          description="Sem essa visão você não sabe onde existe interesse real e perde chance de converter o tráfego certo."
        >
          <Card className="border-border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Eye className="h-4 w-4 text-blue-500" /> Top Visitados
              </CardTitle>
            </CardHeader>
            <CardContent>
              {mostViewedProducts.length > 0 ? (
                <div className="space-y-2">
                  {mostViewedProducts.map((p, i) => (
                    <div key={p.id} className="flex items-center justify-between rounded-lg border border-border/50 p-2 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-[10px] font-bold text-blue-500">{i + 1}</span>
                        <div className="flex items-center gap-2 min-w-0">
                          {p.image_url && (
                            <img src={p.image_url} alt="" className="h-6 w-6 rounded object-cover flex-shrink-0" />
                          )}
                          <div className="min-w-0">
                            <p className="text-xs font-medium truncate">{p.name}</p>
                            <p className="text-[10px] text-muted-foreground">{p.views || 0} visitas</p>
                          </div>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => navigate(`/painel/${slug}/produtos`, { state: { editProductId: p.id } })}>
                        <TrendingUp className="h-3 w-3 text-muted-foreground" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-muted-foreground text-center py-4">Sem visitas</p>}
            </CardContent>
          </Card>
        </LockedDashboardCard>

        {/* Top Termos Pesquisados */}
        {hasPremiumAnalytics && <Card className="border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Search className="h-4 w-4 text-purple-500" /> Top Buscas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topSearches && topSearches.length > 0 ? (
              <div className="space-y-2">
                {topSearches.map((s, i) => (
                  <div key={s.term} className="flex items-center justify-between rounded-lg border border-border/50 p-2 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-purple-500/10 text-[10px] font-bold text-purple-500">{i + 1}</span>
                      <p className="text-xs font-medium capitalize truncate">{s.term}</p>
                    </div>
                    <Badge variant="secondary" className="text-[10px] px-1.5 h-4">{s.count}x</Badge>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground text-center py-4">Sem buscas</p>}
          </CardContent>
        </Card>}
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
    </>
  );
}
