import { useState } from "react";
import { useAllPlans } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Edit, Plus, CreditCard, Zap, Brain, Ticket, Truck, Image, Globe } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const FEATURE_FLAGS = [
  { key: "gateway", label: "Gateway de Pagamento", icon: Zap, description: "Pagamentos via cartão, PIX, boleto" },
  { key: "ai_tools", label: "Ferramentas de IA", icon: Brain, description: "Descrições SEO, sugestão de preço, chat IA" },
  { key: "coupons", label: "Cupons de Desconto", icon: Ticket, description: "Criar e gerenciar cupons" },
  { key: "shipping_zones", label: "Zonas de Frete", icon: Truck, description: "Frete por região/CEP" },
  { key: "banners", label: "Banners", icon: Image, description: "Carrossel de banners na loja" },
  { key: "custom_domain", label: "Domínio Personalizado", icon: Globe, description: "Usar domínio próprio" },
];

export default function SuperAdminPlanos() {
  const { data: plans, isLoading } = useAllPlans();
  const queryClient = useQueryClient();
  const [editPlan, setEditPlan] = useState<any>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [maxProducts, setMaxProducts] = useState("50");
  const [maxOrders, setMaxOrders] = useState("100");
  const [active, setActive] = useState(true);
  const [features, setFeatures] = useState<Record<string, boolean>>({
    gateway: false,
    ai_tools: false,
    coupons: true,
    shipping_zones: true,
    banners: true,
    custom_domain: false,
  });

  const openEdit = (plan: any) => {
    setEditPlan(plan);
    setName(plan.name);
    setPrice(String(plan.price));
    setMaxProducts(String(plan.max_products));
    setMaxOrders(String(plan.max_orders_month));
    setActive(plan.active);
    const planFeatures = (plan.features as Record<string, boolean>) || {};
    setFeatures({
      gateway: planFeatures.gateway ?? false,
      ai_tools: planFeatures.ai_tools ?? false,
      coupons: planFeatures.coupons ?? true,
      shipping_zones: planFeatures.shipping_zones ?? true,
      banners: planFeatures.banners ?? true,
      custom_domain: planFeatures.custom_domain ?? false,
    });
    setFormOpen(true);
  };

  const openNew = () => {
    setEditPlan(null);
    setName(""); setPrice(""); setMaxProducts("50"); setMaxOrders("100"); setActive(true);
    setFeatures({ gateway: false, ai_tools: false, coupons: true, shipping_zones: true, banners: true, custom_domain: false });
    setFormOpen(true);
  };

  const handleSave = async () => {
    const payload = {
      name: name.trim(),
      price: parseFloat(price) || 0,
      max_products: parseInt(maxProducts) || 50,
      max_orders_month: parseInt(maxOrders) || 100,
      active,
      features,
    };

    if (editPlan) {
      const { error } = await supabase.from("tenant_plans").update(payload as any).eq("id", editPlan.id);
      if (error) toast.error("Erro: " + error.message);
      else toast.success("Plano atualizado!");
    } else {
      const { error } = await supabase.from("tenant_plans").insert(payload as any);
      if (error) toast.error("Erro: " + error.message);
      else toast.success("Plano criado!");
    }
    queryClient.invalidateQueries({ queryKey: ["tenant_plans"] });
    setFormOpen(false);
  };

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  if (isLoading) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Planos</h1>
          <p className="text-muted-foreground">Gerenciar planos e funcionalidades dos tenants</p>
        </div>
        <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> Novo Plano</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {plans?.map((plan) => {
          const planFeatures = (plan.features as Record<string, boolean>) || {};
          return (
            <Card key={plan.id} className={`border-border ${!plan.active ? "opacity-50" : ""}`}>
              <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">{plan.name}</CardTitle>
                </div>
                <Button variant="ghost" size="icon" onClick={() => openEdit(plan)}>
                  <Edit className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-3xl font-bold">{formatCurrency(plan.price)}<span className="text-sm text-muted-foreground font-normal">/mês</span></p>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>Até {plan.max_products >= 9999 ? "∞" : plan.max_products} produtos</p>
                  <p>Até {plan.max_orders_month >= 9999 ? "∞" : plan.max_orders_month} pedidos/mês</p>
                </div>
                <Separator />
                <div className="flex flex-wrap gap-1">
                  {FEATURE_FLAGS.map((f) => (
                    <Badge key={f.key} variant={planFeatures[f.key] ? "default" : "secondary"} className="text-[10px]">
                      {planFeatures[f.key] ? "✓" : "✗"} {f.label}
                    </Badge>
                  ))}
                </div>
                {!plan.active && <Badge variant="secondary">Desativado</Badge>}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editPlan ? "Editar Plano" : "Novo Plano"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do plano" />
            </div>
            <div className="space-y-2">
              <Label>Preço (R$/mês)</Label>
              <Input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Máx. Produtos</Label>
                <Input type="number" value={maxProducts} onChange={(e) => setMaxProducts(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Máx. Pedidos/mês</Label>
                <Input type="number" value={maxOrders} onChange={(e) => setMaxOrders(e.target.value)} />
              </div>
            </div>

            <Separator />
            <Label className="text-base font-semibold">Funcionalidades do Plano</Label>
            <div className="space-y-3">
              {FEATURE_FLAGS.map((f) => (
                <div key={f.key} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div className="flex items-center gap-3">
                    <f.icon className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{f.label}</p>
                      <p className="text-xs text-muted-foreground">{f.description}</p>
                    </div>
                  </div>
                  <Switch checked={features[f.key] ?? false} onCheckedChange={(checked) => setFeatures((prev) => ({ ...prev, [f.key]: checked }))} />
                </div>
              ))}
            </div>

            <Separator />
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <Label>Plano Ativo</Label>
              <Switch checked={active} onCheckedChange={setActive} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave}>{editPlan ? "Salvar" : "Criar"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
