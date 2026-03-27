import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { ShoppingCart, Loader2, Eye, Clock, MessageSquare, Package, Truck, CheckCircle, XCircle, Copy, FileText, Download } from "lucide-react";
import { useOrders, useOrderItems, useOrderStatusHistory, useUpdateOrderStatus, ORDER_STATUS_MAP, type OrderStatus } from "@/hooks/useOrders";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { generateReceiptPdf } from "@/lib/generateReceiptPdf";

export default function Pedidos() {
  const STATUS_ICONS: Record<string, any> = {
    pendente: Clock, processando: Package, enviado: Truck, entregue: CheckCircle, cancelado: XCircle,
  };
  const STATUS_STEPS: OrderStatus[] = ["pendente", "processando", "enviado", "entregue"];

  const { data: orders, isLoading } = useOrders();
  const updateStatus = useUpdateOrderStatus();
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const selectedOrder = orders?.find((o) => o.id === selectedOrderId);
  const { data: orderItems } = useOrderItems(selectedOrderId);
  const { data: statusHistory } = useOrderStatusHistory(selectedOrderId);

  // Realtime for orders
  useEffect(() => {
    const channel = supabase
      .channel("admin-orders-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        // Refetch handled by react-query invalidation
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const filteredOrders = orders?.filter((o) => filterStatus === "all" || o.status === filterStatus);

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(price);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Pedidos</h1>
          <p className="text-muted-foreground">Acompanhe e gerencie os pedidos da loja</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Status:</span>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {Object.entries(ORDER_STATUS_MAP).map(([key, val]) => (
              <SelectItem key={key} value={key}>{val.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Badge variant="secondary" className="ml-2">{filteredOrders?.length ?? 0} pedidos</Badge>
      </div>

      {!filteredOrders?.length ? (
        <Card className="border-border">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ShoppingCart className="h-12 w-12 text-muted-foreground/40" />
            <h3 className="mt-4 text-lg font-medium text-foreground">Nenhum pedido</h3>
            <p className="mt-1 text-sm text-muted-foreground">Os pedidos aparecerão aqui quando clientes comprarem</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pedido</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Via</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.map((order) => {
                const statusInfo = ORDER_STATUS_MAP[order.status as OrderStatus] || ORDER_STATUS_MAP.pendente;
                return (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono text-xs">#{order.id.slice(0, 8)}</TableCell>
                    <TableCell className="font-medium">{order.customer_name}</TableCell>
                    <TableCell>{formatPrice(order.total)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="gap-1">
                        <span className={`h-2 w-2 rounded-full ${statusInfo.color}`} />
                        {statusInfo.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(order.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      {order.whatsapp_order && <MessageSquare className="h-4 w-4 text-green-500" />}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => setSelectedOrderId(order.id)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Order Detail Dialog */}
      <Dialog open={!!selectedOrderId} onOpenChange={(open) => !open && setSelectedOrderId(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Pedido #{selectedOrder?.id.slice(0, 8)}</DialogTitle>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-4">
              {/* Customer info */}
              <div className="space-y-1">
                <p className="text-sm font-medium">Cliente</p>
                <p className="text-sm">{selectedOrder.customer_name}</p>
                {selectedOrder.customer_email && <p className="text-xs text-muted-foreground">{selectedOrder.customer_email}</p>}
                {selectedOrder.customer_phone && <p className="text-xs text-muted-foreground">{selectedOrder.customer_phone}</p>}
                {selectedOrder.customer_address && (
                  <p className="text-xs text-muted-foreground mt-1">{selectedOrder.customer_address}</p>
                )}
              </div>

              <Separator />

              {/* Items */}
              <div className="space-y-2">
                <p className="text-sm font-medium">Itens</p>
                {orderItems?.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 rounded-md border border-border p-2">
                    {item.product_image ? (
                      <img src={item.product_image} alt={item.product_name} className="h-10 w-10 rounded object-cover" />
                    ) : (
                      <div className="h-10 w-10 rounded bg-muted" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.product_name}</p>
                      <p className="text-xs text-muted-foreground">{item.quantity}x {formatPrice(item.unit_price)}</p>
                    </div>
                    <p className="text-sm font-medium">{formatPrice(item.quantity * item.unit_price)}</p>
                  </div>
                ))}
                {/* Shipping info */}
                {(selectedOrder as any).shipping_cost > 0 && (
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Frete ({(selectedOrder as any).shipping_method || "Padrão"})</span>
                    <span>{formatPrice((selectedOrder as any).shipping_cost)}</span>
                  </div>
                )}
                {selectedOrder.discount_amount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Desconto {selectedOrder.coupon_code && `(${selectedOrder.coupon_code})`}</span>
                    <span>-{formatPrice(selectedOrder.discount_amount)}</span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t border-border">
                  <span className="font-medium">Total</span>
                  <span className="font-bold">{formatPrice(selectedOrder.total)}</span>
                </div>
              </div>

              <Separator />

              {/* Status Progress Bar */}
              <div className="space-y-3">
                <p className="text-sm font-medium">Progresso do Pedido</p>
                {selectedOrder.status === "cancelado" ? (
                  <div className="flex items-center gap-2 text-destructive">
                    <XCircle className="h-5 w-5" />
                    <span className="text-sm font-medium">Pedido Cancelado</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between relative px-2">
                    <div className="absolute top-4 left-6 right-6 h-1 bg-muted rounded-full">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-700"
                        style={{ width: `${Math.max(0, (STATUS_STEPS.indexOf(selectedOrder.status as OrderStatus) / (STATUS_STEPS.length - 1)) * 100)}%` }}
                      />
                    </div>
                    {STATUS_STEPS.map((step, i) => {
                      const info = ORDER_STATUS_MAP[step];
                      const Icon = STATUS_ICONS[step] || Clock;
                      const stepIdx = STATUS_STEPS.indexOf(selectedOrder.status as OrderStatus);
                      const isCompleted = i <= stepIdx;
                      const isCurrent = i === stepIdx;
                      return (
                        <div key={step} className="flex flex-col items-center relative z-10">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                            isCompleted ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                          } ${isCurrent ? "ring-2 ring-primary/30 scale-110" : ""}`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <span className={`text-[10px] mt-1 ${isCompleted ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                            {info.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <Separator />

              {/* Status update */}
              <div className="space-y-2">
                <p className="text-sm font-medium">Atualizar Status</p>
                <div className="flex gap-2 flex-wrap">
                  {(Object.keys(ORDER_STATUS_MAP) as OrderStatus[]).map((status) => {
                    const info = ORDER_STATUS_MAP[status];
                    const isCurrent = selectedOrder.status === status;
                    return (
                      <Button
                        key={status}
                        variant={isCurrent ? "default" : "outline"}
                        size="sm"
                        disabled={isCurrent || updateStatus.isPending}
                        onClick={() => updateStatus.mutate({ orderId: selectedOrder.id, status })}
                      >
                        <span className={`h-2 w-2 rounded-full mr-1 ${info.color}`} />
                        {info.label}
                      </Button>
                    );
                  })}
                </div>
              </div>

              {/* Status history timeline */}
              {statusHistory && statusHistory.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Histórico</p>
                    <div className="relative pl-6">
                      <div className="absolute left-[11px] top-1 bottom-1 w-0.5 bg-border" />
                      {statusHistory.map((h, i) => {
                        const Icon = STATUS_ICONS[h.status] || Clock;
                        return (
                          <div key={h.id} className="relative flex items-start gap-3 pb-3 last:pb-0">
                            <div className={`absolute -left-6 w-6 h-6 rounded-full flex items-center justify-center ${
                              i === statusHistory.length - 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                            }`}>
                              <Icon className="h-3 w-3" />
                            </div>
                            <div className="ml-3">
                              <p className="text-xs font-medium">{ORDER_STATUS_MAP[h.status as OrderStatus]?.label || h.status}</p>
                              <p className="text-[10px] text-muted-foreground">{format(new Date(h.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              {/* Receipt & Tracking */}
              <Separator />
              <div className="space-y-3">
                <p className="text-sm font-medium">Comprovante</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2"
                  onClick={async () => {
                    try {
                      toast.loading("Gerando comprovante...", { id: "receipt" });
                      const { data: { session } } = await supabase.auth.getSession();
                      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
                      const resp = await fetch(
                        `https://${projectId}.supabase.co/functions/v1/generate-receipt`,
                        {
                          method: "POST",
                          headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${session?.access_token}`,
                          },
                          body: JSON.stringify({ orderId: selectedOrder.id }),
                        }
                      );
                      const data = await resp.json();
                      if (!resp.ok) throw new Error(data.error);
                      // Open receipt in new tab
                      const blob = new Blob([data.html], { type: "text/html" });
                      const url = URL.createObjectURL(blob);
                      window.open(url, "_blank");
                      toast.success("Comprovante gerado! Você pode salvar como PDF pelo navegador (Ctrl+P).", { id: "receipt" });
                    } catch (err: any) {
                      toast.error("Erro ao gerar comprovante: " + err.message, { id: "receipt" });
                    }
                  }}
                >
                  <FileText className="h-4 w-4" />
                  Gerar Comprovante
                </Button>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Link de Rastreio</p>
                <div className="flex gap-2">
                  <code className="flex-1 text-xs bg-muted p-2 rounded break-all">
                    {window.location.origin}/loja/rastreio/{selectedOrder.id.slice(0, 8)}
                  </code>
                  <Button variant="outline" size="sm" onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/loja/rastreio/${selectedOrder.id.slice(0, 8)}`);
                    toast.success("Link copiado!");
                  }}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {selectedOrder.notes && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm font-medium">Observações</p>
                    <p className="text-sm text-muted-foreground mt-1">{selectedOrder.notes}</p>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
