import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { ShoppingCart, Loader2, Eye, Clock, MessageSquare, Package, Truck, CheckCircle, XCircle, Copy } from "lucide-react";
import { useOrders, useOrderItems, useOrderStatusHistory, useUpdateOrderStatus, ORDER_STATUS_MAP, type OrderStatus } from "@/hooks/useOrders";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

export default function Pedidos() {
  const { data: orders, isLoading } = useOrders();
  const updateStatus = useUpdateOrderStatus();
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const selectedOrder = orders?.find((o) => o.id === selectedOrderId);
  const { data: orderItems } = useOrderItems(selectedOrderId);
  const { data: statusHistory } = useOrderStatusHistory(selectedOrderId);

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
                <div className="flex justify-between pt-2 border-t border-border">
                  <span className="font-medium">Total</span>
                  <span className="font-bold">{formatPrice(selectedOrder.total)}</span>
                </div>
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

              {/* Status history */}
              {statusHistory && statusHistory.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Histórico</p>
                    <div className="space-y-1">
                      {statusHistory.map((h) => (
                        <div key={h.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>{ORDER_STATUS_MAP[h.status as OrderStatus]?.label || h.status}</span>
                          <span>—</span>
                          <span>{format(new Date(h.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

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
