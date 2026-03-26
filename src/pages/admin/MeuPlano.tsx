import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";
import { useAllPlans } from "@/hooks/useUserRole";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Crown, ArrowUp, ArrowDown, Zap, Package, ShoppingCart, Sparkles, Shield, Globe, Clock, Loader2 } from "lucide-react";
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
};

const FEATURE_LABELS: Record<string, string> = {
  gateway: "Gateway de Pagamento",
  ai_tools: "Ferramentas de IA",
  coupons: "Cupons",
  shipping_zones: "Zonas de Frete",
  banners: "Banners",
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

  // Check for pending plan change request
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
          ? "Solicitação de upgrade enviada! Aguarde aprovação do administrador."
          : "Solicitação de downgrade enviada! Aguarde aprovação do administrador."
      );
      setConfirmDialog(null);
    },
    onError: (e: any) => {
      toast.error("Erro ao solicitar: " + e.message);
    },
  });

  const currentPlan = currentSub?.tenant_plans as any;
  const currentPrice = currentPlan?.price ?? 0;

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(price);

  const sortedPlans = allPlans?.sort((a, b) => a.price - b.price) ?? [];

  // Calculate time elapsed since pending request
  const getElapsedTime = (createdAt: string) => {
    const diff = Date.now() - new Date(createdAt).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `${hours}h ${minutes}min`;
    return `${minutes}min`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Meu Plano</h1>
        <p className="text-muted-foreground">Gerencie sua assinatura e funcionalidades</p>
      </div>

      {/* Pending request card */}
      {pendingRequest && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10 animate-pulse">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-amber-700">⏳ Aguardando Aprovação</p>
                <p className="text-sm text-muted-foreground">
                  Sua solicitação de {pendingRequest.request_type === "upgrade" ? "upgrade" : "downgrade"} para o plano{" "}
                  <strong>{(pendingRequest as any).requested_plan?.name || "—"}</strong> está sendo analisada pelo administrador.
                </p>
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Enviada há {getElapsedTime(pendingRequest.created_at)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Current plan summary */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-primary" />
              Plano Atual: {currentPlan?.name || "Nenhum"}
            </CardTitle>
            {currentSub?.status && (
              <Badge variant={currentSub.status === "active" ? "default" : "secondary"}>
                {currentSub.status === "active" ? "Ativo" : currentSub.status === "trial" ? "Período de Teste" : currentSub.status}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 rounded-lg bg-background">
              <p className="text-2xl font-bold text-primary">{features.max_products}</p>
              <p className="text-xs text-muted-foreground">Produtos</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-background">
              <p className="text-2xl font-bold text-primary">{features.max_orders_month}</p>
              <p className="text-xs text-muted-foreground">Pedidos/mês</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-background">
              <p className="text-2xl font-bold text-primary">{formatPrice(currentPrice)}</p>
              <p className="text-xs text-muted-foreground">Por mês</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-background">
              <p className="text-2xl font-bold text-primary">
                {currentSub?.current_period_end
                  ? new Date(currentSub.current_period_end).toLocaleDateString("pt-BR")
                  : "—"}
              </p>
              <p className="text-xs text-muted-foreground">Próximo ciclo</p>
            </div>
          </div>

          {/* Current features */}
          <div className="mt-4 flex flex-wrap gap-2">
            {Object.entries(FEATURE_LABELS).map(([key, label]) => {
              const enabled = (features as any)[key];
              return (
                <Badge key={key} variant={enabled ? "default" : "outline"} className={enabled ? "" : "opacity-50"}>
                  {enabled ? <Check className="h-3 w-3 mr-1" /> : null}
                  {label}
                </Badge>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Available plans */}
      <div>
        <h2 className="text-lg font-bold mb-4">Planos Disponíveis</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedPlans.map((plan) => {
            const isCurrent = currentPlan?.id === plan.id;
            const isUpgrade = plan.price > currentPrice;
            const isDowngrade = plan.price < currentPrice;
            const planFeatures = (plan.features as Record<string, any>) || {};
            const hasPendingForThis = pendingRequest?.requested_plan_id === plan.id;

            return (
              <Card
                key={plan.id}
                className={`relative transition-all duration-300 hover:shadow-lg ${
                  isCurrent ? "border-primary ring-2 ring-primary/20" : hasPendingForThis ? "border-amber-500 ring-2 ring-amber-500/20" : "border-border hover:border-primary/40"
                }`}
              >
                {isCurrent && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground shadow-sm">Plano Atual</Badge>
                  </div>
                )}
                {hasPendingForThis && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-amber-500 text-white shadow-sm animate-pulse">⏳ Pendente</Badge>
                  </div>
                )}

                <CardHeader className="pb-2 pt-6">
                  <CardTitle className="text-center">
                    <span className="text-lg">{plan.name}</span>
                    <div className="mt-2">
                      <span className="text-3xl font-bold text-primary">{formatPrice(plan.price)}</span>
                      <span className="text-sm text-muted-foreground">/mês</span>
                    </div>
                  </CardTitle>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between py-1 border-b border-border/50">
                      <span className="text-muted-foreground">Produtos</span>
                      <span className="font-medium">{plan.max_products}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border/50">
                      <span className="text-muted-foreground">Pedidos/mês</span>
                      <span className="font-medium">{plan.max_orders_month}</span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    {Object.entries(FEATURE_LABELS).map(([key, label]) => {
                      const enabled = planFeatures[key] ?? false;
                      const Icon = FEATURE_ICONS[key] || Check;
                      return (
                        <div key={key} className={`flex items-center gap-2 text-sm ${enabled ? "text-foreground" : "text-muted-foreground/50 line-through"}`}>
                          <Icon className={`h-3.5 w-3.5 ${enabled ? "text-green-500" : ""}`} />
                          {label}
                        </div>
                      );
                    })}
                  </div>

                  {!isCurrent && !hasPendingForThis && (
                    <Button
                      className="w-full"
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
                        <>
                          <ArrowUp className="mr-1 h-4 w-4" /> Solicitar Upgrade
                        </>
                      ) : (
                        <>
                          <ArrowDown className="mr-1 h-4 w-4" /> Solicitar Downgrade
                        </>
                      )}
                    </Button>
                  )}
                  {hasPendingForThis && (
                    <Button className="w-full" variant="outline" disabled>
                      <Clock className="mr-1 h-4 w-4 animate-spin" /> Aguardando...
                    </Button>
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
            <DialogTitle>
              {confirmDialog?.type === "upgrade" ? "Solicitar Upgrade" : "Solicitar Downgrade"}
            </DialogTitle>
            <DialogDescription>
              {confirmDialog?.type === "upgrade" ? (
                <>
                  Sua solicitação de upgrade para <strong>{confirmDialog.planName}</strong> ({formatPrice(confirmDialog.price)}/mês)
                  será enviada ao administrador para aprovação.
                </>
              ) : (
                <>
                  Sua solicitação de downgrade para <strong>{confirmDialog?.planName}</strong> ({formatPrice(confirmDialog?.price ?? 0)}/mês)
                  será enviada ao administrador para aprovação.
                </>
              )}
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
