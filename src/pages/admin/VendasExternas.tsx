import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useProducts } from "@/hooks/useProducts";
import { PlanGate } from "@/components/PlanGate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Trash2, ShoppingBag, DollarSign, TrendingUp, Package, Search, Calendar } from "lucide-react";
import { format } from "date-fns";

interface SaleItem {
  product_id?: string;
  product_name: string;
  quantity: number;
  unit_price: number;
}

function useManualSales() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["manual_sales", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("manual_sales" as any)
        .select("*")
        .eq("user_id", user!.id)
        .order("sale_date", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
  });
}

export default function VendasExternas() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: sales, isLoading } = useManualSales();
  const { data: products } = useProducts();
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState("");

  // Form state
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [items, setItems] = useState<SaleItem[]>([{ product_name: "", quantity: 1, unit_price: 0 }]);
  const [paymentMethod, setPaymentMethod] = useState("dinheiro");
  const [status, setStatus] = useState("concluido");
  const [notes, setNotes] = useState("");
  const [saleDate, setSaleDate] = useState(new Date().toISOString().slice(0, 16));
  const [saving, setSaving] = useState(false);

  const createSale = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");
      if (!customerName.trim()) throw new Error("Nome do cliente obrigatório");
      if (items.length === 0 || !items[0].product_name.trim()) throw new Error("Adicione pelo menos um item");

      const total = items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0);

      const { error } = await supabase.from("manual_sales" as any).insert({
        user_id: user.id,
        customer_name: customerName.trim().slice(0, 200),
        customer_email: customerEmail.trim().slice(0, 255) || null,
        customer_phone: customerPhone.trim().slice(0, 30) || null,
        items: items.map(i => ({
          product_id: i.product_id || null,
          product_name: i.product_name.slice(0, 200),
          quantity: Math.max(1, i.quantity),
          unit_price: Math.max(0, i.unit_price),
        })),
        total,
        payment_method: paymentMethod,
        status,
        notes: notes.trim().slice(0, 1000) || null,
        sale_date: saleDate || new Date().toISOString(),
      } as any);

      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["manual_sales"] });
      toast.success("Venda registrada com sucesso!");
      resetForm();
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteSale = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("manual_sales" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["manual_sales"] });
      toast.success("Venda removida");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const resetForm = () => {
    setCustomerName("");
    setCustomerEmail("");
    setCustomerPhone("");
    setItems([{ product_name: "", quantity: 1, unit_price: 0 }]);
    setPaymentMethod("dinheiro");
    setStatus("concluido");
    setNotes("");
    setSaleDate(new Date().toISOString().slice(0, 16));
  };

  const addItem = () => setItems([...items, { product_name: "", quantity: 1, unit_price: 0 }]);
  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));
  const updateItem = (idx: number, field: keyof SaleItem, value: any) => {
    const updated = [...items];
    (updated[idx] as any)[field] = value;
    setItems(updated);
  };

  const selectProduct = (idx: number, productId: string) => {
    const p = products?.find((pr: any) => pr.id === productId);
    if (p) {
      const updated = [...items];
      updated[idx] = { product_id: p.id, product_name: p.name, quantity: 1, unit_price: p.price };
      setItems(updated);
    }
  };

  const formTotal = items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0);

  // Filtered sales
  const filteredSales = useMemo(() => {
    if (!sales) return [];
    return sales.filter((s: any) => {
      const matchSearch = !searchTerm || 
        s.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.customer_email?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchDate = !dateFilter || (s.sale_date && s.sale_date.startsWith(dateFilter));
      return matchSearch && matchDate;
    });
  }, [sales, searchTerm, dateFilter]);

  // Stats
  const totalRevenue = filteredSales.reduce((sum: number, s: any) => sum + (s.total || 0), 0);
  const totalSales = filteredSales.length;
  const avgTicket = totalSales > 0 ? totalRevenue / totalSales : 0;

  const paymentLabels: Record<string, string> = {
    dinheiro: "Dinheiro",
    pix: "PIX",
    cartao_credito: "Cartão Crédito",
    cartao_debito: "Cartão Débito",
    transferencia: "Transferência",
    boleto: "Boleto",
    outro: "Outro",
  };

  const statusLabels: Record<string, string> = {
    concluido: "Concluído",
    pendente: "Pendente",
    cancelado: "Cancelado",
  };

  return (
    <PlanGate requiredPlan="starter">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ShoppingBag className="h-6 w-6 text-primary" />
              Vendas Externas
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Registre vendas feitas fora do site para gestão completa</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Nova Venda
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Registrar Venda Externa</DialogTitle>
              </DialogHeader>
              <form
                onSubmit={(e) => { e.preventDefault(); createSale.mutate(); }}
                className="space-y-4"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Nome do Cliente *</Label>
                    <Input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="João Silva" required maxLength={200} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Telefone</Label>
                    <Input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="(11) 99999-0000" maxLength={30} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>E-mail</Label>
                  <Input type="email" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} placeholder="cliente@email.com" maxLength={255} />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">Itens da Venda</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addItem} className="gap-1">
                      <Plus className="h-3 w-3" /> Item
                    </Button>
                  </div>
                  {items.map((item, idx) => (
                    <div key={idx} className="border rounded-lg p-3 space-y-2 bg-muted/30">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">Item {idx + 1}</span>
                        {items.length > 1 && (
                          <Button type="button" variant="ghost" size="sm" onClick={() => removeItem(idx)}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        )}
                      </div>
                      {products && products.length > 0 && (
                        <Select onValueChange={(v) => selectProduct(idx, v)}>
                          <SelectTrigger className="h-9 text-xs">
                            <SelectValue placeholder="Selecionar do catálogo (opcional)" />
                          </SelectTrigger>
                          <SelectContent>
                            {products.map((p: any) => (
                              <SelectItem key={p.id} value={p.id}>{p.name} — R$ {p.price?.toFixed(2)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      <Input
                        placeholder="Nome do produto/serviço"
                        value={item.product_name}
                        onChange={e => updateItem(idx, "product_name", e.target.value)}
                        required
                        maxLength={200}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">Qtd</Label>
                          <Input type="number" min={1} value={item.quantity} onChange={e => updateItem(idx, "quantity", parseInt(e.target.value) || 1)} />
                        </div>
                        <div>
                          <Label className="text-xs">Preço Unit. (R$)</Label>
                          <Input type="number" min={0} step={0.01} value={item.unit_price} onChange={e => updateItem(idx, "unit_price", parseFloat(e.target.value) || 0)} />
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="text-right text-sm font-bold text-primary">
                    Total: R$ {formTotal.toFixed(2)}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Pagamento</Label>
                    <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(paymentLabels).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Status</Label>
                    <Select value={status} onValueChange={setStatus}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(statusLabels).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Data da Venda</Label>
                  <Input type="datetime-local" value={saleDate} onChange={e => setSaleDate(e.target.value)} />
                </div>

                <div className="space-y-1.5">
                  <Label>Observações</Label>
                  <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Anotações opcionais..." maxLength={1000} rows={2} />
                </div>

                <Button type="submit" className="w-full" disabled={createSale.isPending}>
                  {createSale.isPending ? "Salvando..." : "Registrar Venda"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4 pb-3 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                <DollarSign className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Receita Total</p>
                <p className="text-lg font-bold">R$ {totalRevenue.toFixed(2)}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Package className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total de Vendas</p>
                <p className="text-lg font-bold">{totalSales}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                <TrendingUp className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Ticket Médio</p>
                <p className="text-lg font-bold">R$ {avgTicket.toFixed(2)}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar por cliente..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input type="date" className="pl-9 w-full sm:w-44" value={dateFilter} onChange={e => setDateFilter(e.target.value)} />
          </div>
        </div>

        {/* Sales Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">Carregando...</div>
            ) : filteredSales.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <ShoppingBag className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p>Nenhuma venda externa registrada</p>
                <p className="text-xs mt-1">Clique em "Nova Venda" para começar</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Itens</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Pagamento</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSales.map((sale: any) => {
                      const saleItems = Array.isArray(sale.items) ? sale.items : [];
                      return (
                        <TableRow key={sale.id}>
                          <TableCell className="text-xs whitespace-nowrap">
                            {sale.sale_date ? format(new Date(sale.sale_date), "dd/MM/yy HH:mm") : "-"}
                          </TableCell>
                          <TableCell>
                            <div className="font-medium text-sm">{sale.customer_name}</div>
                            {sale.customer_phone && <div className="text-xs text-muted-foreground">{sale.customer_phone}</div>}
                          </TableCell>
                          <TableCell className="text-xs">
                            {saleItems.length > 0
                              ? saleItems.map((i: any, idx: number) => (
                                  <div key={idx}>{i.quantity}x {i.product_name}</div>
                                ))
                              : "-"}
                          </TableCell>
                          <TableCell className="font-semibold text-sm">
                            R$ {(sale.total || 0).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-xs">
                            {paymentLabels[sale.payment_method] || sale.payment_method}
                          </TableCell>
                          <TableCell>
                            <Badge variant={sale.status === "concluido" ? "default" : sale.status === "pendente" ? "secondary" : "destructive"} className="text-[10px]">
                              {statusLabels[sale.status] || sale.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (confirm("Excluir esta venda?")) deleteSale.mutate(sale.id);
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
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
      </div>
    </PlanGate>
  );
}
