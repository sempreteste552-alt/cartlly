import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Eye, ShoppingCart, CreditCard, TrendingUp, ArrowDown, Users, MousePointerClick } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, FunnelChart, Funnel, LabelList, Cell } from "recharts";
import { useMemo } from "react";

const COLORS = ["hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))"];

export default function Analytics() {
  const { user } = useAuth();

  const { data: events, isLoading } = useQuery({
    queryKey: ["funnel_analytics", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data, error } = await supabase
        .from("customer_behavior_events")
        .select("event_type, created_at, session_id, customer_id, product_id")
        .eq("user_id", user!.id)
        .gte("created_at", thirtyDaysAgo.toISOString())
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  const { data: orders } = useQuery({
    queryKey: ["funnel_orders", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data, error } = await supabase
        .from("orders")
        .select("id, total, created_at, status")
        .eq("user_id", user!.id)
        .gte("created_at", thirtyDaysAgo.toISOString());

      if (error) throw error;
      return data || [];
    },
  });

  const funnelData = useMemo(() => {
    if (!events) return [];

    const sessions = new Set(events.map(e => e.session_id).filter(Boolean));
    const views = events.filter(e => e.event_type === "product_view");
    const carts = events.filter(e => e.event_type === "add_to_cart");
    const checkouts = events.filter(e => e.event_type === "cart_checkout_start");
    const purchases = orders?.length || 0;

    return [
      { name: "Visitantes", value: sessions.size, icon: "👁️", fill: COLORS[0] },
      { name: "Viram Produto", value: new Set(views.map(e => e.session_id)).size, icon: "🛍️", fill: COLORS[1] },
      { name: "Add ao Carrinho", value: new Set(carts.map(e => e.session_id)).size, icon: "🛒", fill: COLORS[2] },
      { name: "Compraram", value: purchases, icon: "💰", fill: COLORS[3] },
    ];
  }, [events, orders]);

  const conversionRate = useMemo(() => {
    if (!funnelData.length || funnelData[0].value === 0) return 0;
    return ((funnelData[3]?.value || 0) / funnelData[0].value * 100).toFixed(1);
  }, [funnelData]);

  const dailyData = useMemo(() => {
    if (!events) return [];

    const days: Record<string, { views: number; carts: number; purchases: number }> = {};
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d.toISOString().slice(0, 10);
    });

    last7Days.forEach(day => {
      days[day] = { views: 0, carts: 0, purchases: 0 };
    });

    events.forEach(e => {
      const day = e.created_at.slice(0, 10);
      if (days[day]) {
        if (e.event_type === "product_view") days[day].views++;
        if (e.event_type === "add_to_cart") days[day].carts++;
      }
    });

    orders?.forEach(o => {
      const day = o.created_at.slice(0, 10);
      if (days[day]) days[day].purchases++;
    });

    return last7Days.map(day => ({
      day: day.slice(5).replace("-", "/"),
      Visualizações: days[day].views,
      Carrinhos: days[day].carts,
      Compras: days[day].purchases,
    }));
  }, [events, orders]);

  const topProducts = useMemo(() => {
    if (!events) return [];
    const counts: Record<string, { views: number; carts: number; id: string }> = {};
    events.forEach(e => {
      if (!e.product_id) return;
      if (!counts[e.product_id]) counts[e.product_id] = { views: 0, carts: 0, id: e.product_id };
      if (e.event_type === "product_view") counts[e.product_id].views++;
      if (e.event_type === "add_to_cart") counts[e.product_id].carts++;
    });
    return Object.values(counts)
      .sort((a, b) => b.views - a.views)
      .slice(0, 5);
  }, [events]);

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <Skeleton className="h-8 w-60" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">📊 Analytics de Funil</h1>
          <p className="text-sm text-muted-foreground">Últimos 30 dias — veja onde seus clientes param</p>
        </div>
        <Badge variant="secondary" className="gap-1">
          <TrendingUp className="h-3 w-3" />
          {conversionRate}% conversão
        </Badge>
      </div>

      {/* Funnel Steps */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {funnelData.map((step, i) => {
          const prevValue = i > 0 ? funnelData[i - 1].value : step.value;
          const dropoff = prevValue > 0 ? ((1 - step.value / prevValue) * 100).toFixed(0) : "0";
          return (
            <Card key={step.name} className="relative overflow-hidden">
              <div className="absolute inset-0 opacity-10" style={{ backgroundColor: step.fill }} />
              <CardContent className="p-4 relative">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <span className="text-lg">{step.icon}</span> {step.name}
                </p>
                <p className="text-2xl font-bold mt-1" style={{ color: step.fill }}>{step.value}</p>
                {i > 0 && (
                  <div className="flex items-center gap-1 mt-1">
                    <ArrowDown className="h-3 w-3 text-destructive" />
                    <span className="text-xs text-destructive font-medium">-{dropoff}%</span>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Funnel Visualization */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MousePointerClick className="h-4 w-4 text-primary" />
            Funil de Conversão
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="w-full space-y-2">
            {funnelData.map((step, i) => {
              const maxVal = funnelData[0]?.value || 1;
              const widthPct = Math.max(10, (step.value / maxVal) * 100);
              return (
                <div key={step.name} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-28 text-right shrink-0">{step.name}</span>
                  <div className="flex-1 h-10 rounded-lg overflow-hidden bg-muted/50 relative">
                    <div
                      className="h-full rounded-lg flex items-center justify-end pr-3 transition-all duration-700 ease-out"
                      style={{ width: `${widthPct}%`, backgroundColor: step.fill }}
                    >
                      <span className="text-xs font-bold text-white drop-shadow">{step.value}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Daily Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Últimos 7 dias</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="Visualizações" fill={COLORS[0]} radius={[4, 4, 0, 0]} />
              <Bar dataKey="Carrinhos" fill={COLORS[2]} radius={[4, 4, 0, 0]} />
              <Bar dataKey="Compras" fill={COLORS[3]} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Empty State */}
      {funnelData[0]?.value === 0 && (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <h3 className="font-semibold text-foreground">Sem dados ainda</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Os dados aparecerão aqui quando clientes visitarem sua loja. Compartilhe o link para começar!
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
