import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { 
  ShoppingCart, Loader2, Eye, Clock, MessageSquare, Package, Truck, CheckCircle, 
  XCircle, Copy, FileText, Download, Search, Calendar as CalendarIcon, Printer,
  Filter, FileSpreadsheet, FileJson, Share2, Info, Gift, TrendingUp, DollarSign, AlertCircle
} from "lucide-react";
import { useOrders, useOrderItems, useOrderStatusHistory, useOrderPayment, useUpdateOrderStatus, ORDER_STATUS_MAP, type OrderStatus } from "@/hooks/useOrders";
import { useStoreSettings } from "@/hooks/useStoreSettings";
import { supabase } from "@/integrations/supabase/client";
import { format, isWithinInterval, startOfDay, endOfDay, formatDistanceToNow } from "date-fns";
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
import { useRolePermissions } from "@/components/RoleGate";

export default function Pedidos() {
  const { isViewer } = useRolePermissions();
  const { t } = useTranslation();
  const STATUS_ICONS: Record<string, any> = {
    pendente: Clock, processando: Package, enviado: Truck, entregue: CheckCircle, cancelado: XCircle,
  };
  const STATUS_STEPS: OrderStatus[] = ["pendente", "processando", "enviado", "entregue"];

  const { data: orders, isLoading } = useOrders();
  const { data: storeSettings } = useStoreSettings();
  
  const { data: abandonedCarts } = useQuery({
    queryKey: ["abandoned_carts_admin", storeSettings?.user_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("abandoned_carts")
        .select("*")
        .eq("user_id", storeSettings?.user_id)
        .eq("recovered", false)
        .order("abandoned_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!storeSettings?.user_id,
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

  const customerIds = useMemo(() => [...new Set(abandonedCarts?.map(c => (c as any).customer_id).filter(Boolean) || [])], [abandonedCarts]);
  const { data: customerData } = useQuery({
    queryKey: ["abandoned_customer_names", customerIds.join(",")],
    queryFn: async () => {
      if (customerIds.length === 0) return {};
      const { data } = await supabase.from("customers").select("id, name, email, phone").in("id", customerIds as string[]);
      const map: Record<string, any> = {};
      (data || []).forEach(c => { map[c.id] = c; });
      return map;
    },
    enabled: customerIds.length > 0,
  });

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

  // KPIs profissionais
  const kpis = useMemo(() => {
    const list = orders || [];
    const totalRevenue = list
      .filter((o: any) => {
        const ps = o.payments?.[0]?.status;
        return ps === "approved" || ps === "paid";
      })
      .reduce((acc: number, o: any) => acc + Number(o.total || 0), 0);
    const pending = list.filter((o: any) => o.status === "pendente").length;
    const processing = list.filter((o: any) => o.status === "processando").length;
    const shipped = list.filter((o: any) => o.status === "enviado").length;
    const delivered = list.filter((o: any) => o.status === "entregue").length;
    return { total: list.length, totalRevenue, pending, processing, shipped, delivered };
  }, [orders]);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* HEADER PROFISSIONAL */}
      <div id="orders-header" className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/[0.07] via-card to-purple-500/[0.04] p-5 sm:p-6">
        <div className="absolute -top-20 -right-20 h-48 w-48 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-lg shadow-primary/25">
              <ShoppingCart className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">Vendas e Carrinhos</h1>
              <p className="text-muted-foreground text-xs sm:text-sm">Acompanhe seus pedidos e recupere vendas perdidas</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {!isViewer && (
              <Button variant="outline" size="sm" className="gap-2" onClick={() => setIsPrinterDialogOpen(true)}>
                <Printer className="h-4 w-4" />
                <span className="hidden sm:inline">Impressora</span>
              </Button>
            )}
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

        {/* KPIs */}
        <div className="relative grid grid-cols-2 lg:grid-cols-5 gap-2.5 mt-5">
          <KpiTile icon={TrendingUp} label="Pedidos" value={kpis.total} tone="primary" />
          <KpiTile icon={DollarSign} label="Receita Aprovada" value={formatPrice(kpis.totalRevenue)} tone="emerald" />
          <KpiTile icon={Clock} label="Pendentes" value={kpis.pending} tone="amber" pulse={kpis.pending > 0} />
          <KpiTile icon={Truck} label="Enviados" value={kpis.shipped} tone="sky" />
          <KpiTile icon={CheckCircle} label="Entregues" value={kpis.delivered} tone="green" />
        </div>
      </div>

      <Tabs defaultValue="pedidos" className="space-y-6">
        <TabsList className="bg-muted/50 p-1">
          <TabsTrigger value="pedidos" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Package className="h-4 w-4" />
            Pedidos
          </TabsTrigger>
          <TabsTrigger value="carrinhos" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <ShoppingCart className="h-4 w-4" />
            Carrinhos Abandonados
            {abandonedCarts && abandonedCarts.length > 0 && (
              <Badge variant="secondary" className="h-5 px-1.5 ml-1 text-[10px] bg-primary/10 text-primary border-0">
                {abandonedCarts.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pedidos" className="space-y-6 animate-in fade-in-50 duration-300">
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
        </TabsContent>

        <TabsContent value="carrinhos" className="space-y-6 animate-in fade-in-50 duration-300">
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-primary" />
                Recuperação de Vendas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!abandonedCarts?.length ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <CheckCircle className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-medium text-foreground">Tudo limpo!</h3>
                  <p className="text-sm text-muted-foreground max-w-xs">Não há carrinhos abandonados no momento. Bom trabalho!</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Produtos</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Abandonado em</TableHead>
                        <TableHead>Lembretes</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {abandonedCarts.map((cart: any) => {
                        const customer = (customerData as any)?.[cart.customer_id];
                        const items = Array.isArray(cart.items) ? cart.items : [];
                        const timeSince = formatDistanceToNow(new Date(cart.abandoned_at), { locale: ptBR, addSuffix: true });
                        
                        return (
                          <TableRow key={cart.id}>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-medium">{customer?.name || "Cliente"}</span>
                                <span className="text-[10px] text-muted-foreground">{customer?.phone || customer?.email || "—"}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="text-xs">{items.length} item(s)</span>
                              <p className="text-[10px] text-muted-foreground truncate max-w-[150px]">
                                {items.slice(0, 2).map((i: any) => i.name).join(", ")}
                              </p>
                            </TableCell>
                            <TableCell className="font-medium text-sm">{formatPrice(cart.total)}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{timeSince}</TableCell>
                            <TableCell>
                              <Badge variant={cart.reminder_sent_count > 0 ? "default" : "outline"} className="text-[10px]">
                                {cart.reminder_sent_count}/5
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1.5">
                                {!isViewer && (
                                  <Button 
                                    variant="outline" 
                                    size="icon" 
                                    className="h-8 w-8 text-green-600 border-green-200 bg-green-50 hover:bg-green-100" 
                                    onClick={() => {
                                      if (!customer?.phone) {
                                        toast.error("Cliente sem telefone.");
                                        return;
                                      }
                                      const storeName = storeSettings?.store_name || "nossa loja";
                                      const itemNames = items.slice(0, 2).map((i: any) => i.name).join(", ");
                                      const text = `Olá ${customer.name}! Notamos que você deixou alguns itens no carrinho na ${storeName} (${itemNames}). Gostaria de finalizar sua compra?`;
                                      window.open(`https://wa.me/${customer.phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`, "_blank");
                                    }}
                                    title="Recuperar via WhatsApp"
                                  >
                                    <MessageSquare className="h-4 w-4" />
                                  </Button>
                                )}
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                                  toast.info(`Itens: ${items.map((i: any) => `${i.quantity}x ${i.name}`).join(", ")}`);
                                }}>
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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
              <div className="flex items-center justify-between">
                <Label htmlFor="auto-print">Impressão automática</Label>
                <Switch id="auto-print" />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="print-label">Sempre gerar etiqueta</Label>
                <Switch id="print-label" defaultChecked />
              </div>
            </div>
            <Button className="w-full" variant="outline">Detectar Impressoras</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Order Details Dialog */}
      <Dialog open={!!selectedOrderId} onOpenChange={(open) => !open && setSelectedOrderId(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedOrder && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <DialogTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Pedido #{selectedOrder.id.slice(0, 8)}
                  </DialogTitle>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePrintLabel(selectedOrder)}
                    >
                      <Printer className="h-4 w-4 mr-2" />
                      Etiqueta
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePrintReceipt(selectedOrder)}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Recibo
                    </Button>
                  </div>
                </div>
              </DialogHeader>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
                {/* Customer Info */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Cliente</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm space-y-1">
                    <p className="font-semibold">{selectedOrder.customer_name}</p>
                    <p className="text-muted-foreground">{selectedOrder.customer_email || "—"}</p>
                    <p className="text-muted-foreground">{selectedOrder.customer_phone || "—"}</p>
                    <p className="text-muted-foreground">{selectedOrder.customer_cpf || "—"}</p>
                  </CardContent>
                </Card>

                {/* Shipping Info */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Entrega</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm space-y-1">
                    <p>{selectedOrder.shipping_street}, {selectedOrder.shipping_number}</p>
                    <p>{selectedOrder.shipping_neighborhood}, {selectedOrder.shipping_city} - {selectedOrder.shipping_state}</p>
                    <p>{selectedOrder.shipping_cep}</p>
                    {selectedOrder.shipping_complement && <p className="text-xs text-muted-foreground">({selectedOrder.shipping_complement})</p>}
                    <Badge variant="outline" className="mt-2">{selectedOrder.shipping_method}</Badge>
                  </CardContent>
                </Card>

                {/* Payment Info */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Pagamento</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subtotal:</span>
                      <span>{formatPrice(selectedOrder.total - (selectedOrder.shipping_cost || 0) + (selectedOrder.discount_amount || 0))}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Frete:</span>
                      <span>{formatPrice(selectedOrder.shipping_cost || 0)}</span>
                    </div>
                    {selectedOrder.discount_amount > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span className="text-muted-foreground">Desconto:</span>
                        <span>-{formatPrice(selectedOrder.discount_amount)}</span>
                      </div>
                    )}
                    <Separator />
                    <div className="flex justify-between font-bold text-lg">
                      <span>Total:</span>
                      <span className="text-primary">{formatPrice(selectedOrder.total)}</span>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <Badge variant={(orderPayment as any)?.status === "approved" || (orderPayment as any)?.status === "paid" ? "default" : "secondary"}>
                        {(orderPayment as any)?.status === "approved" || (orderPayment as any)?.status === "paid" ? "✅ Aprovado" : "⏳ Pendente"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{(orderPayment as any)?.method || "—"}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Internal Actions */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Status & Ações</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(ORDER_STATUS_MAP).map(([status, info]) => {
                        const isCurrent = selectedOrder.status === status;
                        return (
                          <Button
                            key={status}
                            variant={isCurrent ? "default" : "outline"}
                            size="sm"
                            className="h-8 text-xs"
                            disabled={isCurrent || updateStatus.isPending}
                            onClick={() => updateStatus.mutate({ orderId: selectedOrder.id, status: status as OrderStatus })}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full mr-1.5 ${info.color}`} />
                            {info.label}
                          </Button>
                        );
                      })}
                    </div>
                    <div className="pt-2">
                      <Button
                        variant="secondary"
                        className="w-full gap-2 h-10 font-semibold"
                        onClick={() => {
                          const text = `Olá ${selectedOrder.customer_name}! Seu pedido #${selectedOrder.id.slice(0, 8)} na ${storeSettings?.store_name || "nossa loja"} foi recebido e está sendo processado! 🚀`;
                          window.open(`https://wa.me/${selectedOrder.customer_phone?.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`, "_blank");
                        }}
                      >
                        <MessageSquare className="h-4 w-4" />
                        Avisar no WhatsApp
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Order Items */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Itens do Pedido</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produto</TableHead>
                        <TableHead>Qtd</TableHead>
                        <TableHead>Preço</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orderItems?.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="text-sm font-medium">{item.product_name}</TableCell>
                          <TableCell className="text-sm">{item.quantity}</TableCell>
                          <TableCell className="text-sm">{formatPrice(item.unit_price)}</TableCell>
                          <TableCell className="text-right text-sm font-bold">{formatPrice(item.unit_price * item.quantity)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

