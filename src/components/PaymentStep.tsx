import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, QrCode, CreditCard, FileText, Copy, CheckCircle, ExternalLink, XCircle, Clock, Save, Zap, AlertCircle } from "lucide-react";
import { useCreatePayment } from "@/hooks/usePayments";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { motion, AnimatePresence } from "framer-motion";
import pixLogo from "@/assets/pix-logo.webp";
import { PaymentFlags } from "@/components/storefront/PaymentFlags";
import siteSeguro from "@/assets/site-seguro.webp";
import compraSegura from "@/assets/compra-segura.webp";

declare global {
  interface Window {
    MercadoPago: any;
    PagSeguro: any;
  }
}

interface PaymentStepProps {
  orderId: string;
  storeUserId: string;
  total: number;
  settings: any;
  onSuccess: (method?: string, cpf?: string) => void;
  initialCpf?: string;
}

interface CpfInputFieldProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
}

const formatPrice = (price: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(price);

const formatCpf = (v: string) => {
  const nums = v.replace(/\D/g, "").slice(0, 11);
  if (nums.length <= 3) return nums;
  if (nums.length <= 6) return nums.slice(0, 3) + "." + nums.slice(3);
  if (nums.length <= 9) return nums.slice(0, 3) + "." + nums.slice(3, 6) + "." + nums.slice(6);
  return nums.slice(0, 3) + "." + nums.slice(3, 6) + "." + nums.slice(6, 9) + "-" + nums.slice(9);
};

function CpfInputField({ label = "CPF", value, onChange }: CpfInputFieldProps) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        placeholder="000.000.000-00"
        value={value}
        onChange={(e) => onChange(formatCpf(e.target.value))}
        maxLength={14}
        inputMode="numeric"
        autoComplete="off"
        className="font-mono"
      />
      <p className="text-[10px] text-muted-foreground">Obrigatório para processamento do pagamento</p>
    </div>
  );
}

function CardMachineAnimation({ status }: { status: "processing" | "approved" | "rejected" | null }) {
  return (
    <div className="flex flex-col items-center justify-center p-8 bg-muted/30 rounded-xl border-2 border-dashed border-muted-foreground/20 mb-6">
      <div className="relative w-48 h-64 bg-slate-800 rounded-2xl shadow-2xl flex flex-col items-center p-4 border-4 border-slate-700">
        {/* Machine Screen */}
        <div className="w-full h-24 bg-blue-900/50 rounded-lg border-2 border-slate-600 mb-6 flex flex-col items-center justify-center overflow-hidden relative">
          <AnimatePresence mode="wait">
            {status === "processing" && (
              <motion.div
                key="processing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center"
              >
                <Loader2 className="h-8 w-8 text-blue-400 animate-spin mb-2" />
                <span className="text-[10px] text-blue-200 uppercase font-bold tracking-widest">Processando</span>
              </motion.div>
            )}
            {status === "approved" && (
              <motion.div
                key="approved"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex flex-col items-center"
              >
                <CheckCircle className="h-10 w-10 text-green-400 mb-1" />
                <span className="text-[10px] text-green-300 uppercase font-bold tracking-widest">Aprovado</span>
              </motion.div>
            )}
            {status === "rejected" && (
              <motion.div
                key="rejected"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex flex-col items-center"
              >
                <XCircle className="h-10 w-10 text-red-400 mb-1" />
                <span className="text-[10px] text-red-300 uppercase font-bold tracking-widest">Recusado</span>
              </motion.div>
            )}
          </AnimatePresence>
          {/* Scanning line effect */}
          {status === "processing" && (
            <motion.div
              animate={{ top: ["0%", "100%", "0%"] }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="absolute left-0 right-0 h-0.5 bg-blue-400/30 blur-sm z-10"
            />
          )}
        </div>

        {/* Buttons Grid */}
        <div className="grid grid-cols-3 gap-2 w-full">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
            <div key={n} className="h-4 bg-slate-700 rounded-sm" />
          ))}
          <div className="h-4 bg-red-500/50 rounded-sm" />
          <div className="h-4 bg-yellow-500/50 rounded-sm" />
          <div className="h-4 bg-green-500/50 rounded-sm" />
        </div>

        {/* Card Slot Animation */}
        <AnimatePresence>
          {status === "processing" && (
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 40, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              transition={{ type: "spring", damping: 15 }}
              className="absolute -bottom-8 w-32 h-20 bg-gradient-to-br from-gray-200 to-gray-400 rounded-lg shadow-xl border border-gray-300 flex items-center px-4"
            >
              <div className="w-8 h-6 bg-yellow-400/80 rounded-sm" />
              <div className="ml-2 w-16 h-1 bg-gray-500/30 rounded-full" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <p className="mt-6 text-sm font-medium text-muted-foreground animate-pulse">
        {status === "processing" ? "Comunicando com a operadora..." : status === "approved" ? "Pagamento confirmado!" : "Ops! Tente outro cartão."}
      </p>
    </div>
  );
}

export default function PaymentStep({ orderId, storeUserId, total, settings, onSuccess, initialCpf = "" }: PaymentStepProps) {
  const [selectedMethod, setSelectedMethod] = useState<"pix" | "credit_card" | "boleto" | "stripe" | null>(null);
  const [paymentData, setPaymentData] = useState<any>(null);
  const [showCardForm, setShowCardForm] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
  const [tokenizing, setTokenizing] = useState(false);
  const [stripePromise, setStripePromise] = useState<any>(null);
  const createPayment = useCreatePayment();
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Card form state
  const [cardNumber, setCardNumber] = useState("");
  const [cardName, setCardName] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [cardInstallments, setCardInstallments] = useState("1");
  const [cardCpf, setCardCpf] = useState(initialCpf || "");
  const [saveCard, setSaveCard] = useState(false);
  const [cardType, setCardType] = useState<"credit" | "debit">("credit");
  const [mpIssuerId, setMpIssuerId] = useState<string>("");
  const [mpPaymentMethodId, setMpPaymentMethodId] = useState<string>("");
  const [mpInstallmentsOptions, setMpInstallmentsOptions] = useState<any[]>([]);

  // PIX/Boleto CPF
  const [payerCpf, setPayerCpf] = useState(initialCpf || "");

  useEffect(() => {
    if (settings?.payment_gateway === "stripe" && settings?.gateway_public_key) {
      setStripePromise(loadStripe(settings.gateway_public_key));
    }
  }, [settings]);

  const [isProcessingAnimation, setIsProcessingAnimation] = useState(false);
  const [animationStatus, setAnimationStatus] = useState<"processing" | "approved" | "rejected" | null>(null);

  // Realtime order status tracking
  useEffect(() => {
    if (!orderId) return;

    const channel = supabase
      .channel(`order-status-${orderId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `id=eq.${orderId}`,
        },
        (payload) => {
          const newStatus = payload.new.status;
          if (["processando", "pago", "aprovado", "approved", "enviado", "entregue"].includes(newStatus?.toLowerCase())) {
            setAnimationStatus("approved");
            toast.success("💰 Pedido confirmado e aprovado!");
            setTimeout(() => {
              onSuccess(selectedMethod || "gateway", selectedMethod === "credit_card" ? cardCpf : payerCpf);
            }, 2000);
          }
        }
      )
      .subscribe();

    // Also check current status immediately in case it was already updated
    const checkStatus = async () => {
      const { data } = await supabase
        .from("orders")
        .select("status")
        .eq("id", orderId)
        .single();
      
      if (data && ["processando", "pago", "aprovado", "approved", "enviado", "entregue"].includes(data.status?.toLowerCase())) {
        onSuccess(selectedMethod || "gateway", selectedMethod === "credit_card" ? cardCpf : payerCpf);
      }
    };
    checkStatus();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId, selectedMethod, cardCpf, payerCpf, onSuccess]);

  // Poll payment status for PIX/Boleto
  useEffect(() => {
    if (!paymentData?.payment?.id) return;
    const paymentId = paymentData.payment.id;

    const poll = async () => {
      const { data } = await supabase
        .from("payments")
        .select("status")
        .eq("id", paymentId)
        .single();
      if (data?.status === "approved" || data?.status === "paid") {
        setPaymentStatus("approved");
        toast.success("💰 Pagamento confirmado!");
        if (pollingRef.current) clearInterval(pollingRef.current);
        setTimeout(() => onSuccess(selectedMethod || undefined, selectedMethod === "credit_card" ? cardCpf : payerCpf), 1500);
      } else if (data?.status === "rejected" || data?.status === "failed") {
        setPaymentStatus("rejected");
        toast.error("Pagamento recusado");
        if (pollingRef.current) clearInterval(pollingRef.current);
      }
    };

    pollingRef.current = setInterval(poll, 5000);
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [paymentData?.payment?.id, selectedMethod]);

  // Auto-redirect for credit card if it's already approved but we are showing the intermediate screen
  useEffect(() => {
    if (paymentData && selectedMethod === "credit_card" && !paymentStatus) {
      const timer = setTimeout(() => onSuccess("credit_card", cardCpf), 3000);
      return () => clearTimeout(timer);
    }
  }, [paymentData, selectedMethod, paymentStatus]);

  // Handle Mercado Pago BIN check
  useEffect(() => {
    const bin = cardNumber.replace(/\s/g, "").slice(0, 6);
    if (bin.length === 6 && settings?.payment_gateway === "mercadopago") {
      const fetchMPDetails = async () => {
        try {
          if (!window.MercadoPago) return;
          const mp = new window.MercadoPago(settings.gateway_public_key, { locale: "pt-BR" });
          
          const methods = await mp.getPaymentMethods({ bin });
          if (methods && methods.length > 0) {
            const method = methods[0];
            setMpPaymentMethodId(method.id);
            
            const issuers = await mp.getIssuers({ paymentMethodId: method.id, bin });
            if (issuers && issuers.length > 0) {
              setMpIssuerId(issuers[0].id);
            }
            
            const installments = await mp.getInstallments({ 
              amount: String(total), 
              bin, 
              paymentTypeId: "credit_card" 
            });
            if (installments && installments.length > 0) {
              setMpInstallmentsOptions(installments[0].payer_costs || []);
            }
          }
        } catch (e) {
          console.error("Error fetching MP details by BIN:", e);
        }
      };
      fetchMPDetails();
    }
  }, [cardNumber, settings?.payment_gateway, settings?.gateway_public_key, total]);

  const availableMethods = [
    { id: "pix" as const, label: "PIX", desc: "Pagamento instantâneo", icon: QrCode, enabled: settings?.payment_pix },
    { id: "credit_card" as const, label: "Cartão", desc: "Crédito ou Débito", icon: CreditCard, enabled: settings?.payment_credit_card },
    { id: "boleto" as const, label: "Boleto Bancário", desc: "Vencimento em 3 dias úteis", icon: FileText, enabled: settings?.payment_boleto },
  ].filter((m) => m.enabled);

  const isStripe = settings?.payment_gateway === "stripe";

  const formatCardNumber = (v: string) => {
    const nums = v.replace(/\D/g, "").slice(0, 16);
    return nums.replace(/(\d{4})(?=\d)/g, "$1 ");
  };

  const formatExpiry = (v: string) => {
    const nums = v.replace(/\D/g, "").slice(0, 4);
    if (nums.length > 2) return nums.slice(0, 2) + "/" + nums.slice(2);
    return nums;
  };

  const generateCardToken = async (gateway: string): Promise<any> => {
    const publicKey = settings?.gateway_public_key;
    if (!publicKey) throw new Error("Chave pública do gateway não configurada");

    const [expMonth, expYear] = cardExpiry.split("/");
    const fullYear = expYear?.length === 2 ? `20${expYear}` : expYear;

    if (gateway === "mercadopago") {
      if (!window.MercadoPago) throw new Error("SDK do Mercado Pago não carregado.");
      const mp = new window.MercadoPago(publicKey, { locale: "pt-BR" });
      
      // Get Device ID for anti-fraud
      let deviceId = "";
      try {
        if (typeof mp.getDeviceId === 'function') {
          deviceId = mp.getDeviceId();
        } else {
          deviceId = (window as any).MP_DEVICE_SESSION_ID || (window as any).deviceId || "";
        }
      } catch (e) {
        console.warn("Could not get MP Device ID:", e);
      }
      
      const cardData = {
        cardNumber: cardNumber.replace(/\s/g, ""),
        cardholderName: cardName,
        cardExpirationMonth: expMonth,
        cardExpirationYear: fullYear,
        securityCode: cardCvv,
        identificationType: cardCpf.replace(/\D/g, "").length > 11 ? "CNPJ" : "CPF",
        identificationNumber: cardCpf.replace(/\D/g, ""),
      } as any;
      
      if (mpIssuerId) cardData.issuerId = mpIssuerId;
      if (mpPaymentMethodId) cardData.paymentMethodId = mpPaymentMethodId;
      
      const tokenResponse = await mp.createCardToken(cardData);
      if (!tokenResponse?.id) throw new Error("Não foi possível gerar o token do cartão Mercado Pago.");
      
      return { 
        token: tokenResponse.id, 
        deviceId,
        issuer_id: mpIssuerId,
        payment_method_id: mpPaymentMethodId
      };
    } else if (gateway === "pagbank") {
      if (!window.PagSeguro) throw new Error("SDK do PagBank não carregado.");
      
      return new Promise((resolve, reject) => {
        try {
          const card = window.PagSeguro.encryptCard({
            publicKey: publicKey,
            holder: cardName,
            number: cardNumber.replace(/\s/g, ""),
            expMonth: expMonth,
            expYear: fullYear,
            securityCode: cardCvv,
          });
          
          if (card?.encryptedCard) {
            resolve({ token: card.encryptedCard });
          } else {
            reject(new Error("Erro ao criptografar cartão PagBank."));
          }
        } catch (err: any) {
          reject(new Error("Erro no SDK do PagBank: " + err.message));
        }
      });
    }

    return { token: cardNumber.replace(/\s/g, "") };
  };

  const handlePay = async (method: "pix" | "credit_card" | "boleto") => {
    if (method === "credit_card" && !showCardForm) {
      setShowCardForm(true);
      setSelectedMethod(method);
      return;
    }

    // Validate CPF for PIX/Boleto
    if ((method === "pix" || method === "boleto") && settings?.payment_gateway === "mercadopago") {
      const cpfClean = payerCpf.replace(/\D/g, "");
      if (cpfClean.length !== 11) {
        toast.error("Informe um CPF válido para continuar");
        return;
      }
    }

    if (method === "credit_card") {
      if (!cardNumber || !cardName || !cardExpiry || !cardCvv) {
        toast.error("Preencha todos os dados do cartão");
        return;
      }
      const cpfClean = cardCpf.replace(/\D/g, "");
      if (cpfClean.length !== 11) {
        toast.error("Informe o CPF do titular do cartão");
        return;
      }
    }

    if (method === "credit_card") {
      setIsProcessingAnimation(true);
      setAnimationStatus("processing");
    }
    setSelectedMethod(method);
    try {
      const params: any = {
        order_id: orderId,
        method,
        store_user_id: storeUserId,
      };

      // Split cardName into first and last name for more reliable processing
      const nameParts = cardName.trim().split(" ");
      if (method === "credit_card") {
        params.payer_first_name = nameParts[0];
        params.payer_last_name = nameParts.slice(1).join(" ") || nameParts[0];
      }

      if (method === "credit_card") {
        // Use Mercado Pago SDK to generate a proper card token
        if (settings?.payment_gateway === "mercadopago" || settings?.payment_gateway === "pagbank") {
          setTokenizing(true);
          try {
            const cardResult = await generateCardToken(settings.payment_gateway);
            params.card_token = cardResult.token;
            params.device_id = cardResult.deviceId;
            params.issuer_id = cardResult.issuer_id;
            params.payment_method_id = cardResult.payment_method_id;
            params.installments = Number(cardInstallments);
            params.card_type = cardType;
          } catch (tokenErr: any) {
            toast.error(tokenErr.message || "Erro ao processar dados do cartão");
            setTokenizing(false);
            return;
          }
          setTokenizing(false);
        } else {
          // For other gateways, send raw or handle differently
          params.card_token = cardNumber.replace(/\s/g, "");
        }
        params.installments = cardType === "debit" ? 1 : parseInt(cardInstallments);
        params.payer_cpf = cardCpf.replace(/\D/g, "");
        params.card_type = cardType;
      }

      if (method === "pix" || method === "boleto") {
        params.payer_cpf = payerCpf.replace(/\D/g, "");
      }

      const result = await createPayment.mutateAsync(params);
      setPaymentData(result);

      if (result.paymentResult?.status === "approved" || result.paymentResult?.status === "paid" || result.payment?.status === "approved" || result.payment?.status === "paid") {
        toast.success("Pagamento aprovado!");
        onSuccess(method, method === "credit_card" ? cardCpf : payerCpf);
      } else if (result.paymentResult?.client_secret) {
        // Stripe confirmation flow
        if (stripePromise) {
          const stripe = await stripePromise;
          const { error: stripeError } = await stripe.confirmPayment({
            clientSecret: result.paymentResult.client_secret,
            confirmParams: {
              return_url: `${window.location.origin}/loja/${settings?.store_slug}/checkout/success`,
            },
            redirect: "if_required",
          });
          if (stripeError) {
            toast.error(stripeError.message);
          } else {
            onSuccess(method, payerCpf);
          }
        }
      } else if (result.paymentResult?.status === "rejected" || result.payment?.status === "rejected") {
        const detail = result.paymentResult?.status_detail || result.payment?.status_detail;
        let message = "Pagamento recusado pela operadora. Verifique os dados ou tente outro cartão.";
        
        if (detail === "cc_rejected_high_risk") {
          message = "Pagamento recusado por segurança (Risco Alto). Tente outro cartão ou use PIX.";
        } else if (detail === "cc_rejected_insufficient_amount") {
          message = "Saldo insuficiente no cartão.";
        } else if (detail === "cc_rejected_bad_filled_other") {
          message = "Dados do cartão incorretos. Verifique o número, validade e CVV.";
        } else if (detail === "cc_rejected_call_for_authorize") {
          message = "Pagamento requer autorização da operadora. Ligue para seu banco ou use outro método.";
        }
        
        toast.error(message, { duration: 5000 });
        setPaymentData(null); // Clear to allow retry
      } else {
        // Pending status (PIX/Boleto)
        if (method === "pix" || method === "boleto") {
          toast.info("Aguardando pagamento...");
        } else {
          toast.warning("Seu pagamento está em análise pelo gateway.");
        }
      }
    } catch (err: any) {
      if (method === "credit_card") {
        setAnimationStatus("rejected");
        setTimeout(() => {
          setIsProcessingAnimation(false);
          setAnimationStatus(null);
        }, 3000);
      }
      toast.error(err.message || "Erro ao processar pagamento");
      if (method !== "credit_card") setSelectedMethod(null);
    }
  };

  const StripeExpressCheckout = () => {
    const stripe = useStripe();
    const elements = useElements();
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const onConfirm = async (event: any) => {
      if (!stripe || !elements) return;

      const { error: submitError } = await elements.submit();
      if (submitError) {
        setErrorMessage(submitError.message || "Erro ao processar dados");
        return;
      }

      setTokenizing(true);
      try {
        const result = await createPayment.mutateAsync({
          order_id: orderId,
          method: "express",
          store_user_id: storeUserId,
        });

        if (result.paymentResult?.client_secret) {
          const { error } = await stripe.confirmPayment({
            elements,
            clientSecret: result.paymentResult.client_secret,
            confirmParams: {
              return_url: `${window.location.origin}/loja/${settings?.store_slug}/checkout/success`,
            },
            redirect: "if_required",
          });

          if (error) {
            setErrorMessage(error.message || "Erro na confirmação");
          } else {
            onSuccess("stripe", payerCpf);
          }
        }
      } catch (err: any) {
        setErrorMessage(err.message);
      } finally {
        setTokenizing(false);
      }
    };

    return (
      <div className="space-y-4">
        <div className="rounded-lg bg-muted p-4 border border-dashed border-primary/20">
          <p className="text-sm font-medium mb-3 flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500 fill-amber-500" /> 
            Checkout em 1-Clique (Apple & Google Pay)
          </p>
          {/* Note: ExpressCheckoutElement requires a clientSecret or paymentIntent data */}
          {/* For simplicity in this fast edit, we'll use a generic button or let Stripe handle it */}
          <div className="bg-white p-2 rounded">
             <PaymentElement options={{ layout: 'tabs' }} />
          </div>
          <Button onClick={onConfirm} className="w-full mt-4 bg-black hover:bg-black/90 text-white font-bold h-12">
            Pagar com 1-Clique 🚀
          </Button>
          {errorMessage && <p className="text-xs text-destructive mt-2">{errorMessage}</p>}
        </div>
      </div>
    );
  };


  const copyPixCode = () => {
    const code = paymentData?.paymentResult?.pix_qr_code || paymentData?.payment?.pix_qr_code;
    if (code) {
      navigator.clipboard.writeText(code);
      toast.success("Código PIX copiado!");
    }
  };

  // Show PIX result
  if (paymentData && selectedMethod === "pix") {
    const pixQrBase64 = paymentData.paymentResult?.pix_qr_code_base64 || paymentData.payment?.pix_qr_code_base64;
    const pixCode = paymentData.paymentResult?.pix_qr_code || paymentData.payment?.pix_qr_code;

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <QrCode className="h-5 w-5" /> Pagamento via PIX
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center">
            <p className="text-2xl font-bold mb-4">{formatPrice(total)}</p>
            {pixQrBase64 && (
              <img
                src={pixQrBase64.startsWith("http") ? pixQrBase64 : `data:image/png;base64,${pixQrBase64}`}
                alt="QR Code PIX"
                className="mx-auto w-48 h-48 border rounded-lg"
              />
            )}
          </div>
          {pixCode && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground text-center">Ou copie o código PIX:</p>
              <div className="flex gap-2">
                <code className="flex-1 text-xs bg-muted p-2 rounded break-all max-h-20 overflow-auto">{pixCode}</code>
                <Button variant="outline" size="sm" onClick={copyPixCode}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
          {paymentStatus === "approved" ? (
            <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg text-center space-y-2">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
              <p className="font-bold text-green-700 dark:text-green-300">Pagamento confirmado!</p>
              <p className="text-xs text-muted-foreground">Redirecionando...</p>
            </div>
          ) : paymentStatus === "rejected" ? (
            <div className="bg-red-50 dark:bg-red-950 p-4 rounded-lg text-center space-y-2">
              <XCircle className="h-12 w-12 text-red-500 mx-auto" />
              <p className="font-bold text-red-700 dark:text-red-300">Pagamento não confirmado</p>
            </div>
          ) : (
            <div className="bg-yellow-50 dark:bg-yellow-950 p-3 rounded-lg text-xs text-yellow-800 dark:text-yellow-300">
              <p className="font-medium flex items-center gap-1"><Clock className="h-3.5 w-3.5 animate-pulse" /> Aguardando pagamento...</p>
              <p>⏱️ Este código expira em 30 minutos. O status será atualizado automaticamente.</p>
            </div>
          )}
        </CardContent>
      </Card>
      </motion.div>
    );
  }

  // Show Boleto result
  if (paymentData && selectedMethod === "boleto") {
    const boletoUrl = paymentData.paymentResult?.boleto_url || paymentData.payment?.boleto_url;
    const boletoBarcode = paymentData.paymentResult?.boleto_barcode || paymentData.payment?.boleto_barcode;

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-5 w-5" /> Boleto Bancário
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center">
            <p className="text-2xl font-bold mb-2">{formatPrice(total)}</p>
            <Badge variant="secondary">Vencimento: 3 dias úteis</Badge>
          </div>
          {boletoBarcode && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Código de barras:</p>
              <div className="flex gap-2">
                <code className="flex-1 text-xs bg-muted p-2 rounded break-all">{boletoBarcode}</code>
                <Button variant="outline" size="sm" onClick={() => {
                  navigator.clipboard.writeText(boletoBarcode);
                  toast.success("Código copiado!");
                }}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
          {boletoUrl && (
            <Button className="w-full" variant="outline" onClick={() => window.open(boletoUrl, "_blank")}>
              <ExternalLink className="mr-2 h-4 w-4" /> Abrir Boleto PDF
            </Button>
          )}
          {paymentStatus === "approved" ? (
            <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg text-center space-y-2">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
              <p className="font-bold text-green-700 dark:text-green-300">Pagamento confirmado!</p>
            </div>
          ) : (
            <div className="bg-yellow-50 dark:bg-yellow-950 p-3 rounded-lg text-xs text-yellow-800 dark:text-yellow-300">
              <p className="font-medium flex items-center gap-1"><Clock className="h-3.5 w-3.5 animate-pulse" /> Aguardando pagamento...</p>
              <p>O status será atualizado automaticamente após a compensação.</p>
            </div>
          )}
        </CardContent>
      </Card>
      </motion.div>
    );
  }

  // Show credit card result (approved)
  if (paymentData && selectedMethod === "credit_card" && (paymentData.paymentResult?.status === "approved" || paymentData.payment?.status === "approved" || paymentStatus === "approved")) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-5 w-5" /> Cartão de Crédito
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
          <p className="text-lg font-bold">Pagamento processado!</p>
          <p className="text-sm text-muted-foreground">
            {paymentData.payment?.card_brand?.toUpperCase()} ****{paymentData.payment?.card_last_four}
          </p>
          <div className="space-y-2">
            <Button className="w-full" onClick={() => onSuccess("credit_card", cardCpf)}>Concluir</Button>
            <p className="text-[10px] text-muted-foreground animate-pulse">Você será redirecionado automaticamente em 3 segundos...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Credit card form
  if (showCardForm && selectedMethod === "credit_card") {
    const isProcessing = createPayment.isPending || tokenizing || isProcessingAnimation;

    if (isProcessingAnimation) {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="h-5 w-5" /> Processando Pagamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CardMachineAnimation status={animationStatus} />
          </CardContent>
        </Card>
      );
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-5 w-5" /> Dados do Cartão
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-2xl font-bold text-center">{formatPrice(total)}</p>

          <div className="space-y-2">
            <Label>Número do Cartão</Label>
            <Input
              placeholder="0000 0000 0000 0000"
              value={cardNumber}
              onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
              maxLength={19}
              className="font-mono"
            />
          </div>

          <div className="space-y-2">
            <Label>Nome no Cartão</Label>
            <Input
              placeholder="NOME COMO NO CARTÃO"
              value={cardName}
              onChange={(e) => setCardName(e.target.value.toUpperCase())}
              maxLength={50}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Validade</Label>
              <Input
                placeholder="MM/AA"
                value={cardExpiry}
                onChange={(e) => setCardExpiry(formatExpiry(e.target.value))}
                maxLength={5}
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label>CVV</Label>
              <Input
                placeholder="000"
                value={cardCvv}
                onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
                maxLength={4}
                type="password"
                className="font-mono"
              />
            </div>
          </div>

          <CpfInputField label="CPF do Titular" value={cardCpf} onChange={setCardCpf} />

          <div className="space-y-2">
            <Label>Tipo do Cartão</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={cardType === "credit" ? "default" : "outline"}
                className="flex-1"
                onClick={() => setCardType("credit")}
              >
                Crédito
              </Button>
              <Button
                type="button"
                variant={cardType === "debit" ? "default" : "outline"}
                className="flex-1"
                onClick={() => {
                  setCardType("debit");
                  setCardInstallments("1");
                }}
              >
                Débito
              </Button>
            </div>
          </div>

          {cardType === "credit" && (
            <div className="space-y-2">
              <Label>Parcelas</Label>
              <Select value={cardInstallments} onValueChange={setCardInstallments}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {mpInstallmentsOptions.length > 0 ? (
                    mpInstallmentsOptions.map((opt: any) => (
                      <SelectItem key={opt.installments} value={String(opt.installments)}>
                        {opt.recommended_message}
                      </SelectItem>
                    ))
                  ) : (
                    Array.from({ length: (settings as any)?.max_installments || 12 }, (_, i) => i + 1).map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n}x de {formatPrice(total / n)} {n === 1 ? "à vista" : ""}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex items-center space-x-2 pt-1 pb-2">
            <Checkbox 
              id="saveCard" 
              checked={saveCard} 
              onCheckedChange={(checked) => setSaveCard(checked as boolean)}
            />
            <Label htmlFor="saveCard" className="text-xs font-medium leading-none cursor-pointer flex items-center gap-2">
              <Save className="h-3 w-3 text-muted-foreground" />
              Salvar cartão para as próximas compras
            </Label>
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => { setShowCardForm(false); setSelectedMethod(null); }}>
              Voltar
            </Button>
            <Button
              className="flex-1 bg-green-600 hover:bg-green-700 text-white h-12 text-base font-bold"
              disabled={isProcessing}
              onClick={() => handlePay("credit_card")}
            >
              {isProcessing ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <CreditCard className="mr-2 h-5 w-5" />}
              {tokenizing ? "Validando cartão..." : `Pagar ${formatPrice(total)}`}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // PIX/Boleto with CPF pre-step
  const needsCpf = selectedMethod && (selectedMethod === "pix" || selectedMethod === "boleto") && !paymentData && settings?.payment_gateway === "mercadopago";
  
  if (needsCpf) {
    const isProcessing = createPayment.isPending;
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            {selectedMethod === "pix" ? <QrCode className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
            {selectedMethod === "pix" ? "Pagamento via PIX" : "Boleto Bancário"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-2xl font-bold text-center">{formatPrice(total)}</p>
          <CpfInputField value={payerCpf} onChange={setPayerCpf} />
          
          <div className="flex items-center space-x-2 pt-1 pb-2">
            <Checkbox 
              id="savePayerData" 
              checked={saveCard}
              onCheckedChange={(checked) => setSaveCard(checked as boolean)}
            />
            <Label htmlFor="savePayerData" className="text-xs font-medium leading-none cursor-pointer flex items-center gap-2">
              <Save className="h-3 w-3 text-muted-foreground" />
              Salvar CPF para as próximas compras
            </Label>
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setSelectedMethod(null)}>
              Voltar
            </Button>
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex-1"
            >
              <Button
                className="w-full h-12 text-base font-bold"
                disabled={isProcessing}
                onClick={() => handlePay(selectedMethod)}
              >
                {isProcessing ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                {selectedMethod === "pix" ? "Gerar QR Code PIX" : "Gerar Boleto"}
              </Button>
            </motion.div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const PaymentSelection = () => (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Forma de Pagamento</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-2xl font-bold text-center mb-4">{formatPrice(total)}</p>
        
        {isStripe && stripePromise && (
          <>
            <StripeExpressCheckout />
            <div className="flex items-center gap-2 py-2">
              <Separator className="flex-1" />
              <span className="text-[10px] text-muted-foreground uppercase font-bold">Ou escolha outro método</span>
              <Separator className="flex-1" />
            </div>
          </>
        )}

        {availableMethods.length === 0 && !isStripe && (
          <p className="text-center text-sm text-muted-foreground">Nenhuma forma de pagamento configurada.</p>
        )}
        {availableMethods.map((method) => (
          <Button
            key={method.id}
            variant="outline"
            className="w-full h-16 justify-start gap-4 text-left"
            disabled={createPayment.isPending}
            onClick={() => {
              if (method.id === "credit_card") {
                handlePay(method.id);
              } else if (settings?.payment_gateway === "mercadopago") {
                setSelectedMethod(method.id);
              } else {
                handlePay(method.id);
              }
            }}
          >
            {createPayment.isPending && selectedMethod === method.id ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <method.icon className="h-6 w-6 shrink-0" />
            )}
            <div>
              <p className="font-medium">{method.label}</p>
              <p className="text-xs text-muted-foreground">{method.desc}</p>
            </div>
          </Button>
        ))}
        <Separator />
        <div className="flex items-center justify-center gap-4 flex-wrap py-3">
          <img src={siteSeguro} alt="Site Seguro" className="h-14 w-auto" />
          <img src={compraSegura} alt="Compra Segura" className="h-14 w-auto" />
        </div>
        <div className="flex flex-col items-center justify-center gap-4 py-2">
          <PaymentFlags acceptedMethods={settings?.accepted_payment_methods} />
        </div>
        <p className="text-[10px] text-muted-foreground text-center">
          Pagamento processado por {settings?.payment_gateway === "mercadopago" ? "Mercado Pago" : settings?.payment_gateway === "pagbank" ? "PagBank" : settings?.payment_gateway === "amplopay" ? "Amplopay" : settings?.payment_gateway === "stripe" ? "Stripe" : "Gateway"} em ambiente {settings?.gateway_environment === "production" ? "de produção" : "sandbox"}
        </p>
      </CardContent>
    </Card>
  );

  if (isStripe && stripePromise) {
    return (
      <Elements stripe={stripePromise}>
        <PaymentSelection />
      </Elements>
    );
  }

  return <PaymentSelection />;
}
