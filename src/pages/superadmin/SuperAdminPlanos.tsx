import { useState } from "react";
import { useAllPlans } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Edit, Plus, CreditCard, Zap, Brain, Ticket, Truck, Image, Globe, CheckCircle, XCircle, Clock, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const FEATURE_FLAGS = [
  { key: "gateway", label: "Gateway de Pagamento", icon: Zap, description: "Pagamentos via cartão, PIX, boleto" },
  { key: "ai_tools", label: "Ferramentas de IA", icon: Brain, description: "Descrições SEO, sugestão de preço, chat IA" },
  { key: "coupons", label: "Cupons de Desconto", icon: Ticket, description: "Criar e gerenciar cupons" },
  { key: "shipping_zones", label: "Zonas de Frete", icon: Truck, description: "Frete por região/CEP" },
  { key: "banners", label: "Banners", icon: Image, description: "Carrossel de banners na loja" },
  { key: "custom_domain", label: "Domínio Personalizado", icon: Globe, description: "Usar domínio próprio" },
];

export default function SuperAdminPlanos() {
  const { user } = useAuth();
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

  // Fetch pending plan change requests
  const { data: pendingRequests } = useQuery({
    queryKey: ["plan_change_requests_pending"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plan_change_requests")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;

      // Enrich with tenant name and plan names
      const enriched = [];
      for (const req of (data || [])) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("display_name")
          .eq("user_id", (req as any).user_id)
          .maybeSingle();

        const { data: reqPlan } = await supabase
          .from("tenant_plans")
          .select("name")
          .eq("id", (req as any).requested_plan_id)
          .maybeSingle();

        const { data: curPlan } = (req as any).current_plan_id
          ? await supabase.from("tenant_plans").select("name").eq("id", (req as any).current_plan_id).maybeSingle()
          : { data: null };

        enriched.push({
          ...req,
          tenant_name: profile?.display_name || "Desconhecido",
          requested_plan_name: reqPlan?.name || "—",
          current_plan_name: curPlan?.name || "Grátis",
        });
      }
      return enriched;
    },
  });

  const handleApproveRequest = async (request: any) => {
    try {
      // Update the tenant's subscription
      const { data: existingSub } = await supabase
        .from("tenant_subscriptions")
        .select("id")
        .eq("user_id", request.user_id)
        .maybeSingle();

      if (existingSub) {
        const { error } = await supabase
          .from("tenant_subscriptions")
          .update({ plan_id: request.requested_plan_id, status: "active", updated_at: new Date().toISOString() } as any)
          .eq("id", existingSub.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("tenant_subscriptions")
          .insert({ user_id: request.user_id, plan_id: request.requested_plan_id, status: "active" } as any);
        if (error) throw error;
      }

      // Mark request as approved
      const { error: updateErr } = await supabase
        .from("plan_change_requests")
        .update({ status: "approved", resolved_at: new Date().toISOString(), resolved_by: user!.id } as any)
        .eq("id", request.id);
      if (updateErr) throw updateErr;

      // Notify tenant
      await supabase.from("admin_notifications").insert({
        sender_user_id: user!.id,
        target_user_id: request.user_id,
        title: "✅ Plano Aprovado!",
        message: `Sua solicitação de ${request.request_type} para o plano ${request.requested_plan_name} foi aprovada!`,
        type: "plan_approved",
      } as any);

      toast.success("Solicitação aprovada! Plano do tenant atualizado.");
      queryClient.invalidateQueries({ queryKey: ["plan_change_requests_pending"] });
      queryClient.invalidateQueries({ queryKey: ["all_tenants"] });
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    }
  };

  const handleRejectRequest = async (request: any) => {
    try {
      const { error } = await supabase
        .from("plan_change_requests")
        .update({ status: "rejected", resolved_at: new Date().toISOString(), resolved_by: user!.id } as any)
        .eq("id", request.id);
      if (error) throw error;

      // Notify tenant
      await supabase.from("admin_notifications").insert({
        sender_user_id: user!.id,
        target_user_id: request.user_id,
        title: "❌ Solicitação Recusada",
        message: `Sua solicitação de ${request.request_type} para o plano ${request.requested_plan_name} foi recusada.`,
        type: "plan_rejected",
      } as any);

      toast.success("Solicitação recusada.");
      queryClient.invalidateQueries({ queryKey: ["plan_change_requests_pending"] });
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    }
  };

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

      {/* Pending Plan Change Requests */}
      {pendingRequests && pendingRequests.length > 0 && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-600" />
              Solicitações Pendentes ({pendingRequests.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingRequests.map((req: any) => (
              <div key={req.id} className="flex items-center justify-between p-3 rounded-lg bg-background border border-border">
                <div className="flex items-center gap-3">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full ${req.request_type === "upgrade" ? "bg-green-500/10" : "bg-orange-500/10"}`}>
                    {req.request_type === "upgrade" ? (
                      <ArrowUp className="h-4 w-4 text-green-600" />
                    ) : (
                      <ArrowDown className="h-4 w-4 text-orange-600" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{req.tenant_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {req.current_plan_name} → {req.requested_plan_name}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(req.created_at).toLocaleString("pt-BR")}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => handleApproveRequest(req)}
                  >
                    <CheckCircle className="mr-1 h-3 w-3" /> Aprovar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-destructive text-destructive"
                    onClick={() => handleRejectRequest(req)}
                  >
                    <XCircle className="mr-1 h-3 w-3" /> Recusar
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

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
