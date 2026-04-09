import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Ticket, Trash2, Pencil, Loader2, Sparkles, Wand2, Lock } from "lucide-react";
import { useCoupons, useCreateCoupon, useUpdateCoupon, useDeleteCoupon } from "@/hooks/useCoupons";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";
import { LockedFeature } from "@/components/LockedFeature";


interface AISuggestion {
  campaign_name: string;
  code: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  min_order_value?: number;
  max_uses?: number;
  validity_days: number;
  target_audience: string;
  reason: string;
}

export default function Cupons() {
  const { user } = useAuth();
  const { data: coupons, isLoading } = useCoupons();
  const createCoupon = useCreateCoupon();
  const updateCoupon = useUpdateCoupon();
  const deleteCoupon = useDeleteCoupon();
  const { features, isLocked } = usePlanFeatures();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestion[]>([]);
  const [showAiPanel, setShowAiPanel] = useState(false);

  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState("percentage");
  const [discountValue, setDiscountValue] = useState("");
  const [minOrderValue, setMinOrderValue] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [active, setActive] = useState(true);

  const openNew = () => {
    setEditing(null);
    setCode(""); setDiscountType("percentage"); setDiscountValue(""); setMinOrderValue("");
    setMaxUses(""); setExpiresAt(""); setActive(true);
    setFormOpen(true);
  };

  const openEdit = (c: any) => {
    setEditing(c);
    setCode(c.code);
    setDiscountType(c.discount_type);
    setDiscountValue(String(c.discount_value));
    setMinOrderValue(c.min_order_value ? String(c.min_order_value) : "");
    setMaxUses(c.max_uses ? String(c.max_uses) : "");
    setExpiresAt(c.expires_at ? c.expires_at.slice(0, 16) : "");
    setActive(c.active);
    setFormOpen(true);
  };

  const handleSave = () => {
    const payload = {
      code: code.toUpperCase().trim(),
      discount_type: discountType,
      discount_value: parseFloat(discountValue) || 0,
      min_order_value: parseFloat(minOrderValue) || 0,
      max_uses: maxUses ? parseInt(maxUses) : null,
      expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
      active,
    };
    if (editing) {
      updateCoupon.mutate({ id: editing.id, ...payload }, { onSuccess: () => setFormOpen(false) });
    } else {
      createCoupon.mutate(payload, { onSuccess: () => setFormOpen(false) });
    }
  };

  const handleAISuggest = async () => {
    setAiLoading(true);
    setShowAiPanel(true);
    try {
      // Gather store context
      const { data: products } = await supabase.from("products").select("id, category_id").eq("user_id", user!.id);
      const { data: orders } = await supabase.from("orders").select("total, created_at").eq("user_id", user!.id);
      const { data: categories } = await supabase.from("categories").select("name").eq("user_id", user!.id);
      const { data: customers } = await supabase.from("customers").select("id").eq("store_user_id", user!.id);
      const { data: settings } = await supabase.from("store_settings").select("store_name").eq("user_id", user!.id).maybeSingle();

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthOrders = orders?.filter(o => new Date(o.created_at) >= monthStart) || [];
      const monthRevenue = monthOrders.reduce((s, o) => s + Number(o.total), 0);
      const avgTicket = orders?.length ? orders.reduce((s, o) => s + Number(o.total), 0) / orders.length : 0;

      const { data, error } = await supabase.functions.invoke("ai-smart-coupons", {
        body: {
          action: "suggest_campaigns",
          storeContext: {
            storeName: settings?.store_name || "Minha Loja",
            totalProducts: products?.length || 0,
            categories: categories?.map(c => c.name) || [],
            monthlyOrders: monthOrders.length,
            monthlyRevenue: monthRevenue,
            avgTicket,
            activeCoupons: coupons?.filter((c: any) => c.active).length || 0,
            totalCustomers: customers?.length || 0,
          },
        },
      });

      if (error) throw error;
      setAiSuggestions(data.suggestions || []);
    } catch (e: any) {
      toast.error("Erro ao gerar sugestões: " + (e.message || "Erro desconhecido"));
    } finally {
      setAiLoading(false);
    }
  };

  const applySuggestion = (s: AISuggestion) => {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + s.validity_days);

    setEditing(null);
    setCode(s.code);
    setDiscountType(s.discount_type);
    setDiscountValue(String(s.discount_value));
    setMinOrderValue(s.min_order_value ? String(s.min_order_value) : "");
    setMaxUses(s.max_uses ? String(s.max_uses) : "");
    setExpiresAt(expiryDate.toISOString().slice(0, 16));
    setActive(true);
    setFormOpen(true);
    toast.success(`Campanha "${s.campaign_name}" aplicada! Revise e salve.`);
  };

  const formatPrice = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  if (isLoading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const aiContent = (
    <div className="space-y-6">
      {/* AI Suggestions Panel */}
      {showAiPanel && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-foreground">Sugestões da IA</h3>
              <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setShowAiPanel(false)}>Fechar</Button>
            </div>
            {aiLoading ? (
              <div className="flex items-center justify-center py-8 gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Analisando sua loja e gerando campanhas...</span>
              </div>
            ) : aiSuggestions.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">Nenhuma sugestão gerada. Tente novamente.</p>
            ) : (
              <div className="grid gap-3">
                {aiSuggestions.map((s, i) => (
                  <div key={i} className="rounded-lg border border-border bg-card p-4 space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium text-foreground">{s.campaign_name}</h4>
                        <Badge variant="outline" className="mt-1 font-mono">{s.code}</Badge>
                      </div>
                      <Button size="sm" onClick={() => applySuggestion(s)}>
                        <Wand2 className="mr-1 h-3 w-3" /> Usar
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">{s.reason}</p>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <Badge variant="secondary">
                        {s.discount_type === "percentage" ? `${s.discount_value}%` : formatPrice(s.discount_value)}
                      </Badge>
                      <Badge variant="secondary">{s.validity_days} dias</Badge>
                      <Badge variant="secondary">🎯 {s.target_audience}</Badge>
                      {s.min_order_value && <Badge variant="secondary">Mín. {formatPrice(s.min_order_value)}</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );

  return (
    <LockedFeature isLocked={isLocked("coupons")} featureName="Cupons de Desconto">
    <div className="space-y-6">
      <div id="coupons-header" className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Cupons de Desconto</h1>
          <p className="text-muted-foreground">Crie e gerencie cupons para sua loja</p>
        </div>
        <div className="flex gap-2">
          {isLocked("ai_tools") ? (
            <Button variant="outline" disabled title="Faça upgrade do plano para usar Sugestões IA">
              <Lock className="mr-2 h-4 w-4" />
              Sugestões IA
            </Button>
          ) : (
            <Button variant="outline" onClick={handleAISuggest} disabled={aiLoading}>
              <Sparkles className="mr-2 h-4 w-4" />
              {aiLoading ? "Gerando..." : "Sugestões IA"}
            </Button>
          )}
          <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> Novo Cupom</Button>
        </div>
      </div>

      {aiContent}

      {!coupons?.length ? (
        <Card className="border-border">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Ticket className="h-12 w-12 text-muted-foreground/40" />
            <h3 className="mt-4 text-lg font-medium">Nenhum cupom</h3>
            <p className="mt-1 text-sm text-muted-foreground">Crie seu primeiro cupom de desconto</p>
            <Button className="mt-4" size="sm" onClick={openNew}><Plus className="mr-2 h-4 w-4" /> Criar Cupom</Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Desconto</TableHead>
                <TableHead>Mín. Pedido</TableHead>
                <TableHead>Usos</TableHead>
                <TableHead>Validade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coupons.map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono font-bold">{c.code}</TableCell>
                  <TableCell>
                    {c.discount_type === "percentage" ? `${c.discount_value}%` : formatPrice(c.discount_value)}
                  </TableCell>
                  <TableCell>{c.min_order_value > 0 ? formatPrice(c.min_order_value) : "—"}</TableCell>
                  <TableCell>{c.used_count}{c.max_uses ? ` / ${c.max_uses}` : ""}</TableCell>
                  <TableCell>
                    {c.expires_at ? (
                      <span className={new Date(c.expires_at) < new Date() ? "text-destructive" : ""}>
                        {new Date(c.expires_at).toLocaleDateString("pt-BR")}
                      </span>
                    ) : "Sem limite"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={c.active ? "default" : "secondary"}>{c.active ? "Ativo" : "Inativo"}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setDeleteId(c.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Form Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar Cupom" : "Novo Cupom"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Código *</Label>
              <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="DESCONTO10" maxLength={30} className="font-mono" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={discountType} onValueChange={setDiscountType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Porcentagem (%)</SelectItem>
                    <SelectItem value="fixed">Valor fixo (R$)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Valor *</Label>
                <Input type="number" step="0.01" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} placeholder={discountType === "percentage" ? "10" : "25.00"} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valor mín. pedido</Label>
                <Input type="number" step="0.01" value={minOrderValue} onChange={(e) => setMinOrderValue(e.target.value)} placeholder="0.00" />
              </div>
              <div className="space-y-2">
                <Label>Máx. de usos</Label>
                <Input type="number" value={maxUses} onChange={(e) => setMaxUses(e.target.value)} placeholder="Ilimitado" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Data de expiração</Label>
              <Input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <Label>Ativo</Label>
              <Switch checked={active} onCheckedChange={setActive} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave}>{editing ? "Salvar" : "Criar"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover cupom?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { deleteCoupon.mutate(deleteId!); setDeleteId(null); }} className="bg-destructive text-destructive-foreground">Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </LockedFeature>
  );
}
