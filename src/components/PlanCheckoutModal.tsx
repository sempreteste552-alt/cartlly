import { useState, useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog, DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  QrCode, CreditCard, Copy, CheckCircle2, Timer, Loader2, Shield,
  X, AlertTriangle, RotateCcw, Download, Sparkles, Lock,
  User, Mail, FileText, Star, Zap, Crown, Package, Check,
} from "lucide-react";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import seloSeguroImg from "@/assets/selo-seguro.png";
import pixLogoImg from "@/assets/pix-logo.png";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
type CheckoutStep =
  | "form"
  | "loading"
  | "pix"
  | "success"
  | "expired"
  | "error";

interface PlanCheckoutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planId: string;
  planName: string;
  planPrice: number;
  userId: string;
  availableMethods: string[];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
const formatPrice = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

const formatCpf = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
};

const pad2 = (n: number) => String(n).padStart(2, "0");
const fmtTimer = (s: number) => `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}`;

const PIX_TIMEOUT = 20 * 60;

const PLAN_ICON: Record<string, any> = { FREE: Package, STARTER: Zap, PRO: Star, PREMIUM: Crown };
const PLAN_GRADIENT: Record<string, string> = {
  FREE: "from-slate-500 to-slate-600",
  STARTER: "from-emerald-500 to-teal-600",
  PRO: "from-blue-500 to-indigo-600",
  PREMIUM: "from-amber-500 to-orange-600",
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
export default function PlanCheckoutModal({
  open, onOpenChange, planId, planName, planPrice, userId, availableMethods,
}: PlanCheckoutModalProps) {
  const queryClient = useQueryClient();

  const [step, setStep] = useState<CheckoutStep>("form");
  const [selectedMethod, setSelectedMethod] = useState<"PIX" | "CREDIT_CARD">("PIX");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const [pixQrCode, setPixQrCode] = useState("");
  const [pixQrBase64, setPixQrBase64] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [transactionId, setTransactionId] = useState("");

  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const planSlug = planName.toUpperCase();
  const PlanIcon = PLAN_ICON[planSlug] || Sparkles;
  const gradient = PLAN_GRADIENT[planSlug] || "from-primary to-primary/80";

  useEffect(() => {
    if (!open) {
      clearTimers();
      const t = setTimeout(() => {
        setStep("form");
        setFullName("");
        setEmail("");
        setCpf("");
        setPixQrCode("");
        setPixQrBase64("");
        setCountdown(0);
        setTransactionId("");
        setErrorMsg("");
      }, 300);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    if (countdown <= 0 && countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
      if (step === "pix") setStep("expired");
    }
  }, [countdown, step]);

  useEffect(() => () => clearTimers(), []);

  const clearTimers = useCallback(() => {
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
  }, []);

  const fireConfetti = () => {
    const end = Date.now() + 2500;
    const frame = () => {
      confetti({ particleCount: 4, angle: 60, spread: 55, origin: { x: 0 } });
      confetti({ particleCount: 4, angle: 120, spread: 55, origin: { x: 1 } });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
  };

  const startPolling = useCallback(() => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(
          `https://${projectId}.supabase.co/rest/v1/tenant_subscriptions?user_id=eq.${userId}&select=status,plan_id&order=updated_at.desc&limit=1`,
          { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` } }
        );
        const data = await res.json();
        if (data?.[0]?.status === "active" && data?.[0]?.plan_id === planId) {
          clearTimers();
          setStep("success");
          fireConfetti();
          queryClient.invalidateQueries({ queryKey: ["tenant_context"] });
          queryClient.invalidateQueries({ queryKey: ["pending_plan_request"] });
        }
      } catch { /* ignore */ }
    }, 5000);
  }, [userId, planId, clearTimers, queryClient]);

  /* ------ Validation ------ */
  const cpfClean = cpf.replace(/\D/g, "");
  const isFormValid = fullName.trim().length >= 3 && email.includes("@") && cpfClean.length === 11;

  /* ------ Generate PIX ------ */
  const generatePix = async () => {
    if (!isFormValid) {
      toast.error("Preencha todos os campos corretamente.");
      return;
    }

    setStep("loading");
    setErrorMsg("");

    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/subscribe-plan`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
          },
          body: JSON.stringify({
            user_id: userId,
            plan_id: planId,
            payment_method: "PIX",
            document: cpfClean,
            payer_name: fullName.trim(),
            payer_email: email.trim(),
          }),
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao gerar cobrança");

      if (data.status === "approved") {
        setStep("success");
        fireConfetti();
        queryClient.invalidateQueries({ queryKey: ["tenant_context"] });
        return;
      }

      if (data.pix?.qrCode) {
        setPixQrCode(data.pix.qrCode);
        setPixQrBase64(data.pix.qrCodeBase64 || "");
        setTransactionId(data.transaction_id || "");
        setStep("pix");

        setCountdown(PIX_TIMEOUT);
        countdownRef.current = setInterval(() => {
          setCountdown(prev => (prev <= 1 ? 0 : prev - 1));
        }, 1000);

        startPolling();
      } else {
        throw new Error("QR Code não foi gerado. Tente novamente.");
      }
    } catch (e: any) {
      setErrorMsg(e.message || "Erro ao processar pagamento");
      setStep("error");
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(pixQrCode);
    toast.success("Código PIX copiado!");
  };

  const restart = () => {
    clearTimers();
    setPixQrCode("");
    setPixQrBase64("");
    setCountdown(0);
    setTransactionId("");
    setErrorMsg("");
    setStep("form");
  };

  const pixAvailable = availableMethods.includes("PIX");
  const countdownPercent = (countdown / PIX_TIMEOUT) * 100;
  const isUrgent = countdown > 0 && countdown < 120;

  /* ================================================================ */
  /*  RENDER                                                           */
  /* ================================================================ */
  return (
    <Dialog open={open} onOpenChange={(o) => { if (step !== "loading") onOpenChange(o); }}>
      <DialogContent className="max-w-[95vw] sm:max-w-lg p-0 gap-0 overflow-hidden border-border/50 shadow-2xl [&>button]:hidden rounded-2xl flex flex-col max-h-[96vh] sm:max-h-[90vh]">

        {/* ── Premium Header ── */}
        <div className={`relative bg-gradient-to-br ${gradient} px-5 py-4 sm:px-6 sm:py-5 text-white shrink-0`}>
          <button
            onClick={() => { if (step !== "loading") onOpenChange(false); }}
            className="absolute right-3 top-3 sm:right-4 sm:top-4 rounded-full p-1.5 bg-white/10 hover:bg-white/20 transition-colors backdrop-blur-sm z-10"
          >
            <X className="h-4 w-4 text-white/90" />
          </button>

          <div className="flex items-center gap-3 sm:gap-4">
            <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl sm:rounded-2xl bg-white/15 backdrop-blur-sm border border-white/20 shadow-lg shrink-0">
              <PlanIcon className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            </div>
            <div>
              <p className="text-[10px] sm:text-xs font-medium text-white/70 uppercase tracking-wider">Checkout seguro</p>
              <h2 className="text-lg sm:text-xl font-bold leading-tight">Plano {planName}</h2>
              <div className="flex items-baseline gap-1 mt-0">
                <span className="text-xl sm:text-2xl font-extrabold">{formatPrice(planPrice)}</span>
                <span className="text-xs sm:text-sm text-white/70">/mês</span>
              </div>
            </div>
          </div>

          {/* Trust badges with real images */}
          <div className="flex items-center justify-center gap-4 sm:gap-6 mt-3 sm:mt-4 pt-2 sm:pt-3 border-t border-white/15">
            <img src={seloSeguroImg} alt="Compra 100% Segura" className="h-10 sm:h-14 w-auto object-contain drop-shadow-lg" />
            <img src={pixLogoImg} alt="PIX - Banco Central" className="h-7 sm:h-10 w-auto object-contain drop-shadow-lg brightness-0 invert" />
          </div>
        </div>

        <div className="px-5 py-5 sm:px-6 sm:py-6 overflow-y-auto flex-1 custom-scrollbar">

          {/* ==================== STEP: FORM ==================== */}
          {step === "form" && (
            <div className="space-y-4">

              {/* Payment method */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground uppercase tracking-tight opacity-70">Forma de pagamento</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                  {pixAvailable && (
                    <button
                      onClick={() => setSelectedMethod("PIX")}
                      className={`relative flex items-center gap-3 rounded-xl border-2 p-3 sm:p-3.5 transition-all duration-200 ${
                        selectedMethod === "PIX"
                          ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20"
                          : "border-border/60 hover:border-border hover:bg-muted/30"
                      }`}
                    >
                      {selectedMethod === "PIX" && (
                        <div className="absolute top-2 right-2">
                          <Check className="h-3.5 w-3.5 text-primary" />
                        </div>
                      )}
                      <div className={`flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-lg shrink-0 ${
                        selectedMethod === "PIX" ? "bg-primary/10" : "bg-muted"
                      }`}>
                        <QrCode className={`h-4.5 w-4.5 sm:h-5 sm:w-5 ${selectedMethod === "PIX" ? "text-primary" : "text-muted-foreground"}`} />
                      </div>
                      <div className="text-left overflow-hidden">
                        <p className={`text-sm font-semibold truncate ${selectedMethod === "PIX" ? "text-primary" : "text-foreground"}`}>PIX</p>
                        <p className="text-[10px] text-muted-foreground truncate">Aprovação imediata</p>
                      </div>
                    </button>
                  )}

                  <button
                    disabled
                    className="relative flex items-center gap-3 rounded-xl border-2 border-dashed border-border/40 p-3 sm:p-3.5 opacity-50 cursor-not-allowed"
                  >
                    <div className="absolute top-2 right-2">
                      <Lock className="h-3 w-3 text-muted-foreground/40" />
                    </div>
                    <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-muted/50 shrink-0">
                      <CreditCard className="h-4.5 w-4.5 sm:h-5 sm:w-5 text-muted-foreground/50" />
                    </div>
                    <div className="text-left overflow-hidden">
                      <p className="text-sm font-medium text-muted-foreground truncate">Cartão</p>
                      <p className="text-[10px] text-muted-foreground/70 truncate">Em breve</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Billing info */}
              <div className="space-y-2.5">
                <label className="text-xs font-semibold text-foreground uppercase tracking-tight opacity-70">Dados do pagador</label>

                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
                  <Input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Nome completo"
                    className="h-10 pl-9 text-sm"
                    autoComplete="name"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
                    <Input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="E-mail"
                      type="email"
                      className="h-10 pl-9 text-sm"
                      autoComplete="email"
                    />
                  </div>

                  <div className="relative">
                    <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
                    <Input
                      value={cpf}
                      onChange={(e) => setCpf(formatCpf(e.target.value))}
                      placeholder="CPF — 000.000.000-00"
                      maxLength={14}
                      inputMode="numeric"
                      autoComplete="off"
                      className="h-10 pl-9 font-mono text-sm tracking-wider"
                    />
                  </div>
                </div>
              </div>

              {/* Order summary */}
              <div className="rounded-xl bg-muted/30 border border-border/40 p-3.5 sm:p-4 space-y-1.5">
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <span className="text-muted-foreground font-medium">Plano {planName}</span>
                  <span className="font-semibold text-foreground">{formatPrice(planPrice)}</span>
                </div>
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <span className="text-muted-foreground font-medium">Ciclo de faturamento</span>
                  <span className="text-muted-foreground font-medium">Mensal</span>
                </div>
                <div className="border-t border-border/30 pt-1.5 mt-1 flex items-center justify-between">
                  <span className="text-sm font-bold text-foreground">Total à pagar</span>
                  <span className="text-lg sm:text-xl font-extrabold text-foreground">{formatPrice(planPrice)}</span>
                </div>
              </div>

              {/* Submit */}
              <Button
                className="w-full h-12 text-base font-bold gap-2.5 shadow-md hover:shadow-lg transition-shadow"
                disabled={!isFormValid}
                onClick={generatePix}
              >
                <QrCode className="h-5 w-5" />
                Pagar com PIX — {formatPrice(planPrice)}
              </Button>

              <div className="flex items-center justify-center gap-4 mt-2">
                <img src={seloSeguroImg} alt="Compra 100% Segura" className="h-12 w-auto object-contain" />
                <img src={pixLogoImg} alt="PIX - Banco Central" className="h-8 w-auto object-contain" />
              </div>
            </div>
          )}

          {/* ==================== STEP: LOADING ==================== */}
          {step === "loading" && (
            <div className="py-14 flex flex-col items-center gap-5">
              <div className="relative">
                <div className={`h-20 w-20 rounded-full bg-gradient-to-br ${gradient} opacity-20 animate-ping`} />
                <Loader2 className="absolute inset-0 m-auto h-10 w-10 text-primary animate-spin" />
              </div>
              <div className="text-center space-y-1.5">
                <p className="text-lg font-bold text-foreground">Gerando cobrança PIX</p>
                <p className="text-sm text-muted-foreground">Isso leva apenas alguns segundos...</p>
              </div>
            </div>
          )}

          {/* ==================== STEP: PIX ==================== */}
          {step === "pix" && (
            <div className="space-y-5">
              {/* Timer */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Timer className={`h-4 w-4 ${isUrgent ? "text-destructive" : "text-amber-500"}`} />
                    <span className={`text-sm font-bold ${isUrgent ? "text-destructive" : "text-amber-600"}`}>
                      {countdown > 0 ? `Expira em ${fmtTimer(countdown)}` : "Expirado"}
                    </span>
                  </div>
                  <Badge variant="outline" className="text-[10px] gap-1.5 font-medium">
                    <div className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                    Aguardando pagamento
                  </Badge>
                </div>
                <Progress
                  value={countdownPercent}
                  className={`h-1.5 ${isUrgent ? "[&>div]:bg-destructive" : "[&>div]:bg-amber-500"}`}
                />
              </div>

              {/* QR Code */}
              <div className="flex flex-col items-center gap-3">
                <div className="p-3 sm:p-4 bg-white rounded-xl sm:rounded-2xl shadow-lg border border-border/20">
                  {pixQrBase64 ? (
                    <img
                      src={pixQrBase64.startsWith("data:") ? pixQrBase64 : `data:image/png;base64,${pixQrBase64}`}
                      alt="QR Code PIX"
                      className="w-48 h-48 sm:w-56 sm:h-56 rounded-lg sm:rounded-xl"
                    />
                  ) : (
                    <div className="w-48 h-48 sm:w-56 sm:h-56 rounded-lg sm:rounded-xl bg-muted flex items-center justify-center">
                      <QrCode className="h-20 w-20 sm:h-24 sm:w-24 text-muted-foreground/20" />
                    </div>
                  )}
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground text-center font-medium max-w-[240px]">
                  Escaneie o QR Code com o app do seu banco ou copie o código abaixo
                </p>
              </div>

              {/* Copy code */}
              {pixQrCode && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Código Pix Copia e Cola</label>
                  <div className="flex gap-2">
                    <div className="flex-1 rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5 font-mono text-[11px] break-all max-h-16 overflow-auto text-muted-foreground leading-relaxed">
                      {pixQrCode}
                    </div>
                    <Button variant="outline" size="icon" className="shrink-0 h-auto rounded-xl" onClick={copyCode}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Instructions */}
              <div className="rounded-xl bg-primary/5 border border-primary/10 p-4 space-y-2">
                <p className="text-xs font-bold text-foreground">Como pagar:</p>
                <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside leading-relaxed">
                  <li>Abra o app do seu banco</li>
                  <li>Escolha pagar com <strong>PIX</strong></li>
                  <li>Escaneie o QR Code ou cole o código</li>
                  <li>Confirme o pagamento</li>
                </ol>
                <p className="text-[11px] text-primary/80 pt-1 font-medium">
                  ✅ O plano será ativado automaticamente após a confirmação.
                </p>
              </div>

              <Button variant="outline" className="w-full gap-2 h-11 font-semibold" onClick={() => {
                toast.info("Verificando pagamento...");
              }}>
                <RotateCcw className="h-4 w-4" /> Já paguei — Verificar pagamento
              </Button>
            </div>
          )}

          {/* ==================== STEP: SUCCESS ==================== */}
          {step === "success" && (
            <div className="py-6 space-y-6">
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="h-20 w-20 rounded-full bg-green-500/10 flex items-center justify-center ring-4 ring-green-500/10">
                  <CheckCircle2 className="h-11 w-11 text-green-500" />
                </div>
                <div>
                  <h3 className="text-2xl font-extrabold text-foreground">Pagamento Aprovado! 🎉</h3>
                  <p className="text-sm text-muted-foreground mt-1.5 max-w-xs mx-auto">
                    Seu plano <strong className="text-foreground">{planName}</strong> foi ativado com sucesso. Todos os recursos premium já estão disponíveis.
                  </p>
                </div>
              </div>

              {/* Receipt */}
              <div className="rounded-xl bg-muted/30 border border-border/40 p-5 space-y-3 text-sm">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Comprovante</p>
                <div className="space-y-2">
                  {[
                    ["Plano", planName],
                    ["Valor", formatPrice(planPrice)],
                    ["Método", "PIX"],
                    ["Pagador", fullName || "—"],
                    ["Data", new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between items-center">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-semibold text-foreground">{value}</span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Status</span>
                    <Badge className="bg-green-500/10 text-green-600 border-green-500/20 text-[10px] font-bold">✓ Aprovado</Badge>
                  </div>
                  {transactionId && (
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">ID</span>
                      <span className="font-mono text-xs text-muted-foreground">{transactionId.slice(0, 20)}…</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1 gap-2 h-11" onClick={() => {
                  const receipt = [
                    "═══════════════════════════════════",
                    "       COMPROVANTE DE PAGAMENTO",
                    "═══════════════════════════════════",
                    "",
                    `Plano:    ${planName}`,
                    `Valor:    ${formatPrice(planPrice)}`,
                    `Método:   PIX`,
                    `Pagador:  ${fullName}`,
                    `CPF:      ${cpf}`,
                    `Data:     ${new Date().toLocaleString("pt-BR")}`,
                    `Status:   APROVADO`,
                    `ID:       ${transactionId}`,
                    "",
                    "═══════════════════════════════════",
                    " Obrigado pela sua assinatura! ",
                    "═══════════════════════════════════",
                  ].join("\n");
                  const blob = new Blob([receipt], { type: "text/plain" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url; a.download = `comprovante-${planName.toLowerCase()}.txt`;
                  a.click(); URL.revokeObjectURL(url);
                }}>
                  <Download className="h-4 w-4" /> Baixar comprovante
                </Button>
                <Button className="flex-1 h-11 font-bold" onClick={() => onOpenChange(false)}>
                  Ir para o painel
                </Button>
              </div>
            </div>
          )}

          {/* ==================== STEP: EXPIRED ==================== */}
          {step === "expired" && (
            <div className="py-10 space-y-5">
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="h-18 w-18 rounded-full bg-amber-500/10 flex items-center justify-center ring-4 ring-amber-500/10">
                  <Timer className="h-10 w-10 text-amber-500" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">QR Code expirado</h3>
                  <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
                    O tempo para pagamento expirou. Gere um novo QR Code para continuar.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1 h-11" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                <Button className="flex-1 gap-2 h-11 font-bold" onClick={restart}>
                  <QrCode className="h-4 w-4" /> Gerar novo PIX
                </Button>
              </div>
            </div>
          )}

          {/* ==================== STEP: ERROR ==================== */}
          {step === "error" && (
            <div className="py-10 space-y-5">
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="h-18 w-18 rounded-full bg-destructive/10 flex items-center justify-center ring-4 ring-destructive/10">
                  <AlertTriangle className="h-10 w-10 text-destructive" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">Erro no pagamento</h3>
                  <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
                    {errorMsg || "Não foi possível processar o pagamento. Tente novamente."}
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1 h-11" onClick={() => onOpenChange(false)}>
                  Fechar
                </Button>
                <Button className="flex-1 gap-2 h-11 font-bold" onClick={restart}>
                  <RotateCcw className="h-4 w-4" /> Tentar novamente
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
