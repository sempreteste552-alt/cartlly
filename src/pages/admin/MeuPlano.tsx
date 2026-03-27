import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";
import { useAllPlans } from "@/hooks/useUserRole";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, Crown, ArrowUp, ArrowDown, Zap, Package, ShoppingCart, Sparkles, Shield, Globe, Clock, Loader2, Star, Rocket, CreditCard, MessageCircle, QrCode, FileText, CheckCircle2, PartyPopper } from "lucide-react";
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

type PaymentMethod = "PIX" | "CREDIT_CARD" | "BOLETO";

interface CheckoutState {
  planId: string;
  planName: string;
  price: number;
}

interface PaymentResult {
  success: boolean;
  transaction_id?: string;
  pix?: { qrCode?: string; qrCodeBase64?: string };
  plan_name?: string;
  status?: string;
}

export default function MeuPlano() {
  const { user } = useAuth();
  const { features } = usePlanFeatures();
  const { data: allPlans } = useAllPlans();
  const queryClient = useQueryClient();
  const [confirmDialog, setConfirmDialog] = useState<{ planId: string; planName: string; price: number; type: "upgrade" | "downgrade" } | null>(null);
  const [checkoutDialog, setCheckoutDialog] = useState<CheckoutState | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>("PIX");
  const [cpf, setCpf] = useState("");
  const [phone, setPhone] = useState("");
  const [paymentResult, setPaymentResult] = useState<PaymentResult | null>(null);
  const [thankYouDialog, setThankYouDialog] = useState<{ planName: string; method: string } | null>(null);

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

  // Check if Amplopay gateway is configured
  const { data: gatewayActive } = useQuery({
    queryKey: ["amplopay_gateway_active"],
    queryFn: async () => {
      const { data } = await supabase
        .from("platform_settings")
        .select("key, value")
        .in("key", ["amplopay_public_key", "amplopay_secret_key"]);
      let hasPublic = false;
      let hasSecret = false;
      data?.forEach((s: any) => {
        const val = s.value?.value;
        if (val && typeof val === "string" && val.length > 5) {
          if (s.key === "amplopay_public_key") hasPublic = true;
          if (s.key === "amplopay_secret_key") hasSecret = true;
        }
      });
      return hasPublic && hasSecret;
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

  const processPayment = useMutation({
    mutationFn: async (): Promise<PaymentResult> => {
      if (!checkoutDialog || !user) throw new Error("Dados insuficientes");
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/amplopay-subscribe`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
          },
          body: JSON.stringify({
            user_id: user.id,
            plan_id: checkoutDialog.planId,
            payment_method: selectedMethod,
            document: cpf.replace(/\D/g, ""),
            phone: phone,
          }),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erro ao processar pagamento");
      return data;
    },
    onSuccess: (data) => {
      // Normalize Amplopay PIX fields (code/base64 → qrCode/qrCodeBase64)
      if (data.pix) {
        data.pix.qrCode = data.pix.qrCode || (data.pix as any).code;
        data.pix.qrCodeBase64 = data.pix.qrCodeBase64 || (data.pix as any).base64;
      }
      setPaymentResult(data);
      if (data.pix?.qrCode) {
        toast.success("PIX gerado! Escaneie o QR Code para pagar.");
      } else {
        // Non-PIX: keep checkout dialog open showing pending status
        toast.info("Cobrança criada! Aguardando confirmação do pagamento.");
      }
      queryClient.invalidateQueries({ queryKey: ["my_subscription"] });
      queryClient.invalidateQueries({ queryKey: ["pending_plan_request"] });
    },
    onError: (e: any) => toast.error("❌ " + e.message),
  });

  const currentPlan = currentSub?.tenant_plans as any;
  const currentPrice = currentPlan?.price ?? 0;
  const isFreePlan = currentPrice === 0;

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

  const statusLabel = currentSub?.status === "active" ? "Ativo" : currentSub?.status === "trial" ? "Teste" : currentSub?.status === "pending_payment" ? "Aguardando Pagamento" : currentSub?.status || "—";
  const statusColor = currentSub?.status === "active" ? "bg-green-500" : currentSub?.status === "trial" ? "bg-amber-500" : currentSub?.status === "pending_payment" ? "bg-blue-500" : "bg-muted";

  const handlePlanAction = (plan: any) => {
    const isUpgrade = plan.price > currentPrice;

    // Free → Paid: open checkout
    if (isFreePlan && plan.price > 0) {
      if (!gatewayActive) {
        toast.error("🔧 Gateway de pagamento em manutenção. Entre em contato via WhatsApp.");
        return;
      }
      setPaymentResult(null);
      setSelectedMethod("PIX");
      setCheckoutDialog({ planId: plan.id, planName: plan.name, price: plan.price });
      return;
    }

    // Paid → different paid plan: also checkout directly
    if (plan.price > 0) {
      if (!gatewayActive) {
        toast.error("🔧 Gateway de pagamento em manutenção. Entre em contato via WhatsApp.");
        return;
      }
      setPaymentResult(null);
      setSelectedMethod("PIX");
      setCheckoutDialog({ planId: plan.id, planName: plan.name, price: plan.price });
      return;
    }

    // Paid → free (downgrade): request approval
    setConfirmDialog({
      planId: plan.id,
      planName: plan.name,
      price: plan.price,
      type: "downgrade",
    });
  };

  const METHOD_OPTIONS: { value: PaymentMethod; label: string; icon: any; emoji: string }[] = [
    { value: "PIX", label: "PIX", icon: QrCode, emoji: "💰" },
    { value: "CREDIT_CARD", label: "Cartão de Crédito", icon: CreditCard, emoji: "💳" },
    { value: "BOLETO", label: "Boleto", icon: FileText, emoji: "🧾" },
  ];

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
                <Badge variant="outline" className="border-amber-500/50 text-amber-700 text-xs mt-2">
                  <Clock className="h-3 w-3 mr-1" /> Há {getElapsedTime(pendingRequest.created_at)}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Current plan hero */}
      <Card className="border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent overflow-hidden relative shadow-lg">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
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
              <div key={item.label} className="text-center p-4 rounded-xl bg-background/80 backdrop-blur border border-border/50 shadow-sm">
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
                <Badge key={key} variant={enabled ? "default" : "outline"} className={`transition-all ${enabled ? "shadow-sm" : "opacity-40"}`}>
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
                className={`relative transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${
                  isCurrent ? "border-primary ring-2 ring-primary/20 shadow-lg shadow-primary/10"
                  : hasPendingForThis ? "border-amber-500 ring-2 ring-amber-500/20"
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
                            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
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

                  {/* Free plan: no checkout needed */}
                  {plan.price === 0 && isCurrent && (
                    <div className="text-center text-sm text-primary font-medium">Seu plano atual</div>
                  )}
                  {plan.price === 0 && !isCurrent && (
                    <Button className="w-full" variant="outline" disabled>
                      Plano Base
                    </Button>
                  )}

                  {/* Paid plans */}
                  {plan.price > 0 && !isCurrent && !hasPendingForThis && (
                    <Button
                      className={`w-full transition-all ${isUpgrade ? "shadow-md hover:shadow-lg" : ""}`}
                      variant={isUpgrade ? "default" : "outline"}
                      disabled={!!pendingRequest}
                      onClick={() => handlePlanAction(plan)}
                    >
                      {isUpgrade ? (
                        <><ArrowUp className="mr-1 h-4 w-4" /> Assinar Agora</>
                      ) : (
                        <><ArrowDown className="mr-1 h-4 w-4" /> Solicitar Downgrade</>
                      )}
                    </Button>
                  )}
                  {plan.price > 0 && hasPendingForThis && (
                    <Button className="w-full" variant="outline" disabled>
                      <Clock className="mr-1 h-4 w-4 animate-spin" /> Aguardando...
                    </Button>
                  )}
                  {plan.price > 0 && isCurrent && (
                    <div className="text-center text-sm text-primary font-medium">Seu plano atual</div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Confirmation dialog (paid→free downgrade) */}
      <Dialog open={!!confirmDialog} onOpenChange={() => setConfirmDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowDown className="h-5 w-5" />
              Solicitar Downgrade
            </DialogTitle>
            <DialogDescription>
              Sua solicitação de downgrade para <strong>{confirmDialog?.planName}</strong> será enviada ao administrador para aprovação.
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

      {/* Checkout dialog (Amplopay) */}
      <Dialog open={!!checkoutDialog} onOpenChange={(open) => { if (!open) { setCheckoutDialog(null); setPaymentResult(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Checkout — {checkoutDialog?.planName}
            </DialogTitle>
            <DialogDescription>
              Escolha o método de pagamento para <strong>{formatPrice(checkoutDialog?.price ?? 0)}/mês</strong>
            </DialogDescription>
          </DialogHeader>

          {!paymentResult ? (
            <div className="space-y-4 py-2">
              {/* Payment method selector */}
              <div className="grid grid-cols-3 gap-2">
                {METHOD_OPTIONS.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => setSelectedMethod(m.value)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
                      selectedMethod === m.value
                        ? "border-primary bg-primary/10 shadow-md"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    <span className="text-xl">{m.emoji}</span>
                    <span className="text-xs font-medium">{m.label}</span>
                  </button>
                ))}
              </div>

              {/* CPF and Phone */}
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-sm">CPF ou CNPJ *</Label>
                  <Input
                    placeholder="000.000.000-00"
                    value={cpf}
                    onChange={(e) => {
                      const nums = e.target.value.replace(/\D/g, "").slice(0, 14);
                      if (nums.length <= 11) {
                        setCpf(nums.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, (_, a, b, c, d) => d ? `${a}.${b}.${c}-${d}` : c ? `${a}.${b}.${c}` : b ? `${a}.${b}` : a));
                      } else {
                        setCpf(nums.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/, (_, a, b, c, d, e2) => e2 ? `${a}.${b}.${c}/${d}-${e2}` : `${a}.${b}.${c}/${d}`));
                      }
                    }}
                    className="font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Telefone</Label>
                  <Input
                    placeholder="(11) 99999-9999"
                    value={phone}
                    onChange={(e) => {
                      const nums = e.target.value.replace(/\D/g, "").slice(0, 11);
                      if (nums.length > 6) setPhone(`(${nums.slice(0,2)}) ${nums.slice(2,7)}-${nums.slice(7)}`);
                      else if (nums.length > 2) setPhone(`(${nums.slice(0,2)}) ${nums.slice(2)}`);
                      else setPhone(nums);
                    }}
                    className="font-mono"
                  />
                </div>
              </div>

              {/* Order summary */}
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Plano</span>
                  <span className="font-medium">{checkoutDialog?.planName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Método</span>
                  <span className="font-medium">{METHOD_OPTIONS.find(m => m.value === selectedMethod)?.label}</span>
                </div>
                <div className="border-t border-border pt-2 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total Mensal</span>
                  <span className="font-bold text-primary text-lg">{formatPrice(checkoutDialog?.price ?? 0)}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              {/* PIX QR Code display */}
              {paymentResult.pix?.qrCode && (
                <div className="text-center space-y-3">
                  <div className="flex items-center justify-center">
                    <div className="p-4 bg-background rounded-xl border border-border">
                      {paymentResult.pix?.qrCodeBase64 ? (
                        <img src={`data:image/png;base64,${paymentResult.pix.qrCodeBase64}`} alt="QR Code PIX" className="h-48 w-48" />
                      ) : (
                        <QrCode className="h-32 w-32 text-foreground" />
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">Escaneie o QR Code com seu app do banco</p>
                  <div className="flex items-center gap-2">
                    <input
                      readOnly
                      value={paymentResult.pix.qrCode}
                      className="flex-1 text-xs p-2 border border-border rounded bg-muted font-mono truncate"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard.writeText(paymentResult.pix!.qrCode!);
                        toast.success("Código PIX copiado!");
                      }}
                    >
                      Copiar
                    </Button>
                  </div>
                  <Badge variant="outline" className="text-amber-600 border-amber-500/50">
                    <Clock className="h-3 w-3 mr-1" /> Aguardando pagamento...
                  </Badge>
                </div>
              )}

              {/* Non-PIX result */}
              {!paymentResult.pix?.qrCode && (
                <div className="text-center space-y-3 py-4">
                  <Clock className="h-12 w-12 text-amber-500 mx-auto" />
                  <p className="font-bold text-lg">Cobrança criada!</p>
                  <p className="text-sm text-muted-foreground">
                    Aguardando confirmação do pagamento. Você receberá uma notificação quando for aprovado.
                  </p>
                  <Badge variant="outline" className="text-amber-600 border-amber-500/30">
                    <Clock className="h-3 w-3 mr-1" /> Pendente
                  </Badge>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setCheckoutDialog(null); setPaymentResult(null); }}>
              {paymentResult ? "Fechar" : "Cancelar"}
            </Button>
            {!paymentResult && (
              <Button
                onClick={() => processPayment.mutate()}
                disabled={processPayment.isPending || cpf.replace(/\D/g, "").length < 11}
                className="min-w-[140px]"
              >
                {processPayment.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CreditCard className="mr-2 h-4 w-4" />
                )}
                {processPayment.isPending ? "Processando..." : "Pagar"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Thank you dialog */}
      <Dialog open={!!thankYouDialog} onOpenChange={() => setThankYouDialog(null)}>
        <DialogContent className="sm:max-w-md text-center">
          <div className="py-6 space-y-4">
            <Clock className="h-16 w-16 text-amber-500 mx-auto" />
            <h2 className="text-2xl font-bold text-foreground">⏳ Cobrança Criada!</h2>
            <p className="text-muted-foreground">
              A cobrança do plano <strong className="text-foreground">{thankYouDialog?.planName}</strong> foi gerada com sucesso!
            </p>
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 space-y-2 text-left">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Plano</span>
                <span className="font-medium">{thankYouDialog?.planName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Método</span>
                <span className="font-medium">{thankYouDialog?.method === "PIX" ? "💰 PIX" : thankYouDialog?.method === "CREDIT_CARD" ? "💳 Cartão" : "🧾 Boleto"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30">Aguardando Pagamento</Badge>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">As funcionalidades do plano serão liberadas <strong>após a confirmação do pagamento</strong>. Você receberá uma notificação quando for aprovado.</p>
          </div>
          <DialogFooter>
            <Button onClick={() => setThankYouDialog(null)} className="w-full">
              <CheckCircle2 className="mr-2 h-4 w-4" /> Entendido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
