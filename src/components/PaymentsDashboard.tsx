import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreditCard, QrCode, FileText, Search, ArrowUpDown, TrendingUp, DollarSign, XCircle, Clock, CheckCircle2 } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from "recharts";

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const STATUS_CONFIG: Record<string, { label: string; emoji: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof CheckCircle2 }> = {
  approved: { label: "Aprovado", emoji: "✅", variant: "default", icon: CheckCircle2 },
  paid: { label: "Pago", emoji: "✅", variant: "default", icon: CheckCircle2 },
  pending: { label: "Gerado", emoji: "💰", variant: "secondary", icon: Clock },
  rejected: { label: "Recusado", emoji: "❌", variant: "destructive", icon: XCircle },
  refused: { label: "Recusado", emoji: "❌", variant: "destructive", icon: XCircle },
  cancelled: { label: "Cancelado", emoji: "❌", variant: "destructive", icon: XCircle },
  refunded: { label: "Reembolsado", emoji: "↩️", variant: "outline", icon: XCircle },
};

const METHOD_CONFIG: Record<string, { label: string; emoji: string; icon: typeof CreditCard; color: string }> = {
  pix: { label: "PIX", emoji: "💰", icon: QrCode, color: "hsl(142 71% 45%)" },
  credit_card: { label: "Cartão", emoji: "💳", icon: CreditCard, color: "hsl(243 75% 59%)" },
  boleto: { label: "Boleto", emoji: "📄", icon: FileText, color: "hsl(38 92% 50%)" },
};

const COLORS = ["hsl(142 71% 45%)", "hsl(243 75% 59%)", "hsl(38 92% 50%)", "hsl(0 72% 51%)", "hsl(220 9% 46%)"];

interface PaymentsDashboardProps {
  isSuperAdmin?: boolean;
}

export default function PaymentsDashboard({ isSuperAdmin = false }: PaymentsDashboardProps) {
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState("todos");
  const [methodFilter, setMethodFilter] = useState("todos");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "amount" | "customer">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const { data: payments, isLoading } = useQuery({
    queryKey: ["payments_dashboard", user?.id, isSuperAdmin],
    queryFn: async () => {
      let query = supabase
        .from("payments")
        .select("*, orders(customer_name, customer_email, customer_phone)")
        .order("created_at", { ascending: false });

      if (!isSuperAdmin) {
        query = query.eq("user_id", user!.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const filtered = useMemo(() => {
    let list = payments ?? [];

    if (statusFilter !== "todos") {
      if (statusFilter === "approved") {
        list = list.filter((p) => p.status === "approved" || p.status === "paid");
      } else if (statusFilter === "rejected") {
        list = list.filter((p) => p.status === "rejected" || p.status === "refused" || p.status === "cancelled");
      } else {
        list = list.filter((p) => p.status === statusFilter);
      }
    }
    if (methodFilter !== "todos") {
      list = list.filter((p) => p.method === methodFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) => {
        const order = p.orders as any;
        return (
          order?.customer_name?.toLowerCase().includes(q) ||
          order?.customer_email?.toLowerCase().includes(q) ||
          p.gateway_payment_id?.toLowerCase().includes(q) ||
          p.id?.toLowerCase().includes(q)
        );
      });
    }

    list = [...list].sort((a, b) => {
      let cmp = 0;
      if (sortBy === "date") cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      else if (sortBy === "amount") cmp = Number(a.amount) - Number(b.amount);
      else {
        const na = (a.orders as any)?.customer_name || "";
        const nb = (b.orders as any)?.customer_name || "";
        cmp = na.localeCompare(nb);
      }
      return sortDir === "desc" ? -cmp : cmp;
    });

    return list;
  }, [payments, statusFilter, methodFilter, search, sortBy, sortDir]);

  const totals = useMemo(() => {
    const all = payments ?? [];
    const approved = all.filter((p) => p.status === "approved" || p.status === "paid");
    const pending = all.filter((p) => p.status === "pending");
    const rejected = all.filter((p) => ["rejected", "refused", "cancelled"].includes(p.status));
    const approvedRevenue = approved.reduce((s, p) => s + Number(p.amount), 0);
    const avgTicket = approved.length > 0 ? approvedRevenue / approved.length : 0;
    
    return {
      approvedRevenue,
      approvedCount: approved.length,
      pendingCount: pending.length,
      rejectedCount: rejected.length,
      avgTicket,
      total: all.length,
      byMethod: {
        pix: all.filter((p) => p.method === "pix").length,
        credit_card: all.filter((p) => p.method === "credit_card").length,
        boleto: all.filter((p) => p.method === "boleto").length,
      },
      revenueByMethod: {
        pix: approved.filter((p) => p.method === "pix").reduce((s, p) => s + Number(p.amount), 0),
        credit_card: approved.filter((p) => p.method === "credit_card").reduce((s, p) => s + Number(p.amount), 0),
        boleto: approved.filter((p) => p.method === "boleto").reduce((s, p) => s + Number(p.amount), 0),
      },
    };
  }, [payments]);

  // Charts data
  const methodPieData = useMemo(() => {
    return [
      { name: "PIX", value: totals.byMethod.pix, color: METHOD_CONFIG.pix.color },
      { name: "Cartão", value: totals.byMethod.credit_card, color: METHOD_CONFIG.credit_card.color },
      { name: "Boleto", value: totals.byMethod.boleto, color: METHOD_CONFIG.boleto.color },
    ].filter(d => d.value > 0);
  }, [totals]);

  const revenueByMethodData = useMemo(() => {
    return [
      { name: "PIX", receita: totals.revenueByMethod.pix },
      { name: "Cartão", receita: totals.revenueByMethod.credit_card },
      { name: "Boleto", receita: totals.revenueByMethod.boleto },
    ];
  }, [totals]);

  const toggleSort = (field: typeof sortBy) => {
    if (sortBy === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortBy(field); setSortDir("desc"); }
  };

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="border-green-500/30 bg-gradient-to-br from-green-500/10 to-green-500/5 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <p className="text-xs font-medium text-muted-foreground">Receita Aprovada</p>
            </div>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(totals.approvedRevenue)}</p>
            <p className="text-xs text-muted-foreground mt-1">{totals.approvedCount} transações</p>
          </CardContent>
        </Card>
        <Card className="border-primary/30 bg-gradient-to-br from-primary/10 to-primary/5 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-primary" />
              <p className="text-xs font-medium text-muted-foreground">Ticket Médio</p>
            </div>
            <p className="text-2xl font-bold text-primary">{formatCurrency(totals.avgTicket)}</p>
            <p className="text-xs text-muted-foreground mt-1">Apenas aprovados</p>
          </CardContent>
        </Card>
        <Card className="border-yellow-500/30 bg-gradient-to-br from-yellow-500/10 to-yellow-500/5 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-yellow-600" />
              <p className="text-xs font-medium text-muted-foreground">Pendentes</p>
            </div>
            <p className="text-2xl font-bold text-yellow-600">{totals.pendingCount}</p>
            <p className="text-xs text-muted-foreground mt-1">Aguardando pagamento</p>
          </CardContent>
        </Card>
        <Card className="border-red-500/30 bg-gradient-to-br from-red-500/10 to-red-500/5 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <XCircle className="h-4 w-4 text-red-600" />
              <p className="text-xs font-medium text-muted-foreground">Recusados</p>
            </div>
            <p className="text-2xl font-bold text-red-600">{totals.rejectedCount}</p>
            <p className="text-xs text-muted-foreground mt-1">Falha no pagamento</p>
          </CardContent>
        </Card>
        <Card className="border-border shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs font-medium text-muted-foreground">Total Geral</p>
            </div>
            <p className="text-2xl font-bold text-foreground">{totals.total}</p>
            <p className="text-xs text-muted-foreground mt-1">Todas as transações</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      {totals.total > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Transações por Método</CardTitle>
            </CardHeader>
            <CardContent>
              {methodPieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={methodPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                      {methodPieData.map((d, i) => (
                        <Cell key={i} fill={d.color} />
                      ))}
                    </Pie>
                    <Legend />
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>
              )}
            </CardContent>
          </Card>
          <Card className="border-border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Receita por Método (Aprovados)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={revenueByMethodData}>
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${v}`} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Bar dataKey="receita" radius={[6, 6, 0, 0]}>
                    {revenueByMethodData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card className="border-border shadow-sm">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por cliente, email ou ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={methodFilter} onValueChange={setMethodFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Método" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos métodos</SelectItem>
                <SelectItem value="pix">💰 PIX</SelectItem>
                <SelectItem value="credit_card">💳 Cartão</SelectItem>
                <SelectItem value="boleto">📄 Boleto</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos status</SelectItem>
                <SelectItem value="approved">✅ Aprovados</SelectItem>
                <SelectItem value="pending">💰 Pendentes</SelectItem>
                <SelectItem value="rejected">❌ Recusados</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {/* Sort controls */}
          <div className="flex gap-2">
            {([["date", "Data"], ["amount", "Valor"], ["customer", "Cliente"]] as const).map(([key, label]) => (
              <Button
                key={key}
                variant={sortBy === key ? "default" : "outline"}
                size="sm"
                onClick={() => toggleSort(key)}
                className="text-xs"
              >
                <ArrowUpDown className="h-3 w-3 mr-1" />
                {label}
                {sortBy === key && (sortDir === "desc" ? " ↓" : " ↑")}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Payment list */}
      <Card className="border-border shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center justify-between">
            <span>Transações ({filtered.length})</span>
            {filtered.length !== (payments?.length ?? 0) && (
              <Badge variant="secondary" className="text-xs">Filtrado de {payments?.length ?? 0}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center text-muted-foreground py-8">Carregando...</p>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <DollarSign className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">Nenhuma transação encontrada</p>
              <p className="text-xs text-muted-foreground mt-1">Ajuste os filtros ou aguarde novos pagamentos</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((p) => {
                const order = p.orders as any;
                const sc = STATUS_CONFIG[p.status] || STATUS_CONFIG.pending;
                const mc = METHOD_CONFIG[p.method] || METHOD_CONFIG.pix;
                const StatusIcon = sc.icon;
                return (
                  <div key={p.id} className="flex items-center justify-between rounded-lg border border-border/50 p-3 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-9 w-9 items-center justify-center rounded-full ${
                        p.status === "approved" || p.status === "paid" ? "bg-green-100" :
                        p.status === "pending" ? "bg-yellow-100" : "bg-red-100"
                      }`}>
                        <StatusIcon className={`h-4 w-4 ${
                          p.status === "approved" || p.status === "paid" ? "text-green-600" :
                          p.status === "pending" ? "text-yellow-600" : "text-red-600"
                        }`} />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{order?.customer_name || "—"}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(p.created_at).toLocaleDateString("pt-BR")} · {mc.emoji} {mc.label}
                          {order?.customer_email && <span className="ml-1">· {order.customer_email}</span>}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold">{formatCurrency(Number(p.amount))}</p>
                      <Badge variant={sc.variant} className="text-[10px]">
                        {sc.label}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
