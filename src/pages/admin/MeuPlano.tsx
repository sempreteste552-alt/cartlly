import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";
import { useAllPlans } from "@/hooks/useUserRole";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Crown, ArrowUp, ArrowDown, Zap, Package, ShoppingCart, Sparkles, Shield, Globe } from "lucide-react";
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

  const changePlan = useMutation({
    mutationFn: async ({ planId, type }: { planId: string; type: "upgrade" | "downgrade" }) => {
      if (!currentSub) {
        // Create subscription
        const { error } = await supabase.from("tenant_subscriptions").insert({
          user_id: user!.id,
          plan_id: planId,
          status: "active",
        });
        if (error) throw error;
      } else {
        if (type === "upgrade") {
          const { error } = await supabase
            .from("tenant_subscriptions")
            .update({ plan_id: planId, status: "active", updated_at: new Date().toISOString() })
            .eq("id", currentSub.id);
          if (error) throw error;
        } else {
          // Downgrade: schedule for next period
          const { error } = await supabase
            .from("tenant_subscriptions")
            .update({ plan_id: planId, updated_at: new Date().toISOString() })
            .eq("id", currentSub.id);
          if (error) throw error;
        }
      }
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["my_subscription"] });
      queryClient.invalidateQueries({ queryKey: ["plan_features"] });
      toast.success(
        vars.type === "upgrade"
          ? "Plano atualizado com sucesso! Novas funcionalidades já estão ativas."
          : "Downgrade agendado para o próximo ciclo."
      );
      setConfirmDialog(null);
    },
    onError: () => {
      toast.error("Erro ao alterar plano");
    },
  });

  const currentPlan = currentSub?.tenant_plans as any;
  const currentPrice = currentPlan?.price ?? 0;

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(price);

  const sortedPlans = allPlans?.sort((a, b) => a.price - b.price) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Meu Plano</h1>
        <p className="text-muted-foreground">Gerencie sua assinatura e funcionalidades</p>
      </div>

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

            return (
              <Card
                key={plan.id}
                className={`relative transition-all duration-300 hover:shadow-lg ${
                  isCurrent ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-primary/40"
                }`}
              >
                {isCurrent && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground shadow-sm">Plano Atual</Badge>
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

                  {!isCurrent && (
                    <Button
                      className="w-full"
                      variant={isUpgrade ? "default" : "outline"}
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
                          <ArrowUp className="mr-1 h-4 w-4" /> Fazer Upgrade
                        </>
                      ) : (
                        <>
                          <ArrowDown className="mr-1 h-4 w-4" /> Fazer Downgrade
                        </>
                      )}
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
              {confirmDialog?.type === "upgrade" ? "Confirmar Upgrade" : "Confirmar Downgrade"}
            </DialogTitle>
            <DialogDescription>
              {confirmDialog?.type === "upgrade" ? (
                <>
                  Seu plano será atualizado imediatamente para <strong>{confirmDialog.planName}</strong> ({formatPrice(confirmDialog.price)}/mês).
                  As novas funcionalidades ficam disponíveis agora.
                </>
              ) : (
                <>
                  Seu plano será alterado para <strong>{confirmDialog?.planName}</strong> ({formatPrice(confirmDialog?.price ?? 0)}/mês)
                  no próximo ciclo de cobrança.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog(null)}>Cancelar</Button>
            <Button
              onClick={() => confirmDialog && changePlan.mutate({ planId: confirmDialog.planId, type: confirmDialog.type })}
              disabled={changePlan.isPending}
            >
              {changePlan.isPending ? "Processando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
