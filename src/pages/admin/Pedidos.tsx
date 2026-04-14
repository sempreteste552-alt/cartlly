import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { 
  ShoppingCart, Loader2, Eye, Clock, MessageSquare, Package, Truck, CheckCircle, 
  XCircle, Copy, FileText, Download, Search, Calendar as CalendarIcon, Printer,
  Filter, FileSpreadsheet, FileJson, Share2, Info, Gift
} from "lucide-react";
import { useOrders, useOrderItems, useOrderStatusHistory, useOrderPayment, useUpdateOrderStatus, ORDER_STATUS_MAP, type OrderStatus } from "@/hooks/useOrders";
import { useStoreSettings } from "@/hooks/useStoreSettings";
import { supabase } from "@/integrations/supabase/client";
import { format, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { generateReceiptPdf } from "@/lib/generateReceiptPdf";
import { generateOrderLabel } from "@/lib/generateOrderLabel";
import { exportToCSV, exportToXLSX, exportToPDF } from "@/lib/exportUtils";
import { useTenantContext } from "@/hooks/useTenantContext";
import { canAccess } from "@/lib/planPermissions";
import { useTranslation } from "@/i18n";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

export default function Pedidos() {
  const { t } = useTranslation();
  const STATUS_ICONS: Record<string, any> = {
    pendente: Clock, processando: Package, enviado: Truck, entregue: CheckCircle, cancelado: XCircle,
  };
  const STATUS_STEPS: OrderStatus[] = ["pendente", "processando", "enviado", "entregue"];

  const { data: orders, isLoading } = useOrders();
  const { data: storeSettings } = useStoreSettings();
  const { data: abandonedCarts, isLoading: loadingAbandoned } = useQuery({
    queryKey: ["abandoned_carts_admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("abandoned_carts")
        .select("*")
        .eq("user_id", (storeSettings as any)?.user_id)
        .eq("recovered", false)
        .order("abandoned_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!(storeSettings as any)?.user_id,
  });
  const updateStatus = useUpdateOrderStatus();
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });
  const [isPrinterDialogOpen, setIsPrinterDialogOpen] = useState(false);

  const selectedOrder = orders?.find((o) => o.id === selectedOrderId);
  const { data: orderItems } = useOrderItems(selectedOrderId);
  const { data: statusHistory } = useOrderStatusHistory(selectedOrderId);
  const { data: orderPayment } = useOrderPayment(selectedOrderId);

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

  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    
    return orders.filter((o) => {
      const matchesStatus = filterStatus === "all" || o.status === filterStatus;
      
      const pStatus = (o as any).payments?.[0]?.status || "pendente";
      const matchesPayment = paymentStatusFilter === "all" || 
        (paymentStatusFilter === "paid" && (pStatus === "approved" || pStatus === "paid")) ||
        (paymentStatusFilter === "pending" && pStatus === "pending") ||
        (paymentStatusFilter === "failed" && (pStatus === "failed" || pStatus === "refused"));

      const matchesSearch = searchTerm === "" || 
        o.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (o.referral_code && o.referral_code.toLowerCase().includes(searchTerm.toLowerCase()));

      let matchesDate = true;
      if (dateRange.from && dateRange.to) {
        matchesDate = isWithinInterval(new Date(o.created_at), {
          start: startOfDay(dateRange.from),
          end: endOfDay(dateRange.to),
        });
      } else if (dateRange.from) {
        matchesDate = new Date(o.created_at) >= startOfDay(dateRange.from);
      }

      return matchesStatus && matchesPayment && matchesSearch && matchesDate;
    });
  }, [orders, filterStatus, paymentStatusFilter, searchTerm, dateRange]);

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(price);

  const { ctx } = useTenantContext();
  const canPrintLabel = canAccess("gateway", ctx); // STARTER+

  const handlePrintLabel = async (order: any) => {
    if (!canPrintLabel) {
      toast.error("Imprimir etiqueta está disponível a partir do plano Starter. Faça upgrade para desbloquear.");
      return;
    }
    const pStatus = (order as any).payments?.[0]?.status || "pendente";
    const isPaid = pStatus === "approved" || pStatus === "paid";
    
    if (!isPaid) {
      toast.error("Só é possível imprimir etiquetas de pedidos com pagamento aprovado.");
      return;
    }

    const fetchItems = async () => {
      const { data: items, error } = await supabase.from("order_items").select("*").eq("order_id", order.id);
      if (error) throw error;
      
      const storeName = (storeSettings as any)?.store_name || "Minha Loja";
      generateOrderLabel({
        orderId: order.id,
        date: format(new Date(order.created_at), "dd/MM/yy HH:mm", { locale: ptBR }),
        storeName,
        storeLogo: (storeSettings as any)?.logo_url || undefined,
        storeCity: (storeSettings as any)?.store_city || undefined,
        storeState: (storeSettings as any)?.store_state || undefined,
        storePhone: (storeSettings as any)?.whatsapp_number || undefined,
        storeEmail: (storeSettings as any)?.store_email || undefined,
        storeCep: (storeSettings as any)?.store_cep || undefined,
        customerName: order.customer_name,
        customerPhone: order.customer_phone || undefined,
        customerCpf: order.customer_cpf || undefined,
        customerEmail: order.customer_email || undefined,
        customerAddress: order.customer_address || undefined,
        shippingStreet: order.shipping_street || undefined,
        shippingNumber: order.shipping_number || undefined,
        shippingComplement: order.shipping_complement || undefined,
        shippingNeighborhood: order.shipping_neighborhood || undefined,
        shippingCity: order.shipping_city || undefined,
        shippingState: order.shipping_state || undefined,
        shippingCep: order.shipping_cep || undefined,
        shippingMethod: order.shipping_method || undefined,
        shippingCost: order.shipping_cost || 0,
        items: items?.map(i => ({ name: i.product_name, quantity: i.quantity, price: i.unit_price })) || [],
        total: order.total,
        paymentMethod: (order as any).payments?.[0]?.method || (order.whatsapp_order ? "WhatsApp" : "Online"),
        paymentStatus: isPaid ? "Pago" : "Pendente",
        notes: order.notes || "",
      });
      return items;
    };

    toast.promise(fetchItems(), {
      loading: "Preparando etiqueta...",
      success: "Etiqueta gerada!",
      error: "Erro ao carregar itens do pedido."
    });
  };

  const handlePrintReceipt = async (order: any) => {
    const fetchItems = async () => {
      const { data: items, error } = await supabase.from("order_items").select("*").eq("order_id", order.id);
      if (error) throw error;
      
      const pStatus = (order as any).payments?.[0]?.status || "pendente";
      const isPaid = pStatus === "approved" || pStatus === "paid";
      const discountAmount = order.discount_amount || 0;
      const subtotal = items?.reduce((acc, i) => acc + (i.unit_price * i.quantity), 0) || 0;

      generateReceiptPdf({
        orderId: order.id,
        date: format(new Date(order.created_at), "dd/MM/yy HH:mm", { locale: ptBR }),
        storeName: (storeSettings as any)?.store_name || "Minha Loja",
        storeLogoUrl: (storeSettings as any)?.logo_url || undefined,
        storeAddress: (storeSettings as any)?.store_address || undefined,
        storePhone: (storeSettings as any)?.whatsapp_number || undefined,
        customerName: order.customer_name,
        customerEmail: order.customer_email || undefined,
        customerPhone: order.customer_phone || undefined,
        customerAddress: order.customer_address || undefined,
        customerCpf: order.customer_cpf || undefined,
        items: items?.map(i => ({ name: i.product_name, quantity: i.quantity, price: i.unit_price })) || [],
        subtotal,
        discount: discountAmount,
        shipping: order.shipping_cost || 0,
        total: order.total,
        paymentMethod: (order as any).payments?.[0]?.method || (order.whatsapp_order ? "WhatsApp" : "Online"),
        notes: order.notes || undefined,
      });
      return items;
    };

    toast.promise(fetchItems(), {
      loading: "Gerando recibo...",
      success: "Recibo gerado!",
      error: "Erro ao carregar itens do pedido."
    });
  };

  const handleExport = (type: "csv" | "xlsx" | "pdf") => {
    if (!filteredOrders.length) {
      toast.error("Nenhum pedido para exportar.");
      return;
    }

    const exportData = filteredOrders.map(o => ({
      id: o.id,
      customer_name: o.customer_name,
      customer_email: o.customer_email || "",
      customer_phone: o.customer_phone || "",
      customer_address: o.customer_address || "",
      total: o.total,
      status: o.status,
      created_at: o.created_at,
      payment_method: (o as any).payments?.[0]?.method || "",
      items_summary: "Ver detalhes no sistema"
    }));

    const dateStr = format(new Date(), "yyyy-MM-dd");
    if (type === "csv") exportToCSV(exportData, `pedidos-${dateStr}.csv`);
    if (type === "xlsx") exportToXLSX(exportData, `pedidos-${dateStr}.xlsx`);
    if (type === "pdf") exportToPDF(exportData, `pedidos-${dateStr}.pdf`);
    
    toast.success(`Exportação ${type.toUpperCase()} concluída!`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div id="orders-header" className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">Pedidos</h1>
          <p className="text-muted-foreground text-xs sm:text-sm">Acompanhe e gerencie os pedidos da loja</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setIsPrinterDialogOpen(true)}>
            <Printer className="h-4 w-4" />
            <span className="hidden sm:inline">Configurar Impressora</span>
          </Button>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" onClick={() => handleExport("csv")}>
              <FileSpreadsheet className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">CSV</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExport("xlsx")}>
              <FileSpreadsheet className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">XLSX</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExport("pdf")}>
              <Download className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">PDF</span>
            </Button>
          </div>
        </div>
      </div>

      <Card className="border-border">
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar pedido ou cliente..."
                className="pl-9 h-9 text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Status Filter */}
            <div className="flex flex-col gap-1.5">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Status Pedido" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Status</SelectItem>
                  {Object.entries(ORDER_STATUS_MAP).map(([key, val]) => (
                    <SelectItem key={key} value={key}>{val.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Payment Filter */}
            <div className="flex flex-col gap-1.5">
              <Select value={paymentStatusFilter} onValueChange={setPaymentStatusFilter}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Pagamento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Pagamentos</SelectItem>
                  <SelectItem value="paid">✅ Aprovado</SelectItem>
                  <SelectItem value="pending">⏳ Pendente</SelectItem>
                  <SelectItem value="failed">❌ Recusado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date Picker */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={`h-9 text-sm justify-start font-normal ${!dateRange.from && "text-muted-foreground"}`}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "dd/MM", { locale: ptBR })} - {format(dateRange.to, "dd/MM", { locale: ptBR })}
                      </>
                    ) : (
                      format(dateRange.from, "dd/MM", { locale: ptBR })
                    )
                  ) : (
                    <span>Filtrar por data</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange.from}
                  selected={{ from: dateRange.from, to: dateRange.to }}
                  onSelect={(range: any) => setDateRange({ from: range?.from, to: range?.to })}
                  numberOfMonths={1}
                />
                <div className="p-2 border-t border-border flex justify-end">
                  <Button variant="ghost" size="sm" onClick={() => setDateRange({ from: undefined, to: undefined })}>Limpar</Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
          
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">{filteredOrders?.length ?? 0} pedidos encontrados</Badge>
            {searchTerm || filterStatus !== "all" || paymentStatusFilter !== "all" || dateRange.from ? (
              <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => {
                setSearchTerm("");
                setFilterStatus("all");
                setPaymentStatusFilter("all");
                setDateRange({ from: undefined, to: undefined });
              }}>
                Limpar filtros
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {!filteredOrders?.length ? (
        <Card className="border-border">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ShoppingCart className="h-12 w-12 text-muted-foreground/40" />
            <h3 className="mt-4 text-lg font-medium text-foreground">Nenhum pedido</h3>
            <p className="mt-1 text-sm text-muted-foreground">Tente ajustar seus filtros para encontrar o que procura</p>
          </CardContent>
        </Card>
      ) : (
        <Card id="orders-table" className="border-border overflow-hidden">
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pedido</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.map((order) => {
                const statusInfo = ORDER_STATUS_MAP[order.status as OrderStatus] || ORDER_STATUS_MAP.pendente;
                const pStatus = (order as any).payments?.[0]?.status || "pendente";
                const isPaid = pStatus === "approved" || pStatus === "paid";
                
                return (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono text-xs">#{order.id.slice(0, 8)}</TableCell>
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span>{order.customer_name}</span>
                        {order.referral_code && (
                          <div className="flex items-center gap-1 text-[10px] text-primary font-medium mt-0.5">
                            <Gift className="h-3 w-3" />
                            Indicação: {order.referral_code}
                          </div>
                        )}
                        {order.whatsapp_order && <span className="text-[10px] text-green-600 flex items-center gap-1 mt-0.5"><MessageSquare className="h-2 w-2" /> WhatsApp</span>}
                      </div>
                    </TableCell>
                    <TableCell>{formatPrice(order.total)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="gap-1 text-[10px] h-5">
                        <span className={`h-1.5 w-1.5 rounded-full ${statusInfo.color}`} />
                        {statusInfo.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={isPaid ? "default" : "secondary"} className="text-[10px] h-5">
                        {isPaid ? "Pago" : "Pendente"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {format(new Date(order.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedOrderId(order.id)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className={`h-8 w-8 ${isPaid ? "text-primary hover:text-primary hover:bg-primary/10" : "text-muted-foreground opacity-30"}`}
                          disabled={!isPaid}
                          onClick={() => handlePrintLabel(order)}
                        >
                          <Printer className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          </div>
        </Card>
      )}

      {/* Printer Configuration Dialog */}
      <Dialog open={isPrinterDialogOpen} onOpenChange={setIsPrinterDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Conectar Impressora</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="bg-muted p-3 rounded-md flex gap-3">
              <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium mb-1">Como funciona a impressão?</p>
                <p className="text-muted-foreground">O sistema utiliza o driver de impressão do seu dispositivo. Você pode usar qualquer impressora térmica (80mm ou 58mm) ou impressora comum.</p>
              </div>
            </div>
            
            <div className="space-y-3">
              <p className="text-sm font-medium">Instruções:</p>
              <ol className="text-sm space-y-2 list-decimal list-inside text-muted-foreground">
                <li>Conecte sua impressora ao computador ou celular.</li>
                <li>Certifique-se de que os drivers estão instalados.</li>
                <li>Ao clicar em <span className="text-foreground font-medium">Imprimir</span>, o sistema abrirá a janela de impressão do navegador.</li>
                <li>Selecione sua impressora e ajuste o tamanho do papel (ex: 80mm x Receipt).</li>
              </ol>
            </div>

            <Button className="w-full" onClick={() => setIsPrinterDialogOpen(false)}>Entendi</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Order Detail Dialog */}
      <Dialog open={!!selectedOrderId} onOpenChange={(open) => !open && setSelectedOrderId(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-auto">
          <DialogHeader className="flex flex-row items-center justify-between space-y-0">
            <DialogTitle>Pedido #{selectedOrder?.id.slice(0, 8)}</DialogTitle>
            {selectedOrder && (
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2"
                disabled={((selectedOrder as any).payments?.[0]?.status !== "approved" && (selectedOrder as any).payments?.[0]?.status !== "paid")}
                onClick={() => handlePrintLabel(selectedOrder)}
              >
                <Printer className="h-4 w-4" />
                Imprimir
              </Button>
            )}
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-4 mt-4">
              {/* Customer info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cliente</p>
                  <p className="text-sm font-medium">{selectedOrder.customer_name}</p>
                  {selectedOrder.customer_email && <p className="text-xs text-muted-foreground">{selectedOrder.customer_email}</p>}
                  {selectedOrder.customer_phone && <p className="text-xs text-muted-foreground">{selectedOrder.customer_phone}</p>}
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Data do Pedido</p>
                  <p className="text-sm">{format(new Date(selectedOrder.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Endereço de Entrega</p>
                <p className="text-sm">{selectedOrder.customer_address || "Não informado"}</p>
              </div>

              <Separator />

              {/* Payment Info */}
              <div className="space-y-2">
                <p className="text-sm font-semibold">Pagamento</p>
                {orderPayment ? (
                  <div className="flex items-center gap-3 rounded-md border border-border p-3 bg-muted/30">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <Badge variant={orderPayment.status === "approved" || orderPayment.status === "paid" ? "default" : orderPayment.status === "refused" || orderPayment.status === "failed" ? "destructive" : "secondary"}>
                          {orderPayment.status === "approved" || orderPayment.status === "paid" ? "✅ Pago" : orderPayment.status === "refused" || orderPayment.status === "failed" ? "❌ Recusado" : "⏳ Pendente"}
                        </Badge>
                        <span className="text-xs font-medium text-muted-foreground uppercase">{orderPayment.gateway}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Método: <span className="font-medium text-foreground">
                          {orderPayment.method === "pix" ? "PIX" : orderPayment.method === "credit_card" ? "Cartão de Crédito" : orderPayment.method === "debit_card" ? "Cartão de Débito" : orderPayment.method === "boleto" ? "Boleto" : orderPayment.method}
                        </span>
                        {orderPayment.card_brand && ` • ${orderPayment.card_brand}`}
                        {orderPayment.card_last_four && ` •••• ${orderPayment.card_last_four}`}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-md border border-dashed border-border text-center">
                    <p className="text-xs text-muted-foreground">Nenhum pagamento registrado</p>
                  </div>
                )}
              </div>

              <Separator />

              {/* Items */}
              <div className="space-y-2">
                <p className="text-sm font-semibold">Itens do Pedido</p>
                <div className="space-y-2">
                  {orderItems?.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 rounded-md border border-border p-2">
                      {item.product_image ? (
                        <img src={item.product_image} alt={item.product_name} className="h-10 w-10 rounded object-cover" />
                      ) : (
                        <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                          <Package className="h-5 w-5 text-muted-foreground/40" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.product_name}</p>
                        <p className="text-xs text-muted-foreground">{item.quantity}x {formatPrice(item.unit_price)}</p>
                      </div>
                      <p className="text-sm font-medium">{formatPrice(item.quantity * item.unit_price)}</p>
                    </div>
                  ))}
                </div>
                
                <div className="space-y-1.5 pt-2">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Subtotal</span>
                    <span>{formatPrice(orderItems?.reduce((acc, i) => acc + (i.quantity * i.unit_price), 0) || 0)}</span>
                  </div>
                  {(selectedOrder as any).shipping_cost > 0 && (
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Frete ({(selectedOrder as any).shipping_method || "Padrão"})</span>
                      <span>{formatPrice((selectedOrder as any).shipping_cost)}</span>
                    </div>
                  )}
                  {selectedOrder.discount_amount > 0 && (
                    <div className="flex justify-between text-xs text-green-600">
                      <span>Desconto {selectedOrder.coupon_code && `(${selectedOrder.coupon_code})`}</span>
                      <span>-{formatPrice(selectedOrder.discount_amount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 border-t border-border">
                    <span className="text-sm font-bold">Total</span>
                    <span className="text-lg font-bold text-primary">{formatPrice(selectedOrder.total)}</span>
                  </div>
                </div>
              </div>

              {selectedOrder.notes && (
                <>
                  <Separator />
                  <div className="space-y-2 bg-primary/5 p-4 rounded-xl border border-primary/10">
                    <p className="text-[10px] font-bold text-primary uppercase tracking-[0.1em]">Notas / Observações</p>
                    <p className="text-sm text-foreground/80 font-medium italic leading-relaxed">
                      "{selectedOrder.notes}"
                    </p>
                  </div>
                </>
              )}

              <Separator />

              {/* Status Progress */}
              <div className="space-y-3">
                <p className="text-sm font-semibold">Progresso do Pedido</p>
                {selectedOrder.status === "cancelado" ? (
                  <div className="flex items-center gap-2 text-destructive bg-destructive/10 p-2 rounded-md">
                    <XCircle className="h-5 w-5" />
                    <span className="text-sm font-medium">Pedido Cancelado</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between relative px-2 py-4">
                    <div className="absolute top-8 left-6 right-6 h-0.5 bg-muted rounded-full">
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
                          <span className={`text-[10px] mt-2 ${isCompleted ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                            {info.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Atualizar Status</p>
                <div className="flex gap-2 flex-wrap">
                  {(Object.keys(ORDER_STATUS_MAP) as OrderStatus[]).map((status) => {
                    const info = ORDER_STATUS_MAP[status];
                    const isCurrent = selectedOrder.status === status;
                    return (
                      <Button
                        key={status}
                        variant={isCurrent ? "default" : "outline"}
                        size="sm"
                        className="h-8 text-xs"
                        disabled={isCurrent || updateStatus.isPending}
                        onClick={() => updateStatus.mutate({ orderId: selectedOrder.id, status })}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full mr-1.5 ${info.color}`} />
                        {info.label}
                      </Button>
                    );
                  })}
                </div>
              </div>

              {/* Actions */}
              <div className="pt-6 grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 h-10 border-primary/20 hover:bg-primary/5 hover:text-primary transition-all font-semibold"
                  onClick={() => handlePrintLabel(selectedOrder)}
                >
                  <Package className="h-4 w-4" />
                  Etiqueta
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 h-10 border-primary/20 hover:bg-primary/5 hover:text-primary transition-all font-semibold"
                  onClick={() => handlePrintReceipt(selectedOrder)}
                >
                  <FileText className="h-4 w-4" />
                  Recibo (Nota)
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="col-span-2 gap-2 h-10 font-semibold"
                  onClick={() => {
                    const text = `Olá ${selectedOrder.customer_name}! Seu pedido #${selectedOrder.id.slice(0, 8)} na ${storeSettings?.store_name || "nossa loja"} foi recebido e está sendo processado! 🚀`;
                    window.open(`https://wa.me/${selectedOrder.customer_phone?.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`, "_blank");
                  }}
                >
                  <Share2 className="h-4 w-4" />
                  Enviar p/ WhatsApp
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
