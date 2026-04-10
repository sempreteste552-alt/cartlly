import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTenantContext } from "@/hooks/useTenantContext";
import { useAllPlans } from "@/hooks/useUserRole";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Check, Crown, Zap, Clock, Loader2, Rocket,
  Lock, ArrowUpCircle, Package, CheckCircle2,
  BarChart3, Palette, ShoppingCart, Bot, Code, Shield,
  Gift, Users, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import PlanCheckoutModal from "@/components/PlanCheckoutModal";
import {
  canAccess, getPlanLimits, getFeaturesByCategory, CATEGORY_LABELS,
  FEATURE_CATALOG, PLAN_INFO, type FeatureKey, type PlanSlug,
} from "@/lib/planPermissions";

const PLAN_ICONS: Record<string, any> = { FREE: Package, STARTER: Zap, PRO: Rocket, PREMIUM: Crown };
const CATEGORY_ICONS: Record<string, any> = {
  basic: Package, design: Palette, marketing: ShoppingCart, advanced: Code, ai: Bot, enterprise: Shield,
};

export default function MeuPlano() {
  const { user } = useAuth();
  const { ctx, subscription, plan: currentPlan } = useTenantContext();
  const { data: allPlans } = useAllPlans();
  const queryClient = useQueryClient();

  const [checkoutDialog, setCheckoutDialog] = useState<{ planId: string; planName: string; price: number } | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  // Auto-open checkout when navigated with ?upgrade=PRO etc.
  useEffect(() => {
    const upgradeTo = searchParams.get("upgrade")?.toUpperCase();
    if (upgradeTo && allPlans?.length) {
      const target = allPlans.find((p: any) => (p.name as string).toUpperCase() === upgradeTo);
      if (target && !checkoutDialog) {
        setCheckoutDialog({ planId: target.id, planName: target.name, price: Number(target.price) });
        setSearchParams({}, { replace: true });
      }
    }
  }, [searchParams, allPlans]);

  const { data: gatewayInfo } = useQuery({
    queryKey: ["plan_gateway_info"],
    queryFn: async () => {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/subscribe-plan`,
        { method: "POST", headers: { "Content-Type": "application/json", apikey: anonKey, Authorization: `Bearer ${anonKey}` }, body: JSON.stringify({ action: "check_gateway" }) }
      );
      return res.json() as Promise<{ gateway: string | null; methods: string[] }>;
    },
  });

  const { data: pendingRequest } = useQuery({
    queryKey: ["pending_plan_request", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plan_change_requests")
        .select("*, requested_plan:tenant_plans!plan_change_requests_requested_plan_id_fkey(*)")
        .eq("user_id", user!.id).eq("status", "pending")
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const gatewayActive = !!gatewayInfo?.gateway;

  const requestChange = useMutation({
    mutationFn: async ({ planId, type }: { planId: string; type: "upgrade" | "downgrade" }) => {
      const { error } = await supabase.from("plan_change_requests").insert({
        user_id: user!.id,
        current_plan_id: subscription?.plan_id || null,
        requested_plan_id: planId,
        request_type: type,
      } as any);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["pending_plan_request"] });
      toast.success(vars.type === "upgrade" ? "⬆️ Solicitação enviada!" : "⬇️ Solicitação enviada!");
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  const limits = getPlanLimits(ctx);
  const featuresByCategory = getFeaturesByCategory(ctx);
  const sortedPlans = allPlans?.sort((a, b) => a.price - b.price) ?? [];

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(price);

  const currentPlanName = ctx.planSlug;
  const statusLabel = ctx.subscriptionStatus === "active" ? "Ativo" : ctx.subscriptionStatus === "trial" ? "Trial" : ctx.subscriptionStatus === "trial_expired" ? "Expirado" : ctx.subscriptionStatus ?? "—";
  const statusColor = ctx.subscriptionStatus === "active" ? "bg-green-500" : ctx.subscriptionStatus === "trial" ? "bg-amber-500" : "bg-red-500";

  const normalizePlanSlug = (name: string): PlanSlug => {
    const upper = name.toUpperCase();
    if (upper === "ELITE") return "PREMIUM";
    if (["FREE", "STARTER", "PRO", "PREMIUM"].includes(upper)) return upper as PlanSlug;
    return "FREE";
  };

  const handlePlanAction = (plan: any) => {
    const planSlug = normalizePlanSlug(plan.name);
    if (planSlug === currentPlanName) return;
    if (plan.price > 0 && !gatewayActive) {
      toast.error("Gateway de pagamento em manutenção.");
      return;
    }
    if (plan.price > 0) {
      setCheckoutDialog({ planId: plan.id, planName: plan.name, price: plan.price });
    } else {
      requestChange.mutate({ planId: plan.id, type: "downgrade" });
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Crown className="h-6 w-6 text-primary" /> Plano e Assinatura
        </h1>
        <p className="text-muted-foreground">Gerencie seu plano, limites e recursos disponíveis</p>
      </div>

      {/* Pending request */}
      {pendingRequest && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="h-5 w-5 text-amber-600 animate-pulse" />
            <div>
              <p className="font-semibold text-amber-700">Solicitação pendente</p>
              <p className="text-sm text-muted-foreground">
                {pendingRequest.request_type} para <strong>{(pendingRequest as any).requested_plan?.name}</strong>
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status + Usage row */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Current plan */}
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${PLAN_INFO[currentPlanName]?.gradient || "from-slate-400 to-slate-500"} shadow-md`}>
                  {(() => { const Icon = PLAN_ICONS[currentPlanName] || Package; return <Icon className="h-6 w-6 text-white" />; })()}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-foreground">{PLAN_INFO[currentPlanName]?.label || currentPlanName}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`h-2 w-2 rounded-full ${statusColor}`} />
                    <span className="text-xs text-muted-foreground">{statusLabel}</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-foreground">
                  {currentPlan?.price ? formatPrice(currentPlan.price) : "Grátis"}
                </p>
                {currentPlan?.price > 0 && <p className="text-xs text-muted-foreground">/mês</p>}
              </div>
            </div>

            {ctx.isTrial && !ctx.isTrialExpired && (
              <div className="mt-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-amber-700 flex items-center gap-1"><Clock className="h-3 w-3" /> Período de teste</span>
                  <span className="text-xs font-bold text-amber-700">{ctx.trialDaysLeft} dias</span>
                </div>
                <Progress value={((7 - ctx.trialDaysLeft) / 7) * 100} className="h-1.5 bg-amber-500/20" />
              </div>
            )}
            {ctx.isTrialExpired && (
              <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <p className="text-sm font-medium text-red-600">⚠️ Período de teste expirado</p>
                <p className="text-xs text-muted-foreground mt-1">Ative um plano para continuar.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Usage */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" /> Uso do Plano
            </h3>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm text-muted-foreground">Produtos</span>
                  <span className="text-sm font-semibold">{limits.currentProducts}/{limits.maxProducts >= 99999 ? "∞" : limits.maxProducts}</span>
                </div>
                <Progress value={limits.maxProducts >= 99999 ? 5 : limits.productsUsagePercent} className={`h-2 ${limits.productsUsagePercent >= 90 ? "[&>div]:bg-red-500" : limits.productsUsagePercent >= 70 ? "[&>div]:bg-amber-500" : ""}`} />
                {limits.productsUsagePercent >= 80 && limits.maxProducts < 99999 && (
                  <p className="text-xs text-amber-600 mt-1">⚠️ {Math.round(limits.productsUsagePercent)}% do limite usado</p>
                )}
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm text-muted-foreground">Pedidos/mês</span>
                  <span className="text-sm font-semibold">{ctx.maxOrdersMonth >= 99999 ? "Ilimitado" : `Até ${ctx.maxOrdersMonth}`}</span>
                </div>
                <Progress value={ctx.maxOrdersMonth >= 99999 ? 5 : 0} className="h-2" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Feature breakdown */}
      <div>
        <h2 className="text-lg font-bold text-foreground mb-4">Recursos do seu plano</h2>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {Object.entries(featuresByCategory).map(([cat, features]) => {
            if (features.length === 0) return null;
            const Icon = CATEGORY_ICONS[cat] || Package;
            const unlockedCount = features.filter(f => f.unlocked).length;
            return (
              <Card key={cat} className="overflow-hidden">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm font-semibold flex items-center justify-between">
                    <span className="flex items-center gap-2"><Icon className="h-4 w-4 text-primary" />{CATEGORY_LABELS[cat]}</span>
                    <Badge variant="outline" className="text-[10px]">{unlockedCount}/{features.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="space-y-1.5">
                    {features.map(({ key, meta, unlocked }) => (
                      <div key={key} className="flex items-center gap-2 text-sm">
                        {unlocked ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" /> : <Lock className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />}
                        <span className={unlocked ? "text-foreground" : "text-muted-foreground/50"}>{meta.label}</span>
                        {!unlocked && (
                          <Badge className={`ml-auto text-[9px] px-1.5 py-0 ${PLAN_INFO[meta.minPlan]?.badgeClass || ""}`}>{meta.minPlan}</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Plan comparison */}
      <div>
        <h2 className="text-lg font-bold text-foreground mb-4">Comparar Planos</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {sortedPlans.map((plan) => {
            const slug = normalizePlanSlug(plan.name);
            const isCurrent = slug === currentPlanName;
            const PlanIcon = PLAN_ICONS[slug] || Package;
            const info = PLAN_INFO[slug];
            const planFeatures = (typeof plan.features === "object" && !Array.isArray(plan.features)) ? (plan.features as Record<string, any>) : {};
            const enabledCount = Object.values(planFeatures).filter(v => v === true).length;

            return (
              <Card key={plan.id} className={`relative overflow-hidden transition-all duration-300 ${isCurrent ? "ring-2 ring-primary shadow-lg scale-[1.02] z-10" : "hover:shadow-md"} flex flex-col h-full`}>
                {slug !== "FREE" && (
                  <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${info?.gradient || "from-slate-400 to-slate-500"}`} />
                )}
                {isCurrent && (
                  <Badge className="absolute top-3 right-3 bg-primary text-primary-foreground text-[10px]">Atual</Badge>
                )}
                {slug === "PRO" && !isCurrent && (
                  <Badge className="absolute top-3 right-3 bg-blue-500 text-white text-[10px]">Popular</Badge>
                )}
                <CardContent className="p-5 flex-1 flex flex-col">
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${info?.gradient || "from-slate-400 to-slate-500"} shadow-sm shrink-0`}>
                      <PlanIcon className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground leading-tight">{info?.label || plan.name}</h3>
                      <p className="text-[10px] sm:text-xs text-muted-foreground line-clamp-1">{info?.description}</p>
                    </div>
                  </div>

                  <div className="mb-4">
                    <p className="text-2xl font-bold text-foreground">
                      {plan.price > 0 ? formatPrice(plan.price) : "Grátis"}
                      {plan.price > 0 && <span className="text-xs font-normal text-muted-foreground">/mês</span>}
                    </p>
                  </div>

                  <div className="space-y-1.5 mb-6 text-sm flex-1">
                    <div className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-green-500 shrink-0" /><span>{plan.max_products >= 99999 ? "Produtos ilimitados" : `Até ${plan.max_products} produtos`}</span></div>
                    <div className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-green-500 shrink-0" /><span>{plan.max_orders_month >= 99999 ? "Pedidos ilimitados" : `Até ${plan.max_orders_month} pedidos/mês`}</span></div>
                    <div className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-green-500 shrink-0" /><span>{enabledCount} recursos premium</span></div>
                  </div>

                  {isCurrent ? (
                    <Button variant="outline" className="w-full mt-auto" disabled><Check className="h-4 w-4 mr-1" /> Plano Atual</Button>
                  ) : (
                    <Button
                      className={`w-full mt-auto ${slug !== "FREE" ? `bg-gradient-to-r ${info?.gradient} hover:opacity-90 text-white` : ""}`}
                      variant={slug === "FREE" ? "outline" : "default"}
                      onClick={() => handlePlanAction(plan)}
                      disabled={!!pendingRequest}
                    >
                      <ArrowUpCircle className="h-4 w-4 mr-1" />
                      {plan.price > (currentPlan?.price ?? 0) ? "Fazer Upgrade" : "Mudar"}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Checkout Modal */}
      {checkoutDialog && user && (
        <PlanCheckoutModal
          open={!!checkoutDialog}
          onOpenChange={(o) => { if (!o) setCheckoutDialog(null); }}
          planId={checkoutDialog.planId}
          planName={checkoutDialog.planName}
          planPrice={checkoutDialog.price}
          userId={user.id}
          availableMethods={gatewayInfo?.methods || ["PIX"]}
        />
      )}
    </div>
  );
}
