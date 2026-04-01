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
  X, AlertTriangle, RotateCcw, Download, ArrowLeft, Sparkles, Lock,
} from "lucide-react";
import { toast } from "sonner";
import confetti from "canvas-confetti";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
type CheckoutStep =
  | "form"       // initial – pick method + CPF
  | "loading"    // generating charge
  | "pix"        // QR code displayed
  | "success"    // payment confirmed
  | "expired"    // PIX expired
  | "error";     // gateway error

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

const PIX_TIMEOUT = 20 * 60; // 20 minutes

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
export default function PlanCheckoutModal({
  open, onOpenChange, planId, planName, planPrice, userId, availableMethods,
}: PlanCheckoutModalProps) {
  const queryClient = useQueryClient();

  // State
  const [step, setStep] = useState<CheckoutStep>("form");
  const [selectedMethod, setSelectedMethod] = useState<"PIX" | "CREDIT_CARD">("PIX");
  const [cpf, setCpf] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // PIX data
  const [pixQrCode, setPixQrCode] = useState("");
  const [pixQrBase64, setPixQrBase64] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [transactionId, setTransactionId] = useState("");

  // Refs
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup on close
  useEffect(() => {
    if (!open) {
      clearTimers();
      // Reset after animation
      const t = setTimeout(() => {
        setStep("form");
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

  // Countdown effect
  useEffect(() => {
    if (countdown <= 0 && countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
      if (step === "pix") setStep("expired");
    }
  }, [countdown, step]);

  // Cleanup on unmount
  useEffect(() => () => clearTimers(), []);

  const clearTimers = useCallback(() => {
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
  }, []);

  /* ------ Fire confetti ------ */
  const fireConfetti = () => {
    const end = Date.now() + 2500;
    const frame = () => {
      confetti({ particleCount: 4, angle: 60, spread: 55, origin: { x: 0 } });
      confetti({ particleCount: 4, angle: 120, spread: 55, origin: { x: 1 } });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
  };

  /* ------ Start polling subscription status ------ */
  const startPolling = useCallback(() => {
    if (pollingRef.current) clearInterval(pollingRef.current);

    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    pollingRef.current = setInterval(async () => {
      try {
        // Check subscription status
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

  /* ------ Generate PIX payment ------ */
  const generatePix = async () => {
    const cpfClean = cpf.replace(/\D/g, "");
    if (cpfClean.length !== 11) {
      toast.error("Informe um CPF válido com 11 dígitos.");
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
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Erro ao gerar cobrança");

      // If approved immediately
      if (data.status === "approved") {
        setStep("success");
        fireConfetti();
        queryClient.invalidateQueries({ queryKey: ["tenant_context"] });
        return;
      }

      // PIX generated
      if (data.pix?.qrCode) {
        setPixQrCode(data.pix.qrCode);
        setPixQrBase64(data.pix.qrCodeBase64 || "");
        setTransactionId(data.transaction_id || "");
        setStep("pix");

        // Start countdown
        setCountdown(PIX_TIMEOUT);
        countdownRef.current = setInterval(() => {
          setCountdown(prev => {
            if (prev <= 1) return 0;
            return prev - 1;
          });
        }, 1000);

        // Start polling
        startPolling();
      } else {
        throw new Error("QR Code não foi gerado. Tente novamente.");
      }
    } catch (e: any) {
      setErrorMsg(e.message || "Erro ao processar pagamento");
      setStep("error");
    }
  };

  /* ------ Copy to clipboard ------ */
  const copyCode = () => {
    navigator.clipboard.writeText(pixQrCode);
    toast.success("Código PIX copiado!");
  };

  /* ------ Restart ------ */
  const restart = () => {
    clearTimers();
    setPixQrCode("");
    setPixQrBase64("");
    setCountdown(0);
    setTransactionId("");
    setErrorMsg("");
    setStep("form");
  };

  /* ------ Check if card is available ------ */
  const cardAvailable = availableMethods.includes("CREDIT_CARD");
  const pixAvailable = availableMethods.includes("PIX");

  /* ------ Countdown progress ------ */
  const countdownPercent = (countdown / PIX_TIMEOUT) * 100;
  const isUrgent = countdown > 0 && countdown < 120;

  /* ================================================================ */
  /*  RENDER                                                           */
  /* ================================================================ */
  return (
    <Dialog open={open} onOpenChange={(o) => { if (step !== "loading") onOpenChange(o); }}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden border-border/50 shadow-2xl [&>button]:hidden">
        {/* Header bar */}
        <div className="relative bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-6 py-5 border-b border-border/40">
          <button
            onClick={() => { if (step !== "loading") onOpenChange(false); }}
            className="absolute right-4 top-4 rounded-full p-1.5 hover:bg-muted/80 transition-colors"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>

          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Ativar Plano {planName}</h2>
              <p className="text-sm text-muted-foreground">{formatPrice(planPrice)}/mês</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-5">
          {/* ==================== STEP: FORM ==================== */}
          {step === "form" && (
            <div className="space-y-5">
              {/* Method selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Método de pagamento</label>
                <div className="grid grid-cols-2 gap-2">
                  {/* PIX button */}
                  {pixAvailable && (
                    <button
                      onClick={() => setSelectedMethod("PIX")}
                      className={`relative flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all duration-200 ${
                        selectedMethod === "PIX"
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border/60 hover:border-border hover:bg-muted/30"
                      }`}
                    >
                      {selectedMethod === "PIX" && (
                        <div className="absolute top-2 right-2 h-2 w-2 rounded-full bg-primary" />
                      )}
                      <QrCode className={`h-6 w-6 ${selectedMethod === "PIX" ? "text-primary" : "text-muted-foreground"}`} />
                      <span className={`text-sm font-medium ${selectedMethod === "PIX" ? "text-primary" : "text-foreground"}`}>
                        PIX
                      </span>
                      <span className="text-[10px] text-muted-foreground">Aprovação instantânea</span>
                    </button>
                  )}

                  {/* Card button */}
                  <button
                    disabled
                    className="relative flex flex-col items-center gap-2 rounded-xl border-2 border-border/40 p-4 opacity-50 cursor-not-allowed"
                  >
                    <Lock className="absolute top-2 right-2 h-3 w-3 text-muted-foreground/50" />
                    <CreditCard className="h-6 w-6 text-muted-foreground" />
                    <span className="text-sm font-medium text-muted-foreground">Cartão</span>
                    <span className="text-[10px] text-muted-foreground">Em breve</span>
                  </button>
                </div>
              </div>

              {/* CPF */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">CPF do pagador</label>
                <Input
                  value={cpf}
                  onChange={(e) => setCpf(formatCpf(e.target.value))}
                  placeholder="000.000.000-00"
                  maxLength={14}
                  inputMode="numeric"
                  autoComplete="off"
                  className="h-11 font-mono text-base tracking-wider"
                />
              </div>

              {/* Order summary */}
              <div className="rounded-xl bg-muted/40 border border-border/40 p-4 space-y-2.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Plano</span>
                  <span className="font-semibold text-foreground">{planName}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Cobrança</span>
                  <span className="text-muted-foreground">Mensal</span>
                </div>
                <div className="border-t border-border/40 pt-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">Total</span>
                  <span className="text-lg font-bold text-foreground">{formatPrice(planPrice)}</span>
                </div>
              </div>

              {/* Submit */}
              <Button
                className="w-full h-12 text-base font-semibold gap-2"
                disabled={cpf.replace(/\D/g, "").length !== 11}
                onClick={generatePix}
              >
                <QrCode className="h-5 w-5" />
                Gerar PIX — {formatPrice(planPrice)}
              </Button>

              <p className="text-[10px] text-center text-muted-foreground flex items-center justify-center gap-1">
                <Shield className="h-3 w-3" /> Pagamento seguro e criptografado
              </p>
            </div>
          )}

          {/* ==================== STEP: LOADING ==================== */}
          {step === "loading" && (
            <div className="py-12 flex flex-col items-center gap-4">
              <div className="relative">
                <div className="h-16 w-16 rounded-full border-4 border-muted animate-pulse" />
                <Loader2 className="absolute inset-0 m-auto h-8 w-8 text-primary animate-spin" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-base font-semibold text-foreground">Gerando cobrança PIX...</p>
                <p className="text-sm text-muted-foreground">Isso leva apenas alguns segundos</p>
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
                    <Timer className={`h-4 w-4 ${isUrgent ? "text-red-500" : "text-amber-500"}`} />
                    <span className={`text-sm font-semibold ${isUrgent ? "text-red-500" : "text-amber-600"}`}>
                      {countdown > 0 ? `Expira em ${fmtTimer(countdown)}` : "Expirado"}
                    </span>
                  </div>
                  <Badge variant="outline" className="text-[10px] gap-1">
                    <div className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                    Aguardando
                  </Badge>
                </div>
                <Progress
                  value={countdownPercent}
                  className={`h-1.5 ${isUrgent ? "[&>div]:bg-red-500" : "[&>div]:bg-amber-500"}`}
                />
              </div>

              {/* QR Code */}
              <div className="flex flex-col items-center gap-4">
                <div className="p-3 bg-white rounded-2xl shadow-md border border-border/30">
                  {pixQrBase64 ? (
                    <img
                      src={pixQrBase64.startsWith("data:") ? pixQrBase64 : `data:image/png;base64,${pixQrBase64}`}
                      alt="QR Code PIX"
                      className="w-52 h-52 rounded-lg"
                    />
                  ) : (
                    <div className="w-52 h-52 rounded-lg bg-muted flex items-center justify-center">
                      <QrCode className="h-20 w-20 text-muted-foreground/30" />
                    </div>
                  )}
                </div>

                <p className="text-sm text-muted-foreground text-center">
                  Escaneie o QR Code com o app do seu banco
                </p>
              </div>

              {/* Copy code */}
              {pixQrCode && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Código Pix Copia e Cola</label>
                  <div className="flex gap-2">
                    <div className="flex-1 rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5 font-mono text-xs break-all max-h-16 overflow-auto text-muted-foreground">
                      {pixQrCode}
                    </div>
                    <Button variant="outline" size="icon" className="shrink-0 h-auto" onClick={copyCode}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Instructions */}
              <div className="rounded-xl bg-primary/5 border border-primary/10 p-3.5 space-y-1.5">
                <p className="text-xs font-semibold text-foreground">Como pagar:</p>
                <ol className="text-xs text-muted-foreground space-y-0.5 list-decimal list-inside">
                  <li>Abra o app do seu banco</li>
                  <li>Escolha pagar com PIX</li>
                  <li>Escaneie o QR Code ou cole o código</li>
                  <li>Confirme o pagamento</li>
                </ol>
                <p className="text-[10px] text-muted-foreground pt-1">
                  ✅ O plano será ativado automaticamente após a confirmação.
                </p>
              </div>

              {/* Check payment button */}
              <Button variant="outline" className="w-full gap-2" onClick={() => {
                toast.info("Verificando pagamento...");
                // The polling is already running; this just reassures the user
              }}>
                <RotateCcw className="h-4 w-4" /> Já paguei — Verificar pagamento
              </Button>
            </div>
          )}

          {/* ==================== STEP: SUCCESS ==================== */}
          {step === "success" && (
            <div className="py-6 space-y-5">
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center">
                  <CheckCircle2 className="h-9 w-9 text-green-500" />
                </div>
                <h3 className="text-xl font-bold text-foreground">Pagamento Aprovado! 🎉</h3>
                <p className="text-sm text-muted-foreground max-w-xs">
                  Seu plano <strong>{planName}</strong> foi ativado com sucesso. Todos os recursos premium já estão disponíveis.
                </p>
              </div>

              {/* Receipt */}
              <div className="rounded-xl bg-muted/40 border border-border/40 p-4 space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Plano</span>
                  <span className="font-semibold">{planName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Valor</span>
                  <span className="font-semibold">{formatPrice(planPrice)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Método</span>
                  <span>PIX</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Data</span>
                  <span>{new Date().toLocaleDateString("pt-BR")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <Badge className="bg-green-500/10 text-green-600 border-green-500/20 text-[10px]">Aprovado</Badge>
                </div>
                {transactionId && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ID</span>
                    <span className="font-mono text-xs">{transactionId.slice(0, 16)}…</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 gap-2" onClick={() => {
                  // Simple text-based receipt download
                  const receipt = `Comprovante de Pagamento\n\nPlano: ${planName}\nValor: ${formatPrice(planPrice)}\nMétodo: PIX\nData: ${new Date().toLocaleString("pt-BR")}\nStatus: Aprovado\nID: ${transactionId}\n`;
                  const blob = new Blob([receipt], { type: "text/plain" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url; a.download = `comprovante-${planName.toLowerCase()}.txt`;
                  a.click(); URL.revokeObjectURL(url);
                }}>
                  <Download className="h-4 w-4" /> Comprovante
                </Button>
                <Button className="flex-1" onClick={() => onOpenChange(false)}>
                  Ir para o painel
                </Button>
              </div>
            </div>
          )}

          {/* ==================== STEP: EXPIRED ==================== */}
          {step === "expired" && (
            <div className="py-8 space-y-5">
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="h-16 w-16 rounded-full bg-amber-500/10 flex items-center justify-center">
                  <Timer className="h-8 w-8 text-amber-500" />
                </div>
                <h3 className="text-lg font-bold text-foreground">QR Code expirado</h3>
                <p className="text-sm text-muted-foreground max-w-xs">
                  O tempo para pagamento expirou. Gere um novo QR Code para continuar.
                </p>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                <Button className="flex-1 gap-2" onClick={restart}>
                  <QrCode className="h-4 w-4" /> Gerar novo PIX
                </Button>
              </div>
            </div>
          )}

          {/* ==================== STEP: ERROR ==================== */}
          {step === "error" && (
            <div className="py-8 space-y-5">
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
                  <AlertTriangle className="h-8 w-8 text-destructive" />
                </div>
                <h3 className="text-lg font-bold text-foreground">Erro no pagamento</h3>
                <p className="text-sm text-muted-foreground max-w-xs">
                  {errorMsg || "Não foi possível processar o pagamento. Tente novamente."}
                </p>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
                  Fechar
                </Button>
                <Button className="flex-1 gap-2" onClick={restart}>
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
