import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTenantContext } from "@/hooks/useTenantContext";
import { useAllPlans } from "@/hooks/useUserRole";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Check, Crown, Zap, Sparkles, Shield, Globe, Clock, Loader2, Star, Rocket,
  CreditCard, Lock, ArrowUpCircle, Package, CheckCircle2,
  Download, PartyPopper, BarChart3, Palette, ShoppingCart, Bot, Code, Layers,
  Gem, Timer, QrCode, Copy,
} from "lucide-react";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  canAccess, getPlanLimits, getFeaturesByCategory, CATEGORY_LABELS,
  FEATURE_CATALOG, PLAN_INFO, type FeatureKey, type PlanSlug,
} from "@/lib/planPermissions";

const PLAN_ICONS: Record<string, any> = { FREE: Package, STARTER: Zap, PRO: Rocket, PREMIUM: Crown };
const CATEGORY_ICONS: Record<string, any> = {
  basic: Package, design: Palette, marketing: ShoppingCart, advanced: Code, ai: Bot, enterprise: Shield,
};

type PaymentMethod = "PIX" | "CREDIT_CARD" | "BOLETO";

export default function MeuPlano() {
  const { user } = useAuth();
  const { ctx, subscription, plan: currentPlan } = useTenantContext();
  const { data: allPlans } = useAllPlans();
  const queryClient = useQueryClient();

  const [checkoutDialog, setCheckoutDialog] = useState<{ planId: string; planName: string; price: number } | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>("PIX");
  const [cpf, setCpf] = useState("");
  const [payerName, setPayerName] = useState("");
  const [payerEmail, setPayerEmail] = useState("");
  const [paymentResult, setPaymentResult] = useState<any>(null);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  // Confetti on payment success
  useEffect(() => {
    if (paymentConfirmed) {
      const end = Date.now() + 3000;
      const frame = () => {
        confetti({ particleCount: 5, angle: 60, spread: 55, origin: { x: 0 } });
        confetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1 } });
        if (Date.now() < end) requestAnimationFrame(frame);
      };
      frame();
    }
  }, [paymentConfirmed]);

  // Countdown timer for PIX
  useEffect(() => {
    if (countdown <= 0 && countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, [countdown]);

  // Cleanup polling
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

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

  const processPayment = useMutation({
    mutationFn: async () => {
      if (!checkoutDialog || !user) throw new Error("Dados insuficientes");
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/subscribe-plan`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: anonKey, Authorization: `Bearer ${anonKey}` },
          body: JSON.stringify({
            user_id: user.id,
            plan_id: checkoutDialog.planId,
            payment_method: selectedMethod,
            document: cpf.replace(/\D/g, ""),
          }),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erro ao processar");
      return data;
    },
    onSuccess: (data) => {
      setPaymentResult(data);
      if (data.status === "approved") {
        setPaymentConfirmed(true);
        toast.success("🎉 Pagamento aprovado! Plano ativado.");
        queryClient.invalidateQueries({ queryKey: ["tenant_context"] });
      } else if (data.pix?.qrCode) {
        // Start 20 min countdown
        setCountdown(20 * 60);
        countdownRef.current = setInterval(() => setCountdown(prev => {
          if (prev <= 1) { clearInterval(countdownRef.current!); return 0; }
          return prev - 1;
        }), 1000);
        toast.success("PIX gerado! Escaneie o QR Code para pagar.");
      } else {
        toast.info("Aguardando confirmação do pagamento.");
      }
    },
    onError: (e: any) => toast.error("❌ " + e.message),
  });

  const limits = getPlanLimits(ctx);
  const featuresByCategory = getFeaturesByCategory(ctx);
  const sortedPlans = allPlans?.sort((a, b) => a.price - b.price) ?? [];

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(price);

  const currentPlanName = ctx.planSlug;
  const statusLabel = ctx.subscriptionStatus === "active" ? "Ativo" : ctx.subscriptionStatus === "trial" ? "Trial" : ctx.subscriptionStatus === "trial_expired" ? "Expirado" : ctx.subscriptionStatus ?? "—";
  const statusColor = ctx.subscriptionStatus === "active" ? "bg-green-500" : ctx.subscriptionStatus === "trial" ? "bg-amber-500" : "bg-red-500";

  const formatCountdown = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

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
      setPaymentConfirmed(false);
      setPaymentResult(null);
      setCountdown(0);
      setCheckoutDialog({ planId: plan.id, planName: plan.name, price: plan.price });
    } else {
      requestChange.mutate({ planId: plan.id, type: "downgrade" });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Código copiado!");
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
              <Card key={plan.id} className={`relative overflow-hidden transition-all duration-300 ${isCurrent ? "ring-2 ring-primary shadow-lg scale-[1.02]" : "hover:shadow-md"}`}>
                {slug !== "FREE" && (
                  <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${info?.gradient || "from-slate-400 to-slate-500"}`} />
                )}
                {isCurrent && (
                  <Badge className="absolute top-3 right-3 bg-primary text-primary-foreground text-[10px]">Atual</Badge>
                )}
                {slug === "PRO" && !isCurrent && (
                  <Badge className="absolute top-3 right-3 bg-blue-500 text-white text-[10px]">Popular</Badge>
                )}
                <CardContent className="p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${info?.gradient || "from-slate-400 to-slate-500"} shadow-sm`}>
                      <PlanIcon className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground">{info?.label || plan.name}</h3>
                      <p className="text-xs text-muted-foreground">{info?.description}</p>
                    </div>
                  </div>

                  <div className="mb-4">
                    <p className="text-2xl font-bold text-foreground">
                      {plan.price > 0 ? formatPrice(plan.price) : "Grátis"}
                      {plan.price > 0 && <span className="text-xs font-normal text-muted-foreground">/mês</span>}
                    </p>
                  </div>

                  <div className="space-y-1.5 mb-4 text-sm">
                    <div className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-green-500 shrink-0" /><span>{plan.max_products >= 99999 ? "Produtos ilimitados" : `Até ${plan.max_products} produtos`}</span></div>
                    <div className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-green-500 shrink-0" /><span>{plan.max_orders_month >= 99999 ? "Pedidos ilimitados" : `Até ${plan.max_orders_month} pedidos/mês`}</span></div>
                    <div className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-green-500 shrink-0" /><span>{enabledCount} recursos</span></div>
                  </div>

                  {isCurrent ? (
                    <Button variant="outline" className="w-full" disabled><Check className="h-4 w-4 mr-1" /> Plano Atual</Button>
                  ) : (
                    <Button
                      className={`w-full ${slug !== "FREE" ? `bg-gradient-to-r ${info?.gradient} hover:opacity-90 text-white` : ""}`}
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

      {/* Checkout Dialog */}
      <Dialog open={!!checkoutDialog} onOpenChange={(o) => { if (!o) { setCheckoutDialog(null); setPaymentResult(null); setCountdown(0); }}}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" /> Ativar {checkoutDialog?.planName}
            </DialogTitle>
            <DialogDescription>{checkoutDialog && formatPrice(checkoutDialog.price)}/mês</DialogDescription>
          </DialogHeader>

          {paymentConfirmed ? (
            <div className="text-center py-8 space-y-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10 mx-auto">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              </div>
              <h3 className="text-xl font-bold text-foreground">Plano Ativado! 🎉</h3>
              <p className="text-sm text-muted-foreground">Todos os recursos foram desbloqueados com sucesso.</p>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => { setCheckoutDialog(null); setPaymentResult(null); }}>
                <Download className="h-4 w-4" /> Fechar
              </Button>
            </div>
          ) : paymentResult?.pix?.qrCode ? (
            <div className="space-y-4">
              {/* PIX QR Code display */}
              <div className="text-center space-y-3">
                <div className="flex items-center justify-center gap-2 text-amber-600">
                  <Timer className="h-4 w-4" />
                  <span className="text-sm font-semibold">
                    {countdown > 0 ? `Expira em ${formatCountdown(countdown)}` : "QR Code expirado"}
                  </span>
                </div>
                {paymentResult.pix.qrCodeBase64 && (
                  <div className="flex justify-center">
                    <img
                      src={paymentResult.pix.qrCodeBase64.startsWith("data:") ? paymentResult.pix.qrCodeBase64 : `data:image/png;base64,${paymentResult.pix.qrCodeBase64}`}
                      alt="QR Code PIX"
                      className="w-48 h-48 rounded-lg border border-border shadow-sm"
                    />
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Input value={paymentResult.pix.qrCode} readOnly className="text-xs font-mono" />
                  <Button size="icon" variant="outline" onClick={() => copyToClipboard(paymentResult.pix.qrCode)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Copie o código ou escaneie o QR Code para pagar</p>
              </div>
              {countdown <= 0 && (
                <Button className="w-full" variant="outline" onClick={() => { setPaymentResult(null); processPayment.mutate(); }}>
                  <QrCode className="h-4 w-4 mr-2" /> Gerar novo QR Code
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Payment method selection */}
              <div className="flex gap-2">
                {(gatewayInfo?.methods || ["PIX"]).map((m) => (
                  <Button
                    key={m}
                    variant={selectedMethod === m ? "default" : "outline"}
                    size="sm"
                    className="flex-1"
                    onClick={() => setSelectedMethod(m as PaymentMethod)}
                  >
                    {m === "PIX" ? "💰 PIX" : m === "CREDIT_CARD" ? "💳 Cartão" : "📄 Boleto"}
                  </Button>
                ))}
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-foreground">CPF</label>
                  <Input value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="000.000.000-00" />
                </div>
              </div>

              <div className="p-3 rounded-lg bg-muted/50 border border-border/60 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">Plano</span><span className="font-medium">{checkoutDialog?.planName}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Valor</span><span className="font-bold text-foreground">{checkoutDialog && formatPrice(checkoutDialog.price)}/mês</span></div>
              </div>

              <Button className="w-full h-11" disabled={!cpf.trim() || processPayment.isPending} onClick={() => processPayment.mutate()}>
                {processPayment.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Shield className="h-4 w-4 mr-2" />}
                {selectedMethod === "PIX" ? "Gerar QR Code PIX" : "Pagar"} — {checkoutDialog && formatPrice(checkoutDialog.price)}
              </Button>

              <p className="text-[10px] text-center text-muted-foreground">
                🔒 Pagamento seguro e processado pelo gateway da plataforma
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
