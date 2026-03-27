import { useState, useEffect, useRef } from "react";
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
import {
  Check, Crown, ArrowUp, ArrowDown, Zap, Package, ShoppingCart, Sparkles, Shield, Globe,
  Clock, Loader2, Star, Rocket, CreditCard, MessageCircle, QrCode, FileText, CheckCircle2,
  Download, PartyPopper,
} from "lucide-react";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";

import siteSeguro from "@/assets/site-seguro.webp";
import compraSegura from "@/assets/compra-segura.webp";
import paymentCards from "@/assets/payment-cards.webp";
import pixLogo from "@/assets/pix-logo.webp";

const FEATURE_ICONS: Record<string, any> = {
  gateway: Zap, ai_tools: Sparkles, coupons: Package, shipping_zones: ShoppingCart,
  banners: Globe, custom_domain: Shield, whatsapp_sales: Shield, reviews: Star,
};

const FEATURE_LABELS: Record<string, string> = {
  gateway: "Gateway de Pagamento", ai_tools: "Ferramentas de IA", coupons: "Cupons de Desconto",
  shipping_zones: "Zonas de Frete", banners: "Banners da Loja", custom_domain: "Domínio Personalizado",
};

type PaymentMethod = "PIX" | "CREDIT_CARD";

interface CheckoutState {
  planId: string;
  planName: string;
  price: number;
}

interface PaymentResult {
  success: boolean;
  status: string;
  method: string;
  gateway: string;
  plan_name: string;
  plan_price: number;
  transaction_id?: string;
  pix?: { qrCode?: string; qrCodeBase64?: string; expiration?: string };
  card?: { status?: string; brand?: string; lastFour?: string };
}

const ALL_METHODS: { value: PaymentMethod; label: string; emoji: string }[] = [
  { value: "PIX", label: "PIX", emoji: "💰" },
  { value: "CREDIT_CARD", label: "Cartão", emoji: "💳" },
];

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
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [pixExpiresAt, setPixExpiresAt] = useState<number | null>(null);
  const [pixTimeLeft, setPixTimeLeft] = useState<number>(0);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Card form
  const [cardNumber, setCardNumber] = useState("");
  const [cardName, setCardName] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");

  // Check platform gateway
  const { data: gatewayInfo } = useQuery({
    queryKey: ["plan_gateway_info"],
    queryFn: async () => {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/subscribe-plan`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: anonKey, Authorization: `Bearer ${anonKey}` },
          body: JSON.stringify({ action: "check_gateway" }),
        }
      );
      return res.json() as Promise<{ gateway: string | null; methods: string[] }>;
    },
  });

  const gatewayActive = !!gatewayInfo?.gateway;
  const availableMethods = ALL_METHODS.filter(m => gatewayInfo?.methods?.includes(m.value));

  // Confetti on payment confirmed
  useEffect(() => {
    if (paymentConfirmed) {
      const end = Date.now() + 2500;
      const frame = () => {
        confetti({ particleCount: 4, angle: 60, spread: 55, origin: { x: 0 } });
        confetti({ particleCount: 4, angle: 120, spread: 55, origin: { x: 1 } });
        if (Date.now() < end) requestAnimationFrame(frame);
      };
      frame();
    }
  }, [paymentConfirmed]);

  // Polling: check subscription status every 5s
  useEffect(() => {
    if (!paymentResult || !checkoutDialog || paymentConfirmed) {
      if (pollingRef.current) clearInterval(pollingRef.current);
      pollingRef.current = null;
      return;
    }
    const check = async () => {
      if (!user || !checkoutDialog) return;
      const { data } = await supabase
        .from("tenant_subscriptions")
        .select("status, plan_id")
        .eq("user_id", user.id)
        .eq("plan_id", checkoutDialog.planId)
        .eq("status", "active")
        .maybeSingle();
      if (data) {
        setPaymentConfirmed(true);
        if (pollingRef.current) clearInterval(pollingRef.current);
        pollingRef.current = null;
        toast.success("🎉 Pagamento confirmado! Plano ativado.");
        queryClient.invalidateQueries({ queryKey: ["my_subscription"] });
        queryClient.invalidateQueries({ queryKey: ["plan_features"] });
      }
    };
    pollingRef.current = setInterval(check, 5000);
    check();
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [paymentResult, checkoutDialog, paymentConfirmed, user, queryClient]);

  // PIX countdown
  useEffect(() => {
    if (!pixExpiresAt || paymentConfirmed) { setPixTimeLeft(0); return; }
    const tick = () => {
      const left = Math.max(0, Math.floor((pixExpiresAt - Date.now()) / 1000));
      setPixTimeLeft(left);
      if (left <= 0 && pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [pixExpiresAt, paymentConfirmed]);

  const { data: currentSub } = useQuery({
    queryKey: ["my_subscription", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_subscriptions")
        .select("*, tenant_plans(*)")
        .eq("user_id", user!.id)
        .in("status", ["active", "trial"])
        .order("updated_at", { ascending: false })
        .limit(1)
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
      toast.success(vars.type === "upgrade" ? "⬆️ Solicitação de upgrade enviada!" : "⬇️ Solicitação de downgrade enviada!");
      setConfirmDialog(null);
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  const processPayment = useMutation({
    mutationFn: async (): Promise<PaymentResult> => {
      if (!checkoutDialog || !user) throw new Error("Dados insuficientes");
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      // For Mercado Pago credit card, we need to generate a card token
      let cardToken: string | undefined;
      if (selectedMethod === "CREDIT_CARD" && gatewayInfo?.gateway === "mercadopago") {
        // MP card token must be generated client-side via SDK
        // For now, send raw card data to backend which will handle it
        // In production, integrate MercadoPago.js SDK
        cardToken = undefined; // Will be handled by backend
      }

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
            phone,
            ...(selectedMethod === "CREDIT_CARD" && {
              card_token: cardToken,
            }),
          }),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erro ao processar pagamento");
      return data;
    },
    onSuccess: (data) => {
      setPaymentResult(data);
      if (data.status === "approved") {
        setPaymentConfirmed(true);
        toast.success("🎉 Pagamento aprovado! Plano ativado.");
        queryClient.invalidateQueries({ queryKey: ["my_subscription"] });
        queryClient.invalidateQueries({ queryKey: ["plan_features"] });
      } else if (data.method === "PIX" && data.pix?.qrCode) {
        setPixExpiresAt(Date.now() + 30 * 60 * 1000);
        toast.success("PIX gerado! Escaneie o QR Code.");
      } else if (data.method === "BOLETO") {
        toast.success("Boleto gerado! Pague antes do vencimento.");
      } else {
        toast.info("Cobrança criada! Aguardando confirmação.");
      }
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

  const statusLabel = currentSub?.status === "active" ? "Ativo" : currentSub?.status === "trial" ? "Teste" : currentSub?.status || "—";
  const statusColor = currentSub?.status === "active" ? "bg-green-500" : currentSub?.status === "trial" ? "bg-amber-500" : "bg-muted";

  const handlePlanAction = (plan: any) => {
    if (plan.price > 0) {
      if (!gatewayActive) {
        toast.error("🔧 Gateway de pagamento em manutenção. Entre em contato via WhatsApp.");
        return;
      }
      setPaymentResult(null);
      setPaymentConfirmed(false);
      setSelectedMethod(availableMethods[0]?.value || "PIX");
      setCpf("");
      setPhone("");
      setCardNumber("");
      setCardName("");
      setCardExpiry("");
      setCardCvv("");
      setCheckoutDialog({ planId: plan.id, planName: plan.name, price: plan.price });
      return;
    }
    // Paid → free (downgrade)
    setConfirmDialog({ planId: plan.id, planName: plan.name, price: plan.price, type: "downgrade" });
  };

  const handleDownloadReceipt = () => {
    if (!paymentResult || !checkoutDialog) return;
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Recibo</title>
    <style>body{font-family:Arial;max-width:600px;margin:40px auto;padding:20px}
    .header{text-align:center;border-bottom:2px solid #6d28d9;padding-bottom:20px;margin-bottom:20px}
    .row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee}
    .total{font-size:1.2em;font-weight:bold;color:#6d28d9}
    .badge{background:#22c55e;color:white;padding:4px 12px;border-radius:12px;font-size:0.8em}</style></head>
    <body><div class="header"><h1>🧾 Recibo de Assinatura</h1>
    <span class="badge">✅ ${paymentResult.status === "approved" ? "Aprovado" : "Pendente"}</span></div>
    <div class="row"><span>Plano</span><strong>${checkoutDialog.planName}</strong></div>
    <div class="row"><span>Valor</span><strong>${formatPrice(checkoutDialog.price)}/mês</strong></div>
    <div class="row"><span>Método</span><strong>${paymentResult.method === "PIX" ? "💰 PIX" : paymentResult.method === "CREDIT_CARD" ? "💳 Cartão" : "🧾 Boleto"}</strong></div>
    <div class="row"><span>Gateway</span><strong>${paymentResult.gateway}</strong></div>
    <div class="row"><span>ID Transação</span><strong>${paymentResult.transaction_id || "—"}</strong></div>
    <div class="row"><span>Data</span><strong>${new Date().toLocaleString("pt-BR")}</strong></div>
    <div class="row total"><span>Total</span><span>${formatPrice(checkoutDialog.price)}</span></div>
    <p style="text-align:center;margin-top:30px;color:#888;font-size:0.85em">Gerado automaticamente pelo Cartlly</p></body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  };

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
                  Solicitação de {pendingRequest.request_type === "upgrade" ? "upgrade" : "downgrade"} para{" "}
                  <strong className="text-foreground">{(pendingRequest as any).requested_plan?.name || "—"}</strong>
                </p>
                <Badge variant="outline" className="border-amber-500/50 text-amber-700 text-xs mt-2">
                  <Clock className="h-3 w-3 mr-1" /> Há {getElapsedTime(pendingRequest.created_at)}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Gateway maintenance warning */}
      {!gatewayActive && (
        <Card className="border-red-500/50 bg-gradient-to-r from-red-500/10 via-red-500/5 to-transparent">
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/15 shrink-0">
                <Shield className="h-6 w-6 text-red-500" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-red-600 text-lg">🔧 Gateway em Manutenção</p>
                <p className="text-sm text-muted-foreground">O sistema de pagamento está temporariamente indisponível. Entre em contato via WhatsApp para mais informações.</p>
                <Button variant="outline" size="sm" className="mt-2 border-green-500 text-green-600 hover:bg-green-50" onClick={() => window.open("https://wa.me/5500000000000?text=Olá! Preciso de ajuda com o pagamento do meu plano.", "_blank")}>
                  <MessageCircle className="h-4 w-4 mr-1" /> WhatsApp Suporte
                </Button>
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

                  {plan.price === 0 && isCurrent && <div className="text-center text-sm text-primary font-medium">Seu plano atual</div>}
                  {plan.price === 0 && !isCurrent && <Button className="w-full" variant="outline" disabled>Plano Base</Button>}

                  {plan.price > 0 && !isCurrent && !hasPendingForThis && (
                    <Button
                      className={`w-full transition-all ${isUpgrade ? "shadow-md hover:shadow-lg" : ""}`}
                      variant={isUpgrade ? "default" : "outline"}
                      disabled={!!pendingRequest}
                      onClick={() => handlePlanAction(plan)}
                    >
                      {isUpgrade ? <><ArrowUp className="mr-1 h-4 w-4" /> Assinar Agora</> : <><ArrowDown className="mr-1 h-4 w-4" /> Solicitar Downgrade</>}
                    </Button>
                  )}
                  {plan.price > 0 && hasPendingForThis && <Button className="w-full" variant="outline" disabled><Clock className="mr-1 h-4 w-4 animate-spin" /> Aguardando...</Button>}
                  {plan.price > 0 && isCurrent && <div className="text-center text-sm text-primary font-medium">Seu plano atual</div>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Downgrade confirmation */}
      <Dialog open={!!confirmDialog} onOpenChange={() => setConfirmDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ArrowDown className="h-5 w-5" /> Solicitar Downgrade</DialogTitle>
            <DialogDescription>
              Sua solicitação de downgrade para <strong>{confirmDialog?.planName}</strong> será enviada ao administrador.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog(null)}>Cancelar</Button>
            <Button onClick={() => confirmDialog && requestChange.mutate({ planId: confirmDialog.planId, type: confirmDialog.type })} disabled={requestChange.isPending}>
              {requestChange.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enviar Solicitação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Checkout dialog */}
      <Dialog open={!!checkoutDialog} onOpenChange={(open) => { if (!open) { setCheckoutDialog(null); setPaymentResult(null); setPaymentConfirmed(false); } }}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Checkout — {checkoutDialog?.planName}
            </DialogTitle>
            <DialogDescription>
              {formatPrice(checkoutDialog?.price ?? 0)}/mês via {gatewayInfo?.gateway === "mercadopago" ? "Mercado Pago" : gatewayInfo?.gateway === "pagbank" ? "PagBank" : "Gateway"}
            </DialogDescription>
          </DialogHeader>

          {/* FORM: before payment */}
          {!paymentResult ? (
            <div className="space-y-4 py-2">
              {/* Method selector */}
              {availableMethods.length > 1 && (
                <div className={`grid gap-2`} style={{ gridTemplateColumns: `repeat(${availableMethods.length}, 1fr)` }}>
                  {availableMethods.map((m) => (
                    <button
                      key={m.value}
                      onClick={() => setSelectedMethod(m.value)}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
                        selectedMethod === m.value ? "border-primary bg-primary/10 shadow-md" : "border-border hover:border-primary/40"
                      }`}
                    >
                      <span className="text-xl">{m.emoji}</span>
                      <span className="text-xs font-medium">{m.label}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* CPF / Phone */}
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

              {/* Card form */}
              {selectedMethod === "CREDIT_CARD" && (
                <div className="space-y-3 border border-border rounded-lg p-3">
                  <div className="space-y-1.5">
                    <Label className="text-sm">Número do Cartão</Label>
                    <Input placeholder="0000 0000 0000 0000" value={cardNumber} onChange={(e) => { const n = e.target.value.replace(/\D/g, "").slice(0, 16); setCardNumber(n.replace(/(\d{4})(?=\d)/g, "$1 ")); }} maxLength={19} className="font-mono" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">Nome no Cartão</Label>
                    <Input placeholder="NOME COMO NO CARTÃO" value={cardName} onChange={(e) => setCardName(e.target.value.toUpperCase())} maxLength={50} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-sm">Validade</Label>
                      <Input placeholder="MM/AA" value={cardExpiry} onChange={(e) => { const n = e.target.value.replace(/\D/g, "").slice(0, 4); setCardExpiry(n.length > 2 ? n.slice(0, 2) + "/" + n.slice(2) : n); }} maxLength={5} className="font-mono" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">CVV</Label>
                      <Input placeholder="000" value={cardCvv} onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, "").slice(0, 4))} maxLength={4} type="password" className="font-mono" />
                    </div>
                  </div>
                </div>
              )}

              {/* Summary */}
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Plano</span>
                  <span className="font-medium">{checkoutDialog?.planName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Método</span>
                  <span className="font-medium">{ALL_METHODS.find(m => m.value === selectedMethod)?.label}</span>
                </div>
                <div className="border-t border-border pt-2 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total Mensal</span>
                  <span className="font-bold text-primary text-lg">{formatPrice(checkoutDialog?.price ?? 0)}</span>
                </div>
              </div>

              {/* Trust */}
              <div className="flex items-center justify-center gap-3 flex-wrap pt-1">
                {siteSeguro && <img src={siteSeguro} alt="Site Seguro" className="h-7" />}
                {compraSegura && <img src={compraSegura} alt="Compra Segura" className="h-7" />}
              </div>
              {(paymentCards || pixLogo) && (
                <div className="flex items-center justify-center gap-2">
                  {paymentCards && <img src={paymentCards} alt="Bandeiras" className="h-5" />}
                  {pixLogo && <img src={pixLogo} alt="PIX" className="h-5" />}
                </div>
              )}
            </div>
          ) : paymentConfirmed ? (
            /* SUCCESS: Payment confirmed */
            <div className="space-y-5 py-4 text-center">
              <div className="flex items-center justify-center">
                <div className="h-20 w-20 rounded-full bg-green-500/10 flex items-center justify-center">
                  <CheckCircle2 className="h-12 w-12 text-green-500" />
                </div>
              </div>
              <h3 className="text-xl font-bold">🎉 Pagamento Confirmado!</h3>
              <p className="text-muted-foreground">
                Seu plano <strong className="text-foreground">{checkoutDialog?.planName}</strong> foi ativado com sucesso!
              </p>
              <Badge className="bg-green-500/15 text-green-600 border-green-500/30">✅ Plano Ativo</Badge>

              {/* Receipt summary */}
              <div className="text-left rounded-lg border border-border p-4 space-y-2">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Plano</span><strong>{checkoutDialog?.planName}</strong></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Valor</span><strong>{formatPrice(checkoutDialog?.price ?? 0)}/mês</strong></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Método</span><strong>{paymentResult.method === "PIX" ? "💰 PIX" : paymentResult.method === "CREDIT_CARD" ? "💳 Cartão" : "🧾 Boleto"}</strong></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">ID</span><strong className="font-mono text-xs">{paymentResult.transaction_id?.slice(0, 12) || "—"}</strong></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Data</span><strong>{new Date().toLocaleString("pt-BR")}</strong></div>
              </div>

              <Button variant="outline" className="w-full" onClick={handleDownloadReceipt}>
                <Download className="mr-2 h-4 w-4" /> Baixar Recibo em PDF
              </Button>
            </div>
          ) : (
            /* WAITING: payment result shown, waiting for confirmation */
            <div className="space-y-4 py-2">
              {/* PIX QR Code */}
              {paymentResult.pix?.qrCode && (
                <div className="text-center space-y-3">
                  <div className="p-4 bg-background rounded-xl border border-border inline-block">
                    {paymentResult.pix.qrCodeBase64 ? (
                      <img src={paymentResult.pix.qrCodeBase64.startsWith("http") ? paymentResult.pix.qrCodeBase64 : `data:image/png;base64,${paymentResult.pix.qrCodeBase64}`} alt="QR PIX" className="h-48 w-48" />
                    ) : (
                      <QrCode className="h-32 w-32 text-foreground" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">Escaneie o QR Code com seu app do banco</p>
                  <div className="flex items-center gap-2">
                    <input readOnly value={paymentResult.pix.qrCode} className="flex-1 text-xs p-2 border border-border rounded bg-muted font-mono truncate" />
                    <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(paymentResult.pix!.qrCode!); toast.success("Código PIX copiado!"); }}>Copiar</Button>
                  </div>
                  {pixTimeLeft > 0 ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
                        <span className="text-sm text-amber-600 font-medium">Aguardando pagamento...</span>
                      </div>
                      <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-mono font-bold ${pixTimeLeft <= 120 ? "bg-red-500/10 text-red-600" : pixTimeLeft <= 300 ? "bg-amber-500/10 text-amber-600" : "bg-muted text-muted-foreground"}`}>
                        <Clock className="h-3.5 w-3.5" />
                        {String(Math.floor(pixTimeLeft / 60)).padStart(2, "0")}:{String(pixTimeLeft % 60).padStart(2, "0")}
                      </div>
                      <p className="text-xs text-muted-foreground">Atualizará automaticamente ao confirmar</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Badge variant="outline" className="text-red-600 border-red-500/50"><Clock className="h-3 w-3 mr-1" /> QR Code expirado</Badge>
                      <p className="text-xs text-muted-foreground">Feche e gere um novo</p>
                    </div>
                  )}
                </div>
              )}

              {/* Card processing */}
              {paymentResult.card && !paymentConfirmed && (
                <div className="text-center space-y-3 py-4">
                  <Loader2 className="h-12 w-12 text-amber-500 mx-auto animate-spin" />
                  <p className="font-bold text-lg">Processando cartão...</p>
                  <p className="text-sm text-muted-foreground">Aguardando confirmação da operadora.</p>
                </div>
              )}

              {/* Fallback */}
              {!paymentResult.pix?.qrCode && !paymentResult.card && (
                <div className="text-center space-y-3 py-4">
                  <Loader2 className="h-12 w-12 text-amber-500 mx-auto animate-spin" />
                  <p className="font-bold text-lg">Aguardando confirmação...</p>
                  <p className="text-sm text-muted-foreground">Atualizará automaticamente.</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            {!paymentResult && (
              <Button
                onClick={() => processPayment.mutate()}
                disabled={processPayment.isPending || cpf.replace(/\D/g, "").length < 11 || (selectedMethod === "CREDIT_CARD" && (!cardNumber || !cardName || !cardExpiry || !cardCvv))}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white h-12 text-base font-bold"
              >
                {processPayment.isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <CreditCard className="mr-2 h-5 w-5" />}
                {processPayment.isPending ? "Processando..." : `Pagar ${formatPrice(checkoutDialog?.price ?? 0)}`}
              </Button>
            )}
            <Button
              variant={paymentConfirmed ? "default" : "outline"}
              onClick={() => { setCheckoutDialog(null); setPaymentResult(null); setPaymentConfirmed(false); }}
            >
              {paymentConfirmed ? <><CheckCircle2 className="mr-2 h-4 w-4" /> Fechar</> : paymentResult ? "Fechar" : "Cancelar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
