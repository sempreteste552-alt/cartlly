import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";
import { useAllPlans } from "@/hooks/useUserRole";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Crown, ArrowUp, ArrowDown, Zap, Package, ShoppingCart, Sparkles, Shield, Globe, Clock, Loader2, Star, Rocket } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

const FEATURE_ICONS: Record<string, any> = {
  gateway: Zap,
  ai_tools: Sparkles,
  coupons: Package,
  shipping_zones: ShoppingCart,
  banners: Globe,
  custom_domain: Shield,
  whatsapp_sales: Shield,
  reviews: Star,
};

const FEATURE_LABELS: Record<string, string> = {
  gateway: "Gateway de Pagamento",
  ai_tools: "Ferramentas de IA",
  coupons: "Cupons de Desconto",
  shipping_zones: "Zonas de Frete",
  banners: "Banners da Loja",
  custom_domain: "Domínio Personalizado",
};

export default function MeuPlano() {
  const { user } = useAuth();
  const { features } = usePlanFeatures();
  const { data: allPlans } = useAllPlans();
  const queryClient = useQueryClient();
  const [confirmDialog, setConfirmDialog] = useState<{ planId: string; planName: string; price: number; type: "upgrade" | "downgrade" } | null>(null);

  const { data: currentSub } = useQuery({
    queryKey: ["my_subscription", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_subscriptions")
        .select("*, tenant_plans(*)")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: pendingRequest } = useQuery({
    queryKey: ["pending_plan_request", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plan_change_requests")
        .select("*, requested_plan:tenant_plans!plan_change_requests_requested_plan_id_fkey(*)")
        .eq("user_id", user!.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const requestChange = useMutation({
    mutationFn: async ({ planId, type }: { planId: string; type: "upgrade" | "downgrade" }) => {
      const { error } = await supabase.from("plan_change_requests").insert({
        user_id: user!.id,
        current_plan_id: currentSub?.plan_id || null,
        requested_plan_id: planId,
        request_type: type,
      } as any);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["pending_plan_request"] });
      toast.success(
        vars.type === "upgrade"
          ? "⬆️ Solicitação de upgrade enviada! Aguarde aprovação."
          : "⬇️ Solicitação de downgrade enviada! Aguarde aprovação."
      );
      setConfirmDialog(null);
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  const currentPlan = currentSub?.tenant_plans as any;
  const currentPrice = currentPlan?.price ?? 0;

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(price);

  const sortedPlans = allPlans?.sort((a, b) => a.price - b.price) ?? [];

  const getElapsedTime = (createdAt: string) => {
    const diff = Date.now() - new Date(createdAt).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes}min`;
    return `${minutes}min`;
  };

  const statusLabel = currentSub?.status === "active" ? "Ativo" : currentSub?.status === "trial" ? "Teste" : currentSub?.status || "—";
  const statusColor = currentSub?.status === "active" ? "bg-green-500" : currentSub?.status === "trial" ? "bg-amber-500" : "bg-muted";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Crown className="h-6 w-6 text-primary" /> Meu Plano
        </h1>
        <p className="text-muted-foreground">Gerencie sua assinatura e funcionalidades</p>
      </div>

      {/* Pending request banner */}
      {pendingRequest && (
        <Card className="border-amber-500/50 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent overflow-hidden relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/15 shrink-0">
                <Clock className="h-6 w-6 text-amber-600 animate-pulse" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-amber-700 text-lg">⏳ Aguardando Aprovação</p>
                <p className="text-sm text-muted-foreground">
                  Sua solicitação de {pendingRequest.request_type === "upgrade" ? "upgrade" : "downgrade"} para{" "}
                  <strong className="text-foreground">{(pendingRequest as any).requested_plan?.name || "—"}</strong> está em análise.
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="outline" className="border-amber-500/50 text-amber-700 text-xs">
                    <Clock className="h-3 w-3 mr-1" /> Há {getElapsedTime(pendingRequest.created_at)}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Current plan hero */}
      <Card className="border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent overflow-hidden relative shadow-lg">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-primary/5 rounded-full translate-y-1/2 -translate-x-1/2" />
        <CardHeader className="pb-3 relative">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-3 text-xl">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
                <Rocket className="h-5 w-5 text-primary" />
              </div>
              {currentPlan?.name || "Nenhum Plano"}
            </CardTitle>
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${statusColor} animate-pulse`} />
              <span className="text-sm font-medium text-muted-foreground">{statusLabel}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="relative">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { value: String(features.max_products), label: "Produtos", icon: Package },
              { value: String(features.max_orders_month), label: "Pedidos/mês", icon: ShoppingCart },
              { value: formatPrice(currentPrice), label: "Mensalidade", icon: Crown },
              { value: currentSub?.current_period_end ? new Date(currentSub.current_period_end).toLocaleDateString("pt-BR") : "—", label: "Próx. ciclo", icon: Clock },
            ].map((item) => (
              <div key={item.label} className="text-center p-4 rounded-xl bg-background/80 backdrop-blur border border-border/50 shadow-sm hover:shadow-md transition-shadow">
                <item.icon className="h-4 w-4 mx-auto text-primary mb-1" />
                <p className="text-xl font-bold text-primary">{item.value}</p>
                <p className="text-xs text-muted-foreground">{item.label}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {Object.entries(FEATURE_LABELS).map(([key, label]) => {
              const enabled = (features as any)[key];
              const Icon = FEATURE_ICONS[key] || Check;
              return (
                <Badge
                  key={key}
                  variant={enabled ? "default" : "outline"}
                  className={`transition-all ${enabled ? "shadow-sm" : "opacity-40"}`}
                >
                  {enabled ? <Check className="h-3 w-3 mr-1" /> : <Icon className="h-3 w-3 mr-1" />}
                  {label}
                </Badge>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Plans grid */}
      <div>
        <h2 className="text-lg font-bold mb-5 flex items-center gap-2">
          <Star className="h-5 w-5 text-primary" /> Planos Disponíveis
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {sortedPlans.map((plan, idx) => {
            const isCurrent = currentPlan?.id === plan.id;
            const isUpgrade = plan.price > currentPrice;
            const planFeatures = (plan.features as Record<string, any>) || {};
            const hasPendingForThis = pendingRequest?.requested_plan_id === plan.id;
            const isPopular = idx === Math.floor(sortedPlans.length / 2);

            return (
              <Card
                key={plan.id}
                className={`relative transition-all duration-300 hover:shadow-xl hover:-translate-y-1 group ${
                  isCurrent
                    ? "border-primary ring-2 ring-primary/20 shadow-lg shadow-primary/10"
                    : hasPendingForThis
                    ? "border-amber-500 ring-2 ring-amber-500/20"
                    : "border-border hover:border-primary/40"
                }`}
              >
                {isCurrent && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                    <Badge className="bg-primary text-primary-foreground shadow-lg px-4">✨ Plano Atual</Badge>
                  </div>
                )}
                {hasPendingForThis && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                    <Badge className="bg-amber-500 text-white shadow-lg animate-pulse px-4">⏳ Pendente</Badge>
                  </div>
                )}
                {isPopular && !isCurrent && !hasPendingForThis && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                    <Badge className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-lg px-4">🔥 Popular</Badge>
                  </div>
                )}

                <CardHeader className="pb-2 pt-7 text-center">
                  <CardTitle>
                    <span className="text-lg font-bold">{plan.name}</span>
                    <div className="mt-3">
                      <span className="text-4xl font-black text-primary">{formatPrice(plan.price)}</span>
                      <span className="text-sm text-muted-foreground font-normal">/mês</span>
                    </div>
                  </CardTitle>
                </CardHeader>

                <CardContent className="space-y-5 pb-6">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="text-center p-3 rounded-lg bg-muted/50">
                      <p className="text-lg font-bold text-foreground">{plan.max_products}</p>
                      <p className="text-xs text-muted-foreground">Produtos</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-muted/50">
                      <p className="text-lg font-bold text-foreground">{plan.max_orders_month}</p>
                      <p className="text-xs text-muted-foreground">Pedidos</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {Object.entries(FEATURE_LABELS).map(([key, label]) => {
                      const enabled = planFeatures[key] ?? false;
                      const Icon = FEATURE_ICONS[key] || Check;
                      return (
                        <div key={key} className={`flex items-center gap-2 text-sm py-1 ${enabled ? "text-foreground" : "text-muted-foreground/40 line-through"}`}>
                          {enabled ? (
                            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-green-100">
                              <Check className="h-3 w-3 text-green-600" />
                            </div>
                          ) : (
                            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-muted">
                              <Icon className="h-3 w-3" />
                            </div>
                          )}
                          {label}
                        </div>
                      );
                    })}
                  </div>

                  {!isCurrent && !hasPendingForThis && (
                    <Button
                      className={`w-full transition-all ${isUpgrade ? "shadow-md hover:shadow-lg" : ""}`}
                      variant={isUpgrade ? "default" : "outline"}
                      disabled={!!pendingRequest}
                      onClick={() =>
                        setConfirmDialog({
                          planId: plan.id,
                          planName: plan.name,
                          price: plan.price,
                          type: isUpgrade ? "upgrade" : "downgrade",
                        })
                      }
                    >
                      {isUpgrade ? (
                        <><ArrowUp className="mr-1 h-4 w-4" /> Solicitar Upgrade</>
                      ) : (
                        <><ArrowDown className="mr-1 h-4 w-4" /> Solicitar Downgrade</>
                      )}
                    </Button>
                  )}
                  {hasPendingForThis && (
                    <Button className="w-full" variant="outline" disabled>
                      <Clock className="mr-1 h-4 w-4 animate-spin" /> Aguardando...
                    </Button>
                  )}
                  {isCurrent && (
                    <div className="text-center text-sm text-primary font-medium">Seu plano atual</div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Confirmation dialog */}
      <Dialog open={!!confirmDialog} onOpenChange={() => setConfirmDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {confirmDialog?.type === "upgrade" ? <ArrowUp className="h-5 w-5 text-primary" /> : <ArrowDown className="h-5 w-5" />}
              {confirmDialog?.type === "upgrade" ? "Solicitar Upgrade" : "Solicitar Downgrade"}
            </DialogTitle>
            <DialogDescription>
              Sua solicitação de {confirmDialog?.type} para <strong>{confirmDialog?.planName}</strong> ({formatPrice(confirmDialog?.price ?? 0)}/mês)
              será enviada ao administrador para aprovação.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog(null)}>Cancelar</Button>
            <Button
              onClick={() => confirmDialog && requestChange.mutate({ planId: confirmDialog.planId, type: confirmDialog.type })}
              disabled={requestChange.isPending}
            >
              {requestChange.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Enviar Solicitação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
