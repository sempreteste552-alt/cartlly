import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreditCard, QrCode, FileText, Search, ArrowUpDown } from "lucide-react";

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const STATUS_CONFIG: Record<string, { label: string; emoji: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  approved: { label: "Aprovado", emoji: "✅", variant: "default" },
  pending: { label: "Gerado", emoji: "💰", variant: "secondary" },
  rejected: { label: "Recusado", emoji: "❌", variant: "destructive" },
  cancelled: { label: "Cancelado", emoji: "❌", variant: "destructive" },
  refunded: { label: "Reembolsado", emoji: "↩️", variant: "outline" },
};

const METHOD_CONFIG: Record<string, { label: string; emoji: string; icon: typeof CreditCard }> = {
  pix: { label: "PIX", emoji: "💰", icon: QrCode },
  credit_card: { label: "Cartão", emoji: "💳", icon: CreditCard },
  boleto: { label: "Boleto", emoji: "📄", icon: FileText },
};

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
      list = list.filter((p) => p.status === statusFilter);
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
          p.gateway_payment_id?.toLowerCase().includes(q)
        );
      });
    }

    list.sort((a, b) => {
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
    return {
      approved: all.filter((p) => p.status === "approved").reduce((s, p) => s + Number(p.amount), 0),
      pending: all.filter((p) => p.status === "pending").length,
      rejected: all.filter((p) => p.status === "rejected" || p.status === "cancelled").length,
      total: all.reduce((s, p) => s + Number(p.amount), 0),
      byMethod: {
        pix: all.filter((p) => p.method === "pix").length,
        credit_card: all.filter((p) => p.method === "credit_card").length,
        boleto: all.filter((p) => p.method === "boleto").length,
      },
    };
  }, [payments]);

  const toggleSort = (field: typeof sortBy) => {
    if (sortBy === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortBy(field); setSortDir("desc"); }
  };

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">✅ Total Aprovado</p>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(totals.approved)}</p>
          </CardContent>
        </Card>
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">💰 Pendentes/Gerados</p>
            <p className="text-2xl font-bold text-yellow-600">{totals.pending}</p>
          </CardContent>
        </Card>
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">❌ Recusados</p>
            <p className="text-2xl font-bold text-red-600">{totals.rejected}</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Conversão por Método</p>
            <div className="flex gap-3 mt-1">
              <span className="text-xs">💰 PIX: {totals.byMethod.pix}</span>
              <span className="text-xs">💳 Cartão: {totals.byMethod.credit_card}</span>
              <span className="text-xs">📄 Boleto: {totals.byMethod.boleto}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border-border">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por cliente ou ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={methodFilter} onValueChange={setMethodFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Método" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos métodos</SelectItem>
                <SelectItem value="pix">💰 PIX</SelectItem>
                <SelectItem value="credit_card">💳 Cartão</SelectItem>
                <SelectItem value="boleto">📄 Boleto</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Tabs value={statusFilter} onValueChange={setStatusFilter}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="todos">Todos</TabsTrigger>
              <TabsTrigger value="approved">✅ Aprovados</TabsTrigger>
              <TabsTrigger value="pending">💰 Gerados</TabsTrigger>
              <TabsTrigger value="rejected">❌ Recusados</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardContent>
      </Card>

      {/* Sort controls */}
      <div className="flex gap-2">
        {([["date", "Data"], ["amount", "Valor"], ["customer", "Cliente"]] as const).map(([key, label]) => (
          <Button
            key={key}
            variant={sortBy === key ? "default" : "outline"}
            size="sm"
            onClick={() => toggleSort(key)}
          >
            <ArrowUpDown className="h-3 w-3 mr-1" />
            {label}
          </Button>
        ))}
      </div>

      {/* Payment list */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-lg">
            Transações ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center text-muted-foreground py-8">Carregando...</p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhuma transação encontrada.</p>
          ) : (
            <div className="space-y-3">
              {filtered.map((p) => {
                const order = p.orders as any;
                const sc = STATUS_CONFIG[p.status] || STATUS_CONFIG.pending;
                const mc = METHOD_CONFIG[p.method] || METHOD_CONFIG.pix;
                return (
                  <div key={p.id} className="flex items-center justify-between border-b border-border pb-3 last:border-0">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{sc.emoji}</span>
                      <div>
                        <p className="text-sm font-medium">{order?.customer_name || "—"}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(p.created_at).toLocaleDateString("pt-BR")} · {mc.emoji} {mc.label}
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
