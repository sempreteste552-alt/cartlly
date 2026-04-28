import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCustomerAuth } from "@/hooks/useCustomerAuth";
import { useLoja } from "@/contexts/LojaContext";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Loader2,
  Package,
  CheckCircle,
  Truck,
  Clock,
  XCircle,
  Search,
  ShoppingBag,
  ArrowRight,
  LogIn,
  Receipt,
  Calendar,
  ChevronRight,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const STATUS_META: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  pendente:    { label: "Aguardando pagamento", icon: Clock,       color: "#b45309", bg: "#fef3c7" },
  pago:        { label: "Pagamento confirmado", icon: CheckCircle, color: "#047857", bg: "#d1fae5" },
  processando: { label: "Em preparação",        icon: Package,     color: "#1d4ed8", bg: "#dbeafe" },
  enviado:     { label: "Enviado",              icon: Truck,       color: "#7c3aed", bg: "#ede9fe" },
  entregue:    { label: "Entregue",             icon: CheckCircle, color: "#047857", bg: "#d1fae5" },
  cancelado:   { label: "Cancelado",            icon: XCircle,     color: "#b91c1c", bg: "#fee2e2" },
};

type OrderRow = {
  id: string;
  status: string;
  total: number;
  created_at: string;
  shipping_cost?: number | null;
  discount_amount?: number | null;
  shipping_city?: string | null;
  shipping_state?: string | null;
  order_items?: { id: string; product_name?: string; quantity: number; price: number }[];
};

export default function LojaPedidos() {
  const navigate = useNavigate();
  const { customer, user, customerLoading, loading } = useCustomerAuth();
  const { settings, basePath } = useLoja() as any;
  const primaryColor = settings?.primary_color || "#6d28d9";
  const storeUserId = settings?.user_id;

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "open" | "delivered" | "cancelled">("all");

  useEffect(() => {
    if (!customer || !storeUserId) {
      setLoadingOrders(false);
      return;
    }
    let mounted = true;
    (async () => {
      setLoadingOrders(true);
      const { data, error } = await supabase
        .from("orders")
        .select("id,status,total,created_at,shipping_cost,discount_amount,shipping_city,shipping_state,order_items(id,product_name,quantity,price)")
        .eq("user_id", storeUserId)
        .eq("customer_email", customer.email)
        .order("created_at", { ascending: false });
      if (!mounted) return;
      if (!error && data) setOrders(data as any);
      setLoadingOrders(false);
    })();
    return () => { mounted = false; };
  }, [customer, storeUserId]);

  const stats = useMemo(() => {
    const total = orders.length;
    const spent = orders
      .filter((o) => o.status !== "cancelado")
      .reduce((s, o) => s + Number(o.total || 0), 0);
    const inProgress = orders.filter((o) => ["pendente", "pago", "processando", "enviado"].includes(o.status)).length;
    const delivered = orders.filter((o) => o.status === "entregue").length;
    return { total, spent, inProgress, delivered };
  }, [orders]);

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (filter === "open" && !["pendente", "pago", "processando", "enviado"].includes(o.status)) return false;
      if (filter === "delivered" && o.status !== "entregue") return false;
      if (filter === "cancelled" && o.status !== "cancelado") return false;
      if (!search.trim()) return true;
      const q = search.trim().toLowerCase();
      const idMatch = o.id.toLowerCase().includes(q);
      const itemMatch = o.order_items?.some((i) => (i.product_name || "").toLowerCase().includes(q));
      return idMatch || itemMatch;
    });
  }, [orders, filter, search]);

  const formatPrice = (n: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

  // --- Estados de página ---
  if (loading || customerLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: primaryColor }} />
      </div>
    );
  }

  // Não logado
  if (!user || !customer) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div
          className="h-16 w-16 mx-auto rounded-2xl flex items-center justify-center mb-4"
          style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}
        >
          <Receipt className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Meus Pedidos</h1>
        <p className="text-muted-foreground text-sm mb-6">
          Entre na sua conta para acompanhar todos os seus pedidos, rastreio e histórico de compras.
        </p>
        <Button
          className="w-full h-11 font-semibold"
          style={{ backgroundColor: primaryColor, color: "#fff" }}
          onClick={() => navigate(`${basePath}?login=1`)}
        >
          <LogIn className="h-4 w-4 mr-2" /> Entrar na minha conta
        </Button>
        <p className="text-xs text-muted-foreground mt-4">
          Você também pode rastrear um pedido específico em{" "}
          <Link to={`${basePath}/rastreio`} className="underline" style={{ color: primaryColor }}>
            Rastrear pedido
          </Link>.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 sm:py-10">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
          <Link to={basePath} className="hover:underline">Início</Link>
          <ChevronRight className="h-3 w-3" />
          <span>Meus Pedidos</span>
        </div>
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Meus Pedidos</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Olá, <span className="font-medium text-foreground">{customer.name || customer.email}</span> — aqui está todo o seu histórico de compras.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => navigate(`${basePath}/rastreio`)}
            className="h-10"
          >
            <Search className="h-4 w-4 mr-2" /> Rastrear por código
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Total de pedidos", value: stats.total, icon: ShoppingBag },
          { label: "Em andamento", value: stats.inProgress, icon: Clock },
          { label: "Entregues", value: stats.delivered, icon: CheckCircle },
          { label: "Total gasto", value: formatPrice(stats.spent), icon: Receipt },
        ].map((k, i) => (
          <Card key={i} className="border-border/60">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div
                  className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${primaryColor}12`, color: primaryColor }}
                >
                  <k.icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium truncate">{k.label}</div>
                  <div className="text-lg font-bold leading-tight truncate">{k.value}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por código ou produto"
            className="pl-9 h-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1">
          {[
            { id: "all", label: "Todos" },
            { id: "open", label: "Em andamento" },
            { id: "delivered", label: "Entregues" },
            { id: "cancelled", label: "Cancelados" },
          ].map((f) => {
            const active = filter === (f.id as any);
            return (
              <button
                key={f.id}
                onClick={() => setFilter(f.id as any)}
                className="px-3 h-10 rounded-md text-sm font-medium border transition-colors whitespace-nowrap"
                style={{
                  backgroundColor: active ? primaryColor : "transparent",
                  color: active ? "#fff" : undefined,
                  borderColor: active ? primaryColor : "hsl(var(--border))",
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Lista */}
      {loadingOrders ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: primaryColor }} />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-14 text-center">
            <div
              className="h-14 w-14 mx-auto rounded-2xl flex items-center justify-center mb-3"
              style={{ backgroundColor: `${primaryColor}12`, color: primaryColor }}
            >
              <ShoppingBag className="h-6 w-6" />
            </div>
            <h3 className="font-semibold mb-1">
              {orders.length === 0 ? "Você ainda não fez nenhum pedido" : "Nenhum pedido encontrado"}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {orders.length === 0
                ? "Quando finalizar uma compra, ela aparecerá aqui."
                : "Tente ajustar os filtros ou a busca."}
            </p>
            <Button
              onClick={() => navigate(basePath)}
              style={{ backgroundColor: primaryColor, color: "#fff" }}
            >
              Explorar produtos <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((order) => {
            const meta = STATUS_META[order.status] || STATUS_META.pendente;
            const StatusIcon = meta.icon;
            const itemsCount = order.order_items?.reduce((s, i) => s + (i.quantity || 0), 0) || 0;
            const firstItems = order.order_items?.slice(0, 3) || [];
            const extra = (order.order_items?.length || 0) - firstItems.length;
            return (
              <Card key={order.id} className="overflow-hidden border-border/60 hover:shadow-md transition-shadow">
                <CardHeader className="pb-3 flex flex-row items-start justify-between gap-3 space-y-0">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-muted-foreground font-medium">Pedido</span>
                      <span className="font-mono text-sm font-bold">#{order.id.slice(0, 8).toUpperCase()}</span>
                      <Badge
                        className="font-semibold border-0"
                        style={{ backgroundColor: meta.bg, color: meta.color }}
                      >
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {meta.label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1.5">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(order.created_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Total</div>
                    <div className="text-lg font-bold" style={{ color: primaryColor }}>
                      {formatPrice(Number(order.total))}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <Separator className="mb-3" />
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-0">
                      <Package className="h-4 w-4 shrink-0" />
                      <span className="truncate">
                        {itemsCount} {itemsCount === 1 ? "item" : "itens"}
                        {firstItems.length > 0 && (
                          <>
                            <span className="mx-1.5">·</span>
                            <span className="text-foreground">
                              {firstItems.map((i) => i.product_name).filter(Boolean).join(", ")}
                              {extra > 0 ? ` +${extra}` : ""}
                            </span>
                          </>
                        )}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9"
                        asChild
                      >
                        <Link to={`${basePath}/rastreio/${order.id}`}>
                          <Truck className="h-3.5 w-3.5 mr-1.5" /> Rastrear
                        </Link>
                      </Button>
                      <Button
                        size="sm"
                        className="h-9 font-semibold"
                        style={{ backgroundColor: primaryColor, color: "#fff" }}
                        asChild
                      >
                        <Link to={`${basePath}/rastreio/${order.id}`}>
                          Ver detalhes <ChevronRight className="h-3.5 w-3.5 ml-1" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
