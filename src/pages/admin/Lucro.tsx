import { RoleGate, useRolePermissions } from "@/components/RoleGate";
import { PlanGate } from "@/components/PlanGate";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DollarSign, Loader2, AlertTriangle } from "lucide-react";
import { useProducts } from "@/hooks/useProducts";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const COLORS = ["hsl(142 71% 45%)", "hsl(38 92% 50%)", "hsl(0 72% 51%)", "hsl(220 70% 55%)"];

export default function Lucro() {
  const { user } = useAuth();
  const { canViewMetrics } = useRolePermissions();
  const { data: products, isLoading: loadingProducts } = useProducts();

  // Fetch orders with items for profit calculation
  const { data: ordersWithItems, isLoading: loadingOrders } = useQuery({
    queryKey: ["orders_with_items_profit", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: orders, error } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .eq("user_id", user!.id);
      if (error) throw error;
      return orders || [];
    },
  });

  const orders = ordersWithItems;

  const analysis = useMemo(() => {
    if (!products || !orders) return null;

    const productMap = new Map(products.map((p) => [p.id, p]));

    let totalRevenue = 0;
    let totalCost = 0;
    let totalShipping = 0;
    const productProfit: Record<string, { name: string; revenue: number; cost: number; profit: number; qty: number }> = {};

    const completedOrders = orders.filter((o) => o.status !== "cancelado");

    completedOrders.forEach((order) => {
      totalRevenue += Number(order.total || 0);
      totalShipping += Number(order.shipping_cost || 0);

      order.order_items?.forEach((item: any) => {
        const product = productMap.get(item.product_id);
        const costPrice = Number((product as any)?.cost_price || 0);
        const itemRevenue = Number(item.unit_price) * Number(item.quantity);
        const itemCost = costPrice * Number(item.quantity);

        if (!productProfit[item.product_id]) {
          productProfit[item.product_id] = {
            name: item.product_name || product?.name || "Produto",
            revenue: 0,
            cost: 0,
            profit: 0,
            qty: 0,
          };
        }
        productProfit[item.product_id].revenue += itemRevenue;
        productProfit[item.product_id].cost += itemCost;
        productProfit[item.product_id].profit += itemRevenue - itemCost;
        productProfit[item.product_id].qty += Number(item.quantity);

        totalCost += itemCost;
      });
    });

    const totalProfit = totalRevenue - totalCost;
    const margin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    const topProducts = Object.values(productProfit)
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 10);

    const noCostProducts = products.filter((p) => !Number((p as any).cost_price));

    return { totalRevenue, totalCost, totalShipping, totalProfit, margin, topProducts, noCostProducts, orderCount: completedOrders.length };
  }, [products, orders]);

  if (loadingProducts || loadingOrders) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!analysis) return null;

  return (
    <RoleGate allowedRoles={["owner", "admin"]}>
      <PlanGate feature="profit_reports">
        <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <DollarSign className="h-6 w-6 text-primary" />
          Dashboard de Lucro Real
        </h1>
        <p className="text-muted-foreground">Análise de lucro com base no custo dos produtos</p>
      </div>

      {analysis.noCostProducts.length > 0 && (
        <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium">
              {analysis.noCostProducts.length} produto(s) sem preço de custo
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Cadastre o custo em Produtos → Editar para análise precisa. Produtos: {analysis.noCostProducts.slice(0, 5).map(p => p.name).join(", ")}
              {analysis.noCostProducts.length > 5 && ` e mais ${analysis.noCostProducts.length - 5}`}
            </p>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Faturamento</p>
            <p className="text-xl font-bold text-foreground">
              R${analysis.totalRevenue.toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground">{analysis.orderCount} pedidos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Custo Total</p>
            <p className="text-xl font-bold text-red-500">
              R${analysis.totalCost.toFixed(2)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Lucro Líquido</p>
            <p className={`text-xl font-bold ${analysis.totalProfit >= 0 ? "text-green-500" : "text-red-500"}`}>
              R${analysis.totalProfit.toFixed(2)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Margem</p>
            <p className={`text-xl font-bold ${analysis.margin >= 30 ? "text-green-500" : analysis.margin >= 15 ? "text-yellow-500" : "text-red-500"}`}>
              {analysis.margin.toFixed(1)}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Lucro por Produto (Top 10)</CardTitle>
          </CardHeader>
          <CardContent>
            {analysis.topProducts.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analysis.topProducts} layout="vertical">
                  <XAxis type="number" tickFormatter={(v) => `R$${v}`} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => `R$${v.toFixed(2)}`} />
                  <Bar dataKey="profit" fill="hsl(142 71% 45%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground text-sm py-8 text-center">Nenhum dado de vendas ainda</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Composição do Faturamento</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={[
                    { name: "Lucro", value: Math.max(0, analysis.totalProfit) },
                    { name: "Custos", value: analysis.totalCost },
                    { name: "Frete", value: analysis.totalShipping },
                  ]}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {[0, 1, 2].map((i) => (
                    <Cell key={i} fill={COLORS[i]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => `R$${v.toFixed(2)}`} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Product table */}
      {analysis.topProducts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Detalhamento por Produto</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Qtd</TableHead>
                  <TableHead className="text-right">Receita</TableHead>
                  <TableHead className="text-right">Custo</TableHead>
                  <TableHead className="text-right">Lucro</TableHead>
                  <TableHead className="text-right">Margem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analysis.topProducts.map((p) => {
                  const m = p.revenue > 0 ? (p.profit / p.revenue) * 100 : 0;
                  return (
                    <TableRow key={p.name}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-right">{p.qty}</TableCell>
                      <TableCell className="text-right">R${p.revenue.toFixed(2)}</TableCell>
                      <TableCell className="text-right text-red-500">R${p.cost.toFixed(2)}</TableCell>
                      <TableCell className={`text-right font-medium ${p.profit >= 0 ? "text-green-500" : "text-red-500"}`}>
                        R${p.profit.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={m >= 30 ? "default" : m >= 15 ? "secondary" : "destructive"}>
                          {m.toFixed(1)}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
    </PlanGate>
    </RoleGate>
  );
}
