import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Loader2, Package, CheckCircle, Truck, Clock, XCircle, Search, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ORDER_STATUS_MAP, type OrderStatus } from "@/hooks/useOrders";

const STATUS_ICONS: Record<string, any> = {
  pendente: Clock,
  processando: Package,
  enviado: Truck,
  entregue: CheckCircle,
  cancelado: XCircle,
  pago: CheckCircle,
};

const STATUS_STEPS: OrderStatus[] = ["pendente", "processando", "enviado", "entregue"];

export default function LojaRastreio() {
  const { orderId: urlOrderId } = useParams();
  const navigate = useNavigate();
  const [searchId, setSearchId] = useState(urlOrderId || "");
  const [order, setOrder] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(price);

  const fetchOrder = async (id: string) => {
    setLoading(true);
    setNotFound(false);
    setOrder(null);

    const cleanId = id.trim().replace("#", "");

    // Try full UUID or partial match
    let query = supabase.from("orders").select("*");
    if (cleanId.length === 36) {
      query = query.eq("id", cleanId);
    } else {
      query = query.ilike("id", `${cleanId}%`);
    }

    const { data, error } = await query.maybeSingle();

    if (error || !data) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setOrder(data);

    // Fetch items and history
    const [itemsRes, histRes] = await Promise.all([
      supabase.from("order_items").select("*").eq("order_id", data.id),
      supabase.from("order_status_history").select("*").eq("order_id", data.id).order("created_at", { ascending: true }),
    ]);

    setItems(itemsRes.data || []);
    setHistory(histRes.data || []);
    setLoading(false);
  };

  // Realtime subscription
  useEffect(() => {
    if (!order) return;

    const channel = supabase
      .channel(`order-tracking-${order.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${order.id}` }, (payload) => {
        setOrder((prev: any) => ({ ...prev, ...payload.new }));
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "order_status_history", filter: `order_id=eq.${order.id}` }, (payload) => {
        setHistory((prev) => [...prev, payload.new]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [order?.id]);

  // Auto-search if URL has orderId
  useEffect(() => {
    if (urlOrderId) fetchOrder(urlOrderId);
  }, [urlOrderId]);

  const handleSearch = () => {
    if (searchId.trim()) fetchOrder(searchId);
  };

  const currentStepIndex = order ? STATUS_STEPS.indexOf(order.status as OrderStatus) : -1;
  const isCancelled = order?.status === "cancelado";

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Rastreio do Pedido</h1>
        <p className="text-muted-foreground text-sm mt-1">Acompanhe o status do seu pedido em tempo real</p>
      </div>

      {/* Search */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Código do pedido (ex: a1b2c3d4)"
                value={searchId}
                onChange={(e) => setSearchId(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="pl-9 font-mono"
              />
            </div>
            <Button onClick={handleSearch} disabled={loading || !searchId.trim()} className="bg-black text-white hover:bg-gray-800">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {notFound && (
        <Card>
          <CardContent className="flex flex-col items-center py-12">
            <XCircle className="h-12 w-12 text-gray-300" />
            <p className="mt-4 font-medium">Pedido não encontrado</p>
            <p className="text-sm text-muted-foreground mt-1">Verifique o código e tente novamente</p>
          </CardContent>
        </Card>
      )}

      {order && (
        <div className="space-y-6 animate-fade-in">
          {/* Status Progress */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Pedido #{order.id.slice(0, 8)}</CardTitle>
                <Badge variant={isCancelled ? "destructive" : "secondary"} className="gap-1">
                  <span className={`h-2 w-2 rounded-full ${ORDER_STATUS_MAP[order.status as OrderStatus]?.color || "bg-gray-400"}`} />
                  {ORDER_STATUS_MAP[order.status as OrderStatus]?.label || order.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {isCancelled ? (
                <div className="text-center py-4">
                  <XCircle className="h-12 w-12 text-red-400 mx-auto" />
                  <p className="mt-2 font-medium text-red-600">Pedido Cancelado</p>
                </div>
              ) : (
                <div className="flex items-center justify-between relative px-4">
                  {/* Progress bar */}
                  <div className="absolute top-5 left-8 right-8 h-1 bg-gray-200 rounded-full">
                    <div
                      className="h-full bg-black rounded-full transition-all duration-700 ease-out"
                      style={{ width: `${Math.max(0, (currentStepIndex / (STATUS_STEPS.length - 1)) * 100)}%` }}
                    />
                  </div>

                  {STATUS_STEPS.map((step, i) => {
                    const info = ORDER_STATUS_MAP[step];
                    const Icon = STATUS_ICONS[step] || Clock;
                    const isCompleted = i <= currentStepIndex;
                    const isCurrent = i === currentStepIndex;

                    return (
                      <div key={step} className="flex flex-col items-center relative z-10">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500 ${
                            isCompleted
                              ? "bg-black text-white shadow-lg"
                              : "bg-gray-100 text-muted-foreground border-2 border-border"
                          } ${isCurrent ? "ring-4 ring-gray-200 scale-110" : ""}`}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                        <span className={`text-xs mt-2 font-medium ${isCompleted ? "text-black" : "text-muted-foreground"}`}>
                          {info.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Realtime indicator */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            Atualização em tempo real
          </div>

          {/* Order Items */}
          <Card>
            <CardHeader><CardTitle className="text-base">Itens do Pedido</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {items.map((item) => (
                <div key={item.id} className="flex items-center gap-3">
                  {item.product_image ? (
                    <img src={item.product_image} alt={item.product_name} className="h-12 w-12 rounded object-cover" />
                  ) : (
                    <div className="h-12 w-12 rounded bg-gray-100" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.product_name}</p>
                    <p className="text-xs text-muted-foreground">{item.quantity}x {formatPrice(item.unit_price)}</p>
                  </div>
                  <p className="text-sm font-medium">{formatPrice(item.quantity * item.unit_price)}</p>
                </div>
              ))}
              <Separator />
              {(order.shipping_cost > 0) && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Frete ({order.shipping_method || "Padrão"})</span>
                  <span>{formatPrice(order.shipping_cost)}</span>
                </div>
              )}
              {(order.discount_amount > 0) && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Desconto {order.coupon_code && `(${order.coupon_code})`}</span>
                  <span>-{formatPrice(order.discount_amount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg">
                <span>Total</span>
                <span>{formatPrice(order.total)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Timeline */}
          {history.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Histórico</CardTitle></CardHeader>
              <CardContent>
                <div className="relative pl-6">
                  <div className="absolute left-[11px] top-1 bottom-1 w-0.5 bg-gray-200" />
                  {history.map((h, i) => {
                    const Icon = STATUS_ICONS[h.status] || Clock;
                    return (
                      <div key={h.id} className="relative flex items-start gap-3 pb-4 last:pb-0">
                        <div className={`absolute -left-6 w-6 h-6 rounded-full flex items-center justify-center ${
                          i === history.length - 1 ? "bg-black text-white" : "bg-gray-200 text-muted-foreground"
                        }`}>
                          <Icon className="h-3 w-3" />
                        </div>
                        <div className="ml-3">
                          <p className="text-sm font-medium">
                            {ORDER_STATUS_MAP[h.status as OrderStatus]?.label || h.status}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(h.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Customer Info */}
          <Card>
            <CardHeader><CardTitle className="text-base">Dados do Pedido</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Cliente</span><span>{order.customer_name}</span></div>
              {order.customer_phone && <div className="flex justify-between"><span className="text-muted-foreground">Telefone</span><span>{order.customer_phone}</span></div>}
              {order.customer_email && <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span>{order.customer_email}</span></div>}
              {order.customer_address && <div className="flex justify-between"><span className="text-muted-foreground">Endereço</span><span className="text-right max-w-[60%]">{order.customer_address}</span></div>}
              <div className="flex justify-between"><span className="text-muted-foreground">Data</span><span>{format(new Date(order.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span></div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
