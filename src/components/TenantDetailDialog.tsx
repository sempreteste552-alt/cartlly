import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Store, Package, ShoppingCart, CreditCard, Users, Eye, Ban, Unlock,
  CheckCircle, Clock, XCircle, Sparkles, Truck, Image, Globe, Tag,
  MessageCircle, Settings, BarChart3,
} from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface TenantDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenant: any;
}

export function TenantDetailDialog({ open, onOpenChange, tenant }: TenantDetailDialogProps) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [storeSettings, setStoreSettings] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Feature toggles from subscription plan
  const [features, setFeatures] = useState<Record<string, boolean>>({
    gateway: false,
    ai_tools: false,
    coupons: true,
    shipping_zones: true,
    banners: true,
    custom_domain: false,
    whatsapp_sales: true,
    reviews: true,
  });

  useEffect(() => {
    if (open && tenant) {
      loadTenantData();
    }
  }, [open, tenant]);

  const loadTenantData = async () => {
    if (!tenant) return;
    setLoadingData(true);
    try {
      const [storeRes, prodRes, ordRes, custRes] = await Promise.all([
        supabase.from("store_settings").select("*").eq("user_id", tenant.user_id).maybeSingle(),
        supabase.from("products").select("id, name, price, stock, published, image_url").eq("user_id", tenant.user_id).order("created_at", { ascending: false }).limit(10),
        supabase.from("orders").select("id, total, status, created_at, customer_name").eq("user_id", tenant.user_id).order("created_at", { ascending: false }).limit(10),
        supabase.from("customers").select("id, name, email, created_at").eq("store_user_id", tenant.user_id).order("created_at", { ascending: false }).limit(10),
      ]);

      setStoreSettings(storeRes.data);
      setProducts(prodRes.data || []);
      setOrders(ordRes.data || []);
      setCustomers(custRes.data || []);

      // Load features from plan
      if (tenant.subscription?.tenant_plans) {
        const planFeatures = (tenant.subscription.tenant_plans as any)?.features || {};
        setFeatures((prev) => ({ ...prev, ...planFeatures }));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingData(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    setLoading(true);
    const { error } = await supabase
      .from("profiles")
      .update({ status: newStatus } as any)
      .eq("user_id", tenant.user_id);
    if (error) {
      toast.error("Erro: " + error.message);
    } else {
      toast.success(`Status alterado para ${newStatus}`);
      // Notify tenant
      try {
        await supabase.functions.invoke("notify-tenant-status", {
          body: { userId: tenant.user_id, action: newStatus },
        });
      } catch (e) {}
      queryClient.invalidateQueries({ queryKey: ["all_tenants"] });
    }
    setLoading(false);
  };

  const handleFeatureToggle = async (key: string, value: boolean) => {
    if (!tenant.subscription) {
      toast.error("Tenant precisa ter um plano atribuído para alterar funcionalidades.");
      return;
    }

    const updatedFeatures = { ...features, [key]: value };
    setFeatures(updatedFeatures);

    // Update plan features
    const { error } = await supabase
      .from("tenant_plans")
      .update({ features: updatedFeatures } as any)
      .eq("id", tenant.subscription.plan_id);

    if (error) {
      toast.error("Erro ao atualizar: " + error.message);
      setFeatures((prev) => ({ ...prev, [key]: !value }));
    } else {
      toast.success(`${key} ${value ? "habilitado" : "desabilitado"}`);
      queryClient.invalidateQueries({ queryKey: ["all_tenants"] });
      queryClient.invalidateQueries({ queryKey: ["plan_features"] });
    }
  };

  const formatPrice = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending": return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/30"><Clock className="mr-1 h-3 w-3" />Pendente</Badge>;
      case "rejected": return <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" />Rejeitado</Badge>;
      case "blocked": return <Badge variant="destructive"><Ban className="mr-1 h-3 w-3" />Bloqueado</Badge>;
      default: return <Badge className="bg-green-600 text-white"><CheckCircle className="mr-1 h-3 w-3" />Aprovado</Badge>;
    }
  };

  if (!tenant) return null;

  const featureItems = [
    { key: "gateway", label: "Gateway de Pagamento", icon: CreditCard, desc: "Mercado Pago, PagBank etc." },
    { key: "ai_tools", label: "Ferramentas de IA", icon: Sparkles, desc: "Sugestões, catálogo IA, chat" },
    { key: "coupons", label: "Cupons de Desconto", icon: Tag, desc: "Criar e gerenciar cupons" },
    { key: "shipping_zones", label: "Zonas de Frete", icon: Truck, desc: "Frete por CEP personalizado" },
    { key: "banners", label: "Banners da Loja", icon: Image, desc: "Carrossel de banners" },
    { key: "custom_domain", label: "Domínio Personalizado", icon: Globe, desc: "Conectar domínio próprio" },
    { key: "whatsapp_sales", label: "Vendas via WhatsApp", icon: MessageCircle, desc: "Botão de compra pelo WhatsApp" },
    { key: "reviews", label: "Avaliações", icon: BarChart3, desc: "Avaliações de clientes nos produtos" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Store className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-lg font-bold">{tenant.display_name || "Sem nome"}</p>
              <p className="text-sm text-muted-foreground font-normal">
                {storeSettings?.store_name || tenant.store?.store_name || "Sem loja"}
                {storeSettings?.store_slug && ` • /${storeSettings.store_slug}`}
              </p>
            </div>
            <div className="ml-auto">{getStatusBadge(tenant.status)}</div>
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="overview" className="mt-2">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="features">Funcionalidades</TabsTrigger>
            <TabsTrigger value="data">Dados</TabsTrigger>
            <TabsTrigger value="actions">Ações</TabsTrigger>
          </TabsList>

          {/* Overview */}
          <TabsContent value="overview" className="space-y-4 mt-4">
            {loadingData ? (
              <div className="space-y-3"><Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" /></div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Card><CardContent className="p-4 text-center">
                    <Package className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                    <p className="text-2xl font-bold">{products.length}</p>
                    <p className="text-xs text-muted-foreground">Produtos</p>
                  </CardContent></Card>
                  <Card><CardContent className="p-4 text-center">
                    <ShoppingCart className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                    <p className="text-2xl font-bold">{tenant.orders?.count || 0}</p>
                    <p className="text-xs text-muted-foreground">Pedidos</p>
                  </CardContent></Card>
                  <Card><CardContent className="p-4 text-center">
                    <CreditCard className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                    <p className="text-2xl font-bold">{formatPrice(tenant.orders?.revenue || 0)}</p>
                    <p className="text-xs text-muted-foreground">Faturamento</p>
                  </CardContent></Card>
                  <Card><CardContent className="p-4 text-center">
                    <Users className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                    <p className="text-2xl font-bold">{customers.length}</p>
                    <p className="text-xs text-muted-foreground">Clientes</p>
                  </CardContent></Card>
                </div>

                {/* Store info */}
                {storeSettings && (
                  <Card>
                    <CardContent className="p-4 space-y-2">
                      <h4 className="font-semibold flex items-center gap-2"><Settings className="h-4 w-4" /> Configurações da Loja</h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div><span className="text-muted-foreground">Nome:</span> {storeSettings.store_name}</div>
                        <div><span className="text-muted-foreground">Slug:</span> /{storeSettings.store_slug || "—"}</div>
                        <div><span className="text-muted-foreground">Telefone:</span> {storeSettings.store_phone || "—"}</div>
                        <div><span className="text-muted-foreground">WhatsApp:</span> {storeSettings.store_whatsapp || "—"}</div>
                        <div><span className="text-muted-foreground">Loja aberta:</span> {storeSettings.store_open ? "Sim ✅" : "Não ❌"}</div>
                        <div><span className="text-muted-foreground">Gateway:</span> {storeSettings.payment_gateway || "Nenhum"}</div>
                      </div>
                      {storeSettings.store_slug && (
                        <Button variant="outline" size="sm" className="mt-2" onClick={() => window.open(`/loja/${storeSettings.store_slug}`, "_blank")}>
                          <Eye className="mr-2 h-3 w-3" /> Ver Loja
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Plan info */}
                <Card>
                  <CardContent className="p-4">
                    <h4 className="font-semibold mb-2">Plano</h4>
                    {tenant.subscription?.tenant_plans ? (
                      <div className="text-sm space-y-1">
                        <p><span className="text-muted-foreground">Nome:</span> <strong>{(tenant.subscription.tenant_plans as any)?.name}</strong></p>
                        <p><span className="text-muted-foreground">Preço:</span> {formatPrice((tenant.subscription.tenant_plans as any)?.price || 0)}/mês</p>
                        <p><span className="text-muted-foreground">Status:</span> <Badge variant="outline">{tenant.subscription.status}</Badge></p>
                        <p><span className="text-muted-foreground">Max produtos:</span> {(tenant.subscription.tenant_plans as any)?.max_products}</p>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Nenhum plano atribuído</p>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* Features */}
          <TabsContent value="features" className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              Habilite ou desabilite funcionalidades para este tenant. {!tenant.subscription && "(Atribua um plano primeiro)"}
            </p>
            <div className="space-y-3">
              {featureItems.map((item) => (
                <Card key={item.key}>
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                        <item.icon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{item.label}</p>
                        <p className="text-xs text-muted-foreground">{item.desc}</p>
                      </div>
                    </div>
                    <Switch
                      checked={features[item.key] ?? false}
                      onCheckedChange={(v) => handleFeatureToggle(item.key, v)}
                      disabled={!tenant.subscription}
                    />
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Data */}
          <TabsContent value="data" className="space-y-4 mt-4">
            {loadingData ? (
              <Skeleton className="h-40" />
            ) : (
              <>
                {/* Recent products */}
                <Card>
                  <CardContent className="p-4">
                    <h4 className="font-semibold mb-3 flex items-center gap-2"><Package className="h-4 w-4" /> Produtos Recentes</h4>
                    {products.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nenhum produto</p>
                    ) : (
                      <div className="space-y-2">
                        {products.slice(0, 5).map((p) => (
                          <div key={p.id} className="flex items-center gap-3 text-sm">
                            {p.image_url ? (
                              <img src={p.image_url} alt={p.name} className="h-8 w-8 rounded object-cover" />
                            ) : (
                              <div className="h-8 w-8 rounded bg-muted flex items-center justify-center"><Package className="h-3 w-3" /></div>
                            )}
                            <span className="flex-1 truncate">{p.name}</span>
                            <span className="font-medium">{formatPrice(p.price)}</span>
                            <Badge variant={p.published ? "default" : "secondary"} className="text-xs">
                              {p.published ? "Ativo" : "Rascunho"}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Recent orders */}
                <Card>
                  <CardContent className="p-4">
                    <h4 className="font-semibold mb-3 flex items-center gap-2"><ShoppingCart className="h-4 w-4" /> Pedidos Recentes</h4>
                    {orders.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nenhum pedido</p>
                    ) : (
                      <div className="space-y-2">
                        {orders.slice(0, 5).map((o) => (
                          <div key={o.id} className="flex items-center gap-3 text-sm">
                            <span className="flex-1">{o.customer_name}</span>
                            <span className="font-medium">{formatPrice(o.total)}</span>
                            <Badge variant="outline" className="text-xs">{o.status}</Badge>
                            <span className="text-xs text-muted-foreground">{formatDate(o.created_at)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Recent customers */}
                <Card>
                  <CardContent className="p-4">
                    <h4 className="font-semibold mb-3 flex items-center gap-2"><Users className="h-4 w-4" /> Clientes Recentes</h4>
                    {customers.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nenhum cliente</p>
                    ) : (
                      <div className="space-y-2">
                        {customers.slice(0, 5).map((c) => (
                          <div key={c.id} className="flex items-center gap-3 text-sm">
                            <span className="flex-1">{c.name}</span>
                            <span className="text-muted-foreground">{c.email}</span>
                            <span className="text-xs text-muted-foreground">{formatDate(c.created_at)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* Actions */}
          <TabsContent value="actions" className="space-y-4 mt-4">
            <Card>
              <CardContent className="p-4 space-y-4">
                <h4 className="font-semibold">Gerenciar Status da Conta</h4>
                <p className="text-sm text-muted-foreground">
                  Status atual: {getStatusBadge(tenant.status)}
                </p>
                <Separator />
                <div className="grid grid-cols-2 gap-3">
                  {tenant.status !== "approved" && (
                    <Button
                      className="bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => handleStatusChange("approved")}
                      disabled={loading}
                    >
                      <CheckCircle className="mr-2 h-4 w-4" /> Aprovar
                    </Button>
                  )}
                  {tenant.status !== "blocked" && (
                    <Button
                      variant="destructive"
                      onClick={() => handleStatusChange("blocked")}
                      disabled={loading}
                    >
                      <Ban className="mr-2 h-4 w-4" /> Bloquear
                    </Button>
                  )}
                  {(tenant.status === "blocked" || tenant.status === "rejected") && (
                    <Button
                      variant="outline"
                      onClick={() => handleStatusChange("approved")}
                      disabled={loading}
                    >
                      <Unlock className="mr-2 h-4 w-4" /> Desbloquear
                    </Button>
                  )}
                  {tenant.status === "pending" && (
                    <Button
                      variant="outline"
                      className="border-red-300 text-red-600"
                      onClick={() => handleStatusChange("rejected")}
                      disabled={loading}
                    >
                      <XCircle className="mr-2 h-4 w-4" /> Rejeitar
                    </Button>
                  )}
                </div>

                <Separator />

                <h4 className="font-semibold">Ações Rápidas</h4>
                <div className="grid grid-cols-2 gap-3">
                  {storeSettings?.store_slug && (
                    <Button variant="outline" size="sm" onClick={() => window.open(`/loja/${storeSettings.store_slug}`, "_blank")}>
                      <Eye className="mr-2 h-3 w-3" /> Ver Loja
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      onOpenChange(false);
                      // The parent will handle opening the plan dialog
                    }}
                  >
                    <CreditCard className="mr-2 h-3 w-3" /> Gerenciar Plano
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
