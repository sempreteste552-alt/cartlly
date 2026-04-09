import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, QrCode, CreditCard, FileText, Copy, CheckCircle, ExternalLink, XCircle, Clock } from "lucide-react";
import { useCreatePayment } from "@/hooks/usePayments";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import pixLogo from "@/assets/pix-logo.webp";
import paymentCards from "@/assets/payment-cards.webp";
import siteSeguro from "@/assets/site-seguro.webp";
import compraSegura from "@/assets/compra-segura.webp";

declare global {
  interface Window {
    MercadoPago: any;
  }
}

interface PaymentStepProps {
  orderId: string;
  storeUserId: string;
  total: number;
  settings: any;
  onSuccess: (method?: string, cpf?: string) => void;
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

export default function PaymentStep({ orderId, storeUserId, total, settings, onSuccess }: PaymentStepProps) {
  const [selectedMethod, setSelectedMethod] = useState<"pix" | "credit_card" | "boleto" | null>(null);
  const [paymentData, setPaymentData] = useState<any>(null);
  const [showCardForm, setShowCardForm] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
  const [tokenizing, setTokenizing] = useState(false);
  const createPayment = useCreatePayment();
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Card form state
  const [cardNumber, setCardNumber] = useState("");
  const [cardName, setCardName] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [cardInstallments, setCardInstallments] = useState("1");
  const [cardCpf, setCardCpf] = useState("");

  // PIX/Boleto CPF
  const [payerCpf, setPayerCpf] = useState("");

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
          if (["processando", "enviado", "entregue"].includes(newStatus)) {
            toast.success("💰 Pedido confirmado e aprovado!");
            onSuccess(selectedMethod || "gateway", selectedMethod === "credit_card" ? cardCpf : payerCpf);
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
      
      if (data && ["processando", "enviado", "entregue"].includes(data.status)) {
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

  const availableMethods = [
    { id: "pix" as const, label: "PIX", desc: "Pagamento instantâneo", icon: QrCode, enabled: settings?.payment_pix },
    { id: "credit_card" as const, label: "Cartão de Crédito", desc: "Parcelamento disponível", icon: CreditCard, enabled: settings?.payment_credit_card },
    { id: "boleto" as const, label: "Boleto Bancário", desc: "Vencimento em 3 dias úteis", icon: FileText, enabled: settings?.payment_boleto },
  ].filter((m) => m.enabled);

  const formatCardNumber = (v: string) => {
    const nums = v.replace(/\D/g, "").slice(0, 16);
    return nums.replace(/(\d{4})(?=\d)/g, "$1 ");
  };

  const formatExpiry = (v: string) => {
    const nums = v.replace(/\D/g, "").slice(0, 4);
    if (nums.length > 2) return nums.slice(0, 2) + "/" + nums.slice(2);
    return nums;
  };

  const generateCardToken = async (): Promise<string> => {
    const publicKey = settings?.gateway_public_key;
    if (!publicKey) throw new Error("Chave pública do gateway não configurada");

    if (!window.MercadoPago) {
      throw new Error("SDK do Mercado Pago não carregado. Recarregue a página.");
    }

    const mp = new window.MercadoPago(publicKey, {
      locale: "pt-BR",
    });

    const [expMonth, expYear] = cardExpiry.split("/");
    const fullYear = expYear?.length === 2 ? `20${expYear}` : expYear;

    const cardData = {
      cardNumber: cardNumber.replace(/\s/g, ""),
      cardholderName: cardName,
      cardExpirationMonth: expMonth,
      cardExpirationYear: fullYear,
      securityCode: cardCvv,
      identificationType: "CPF",
      identificationNumber: cardCpf.replace(/\D/g, ""),
    };

    const tokenResponse = await mp.createCardToken(cardData);

    if (!tokenResponse?.id) {
      throw new Error("Não foi possível gerar o token do cartão. Verifique os dados.");
    }

    return tokenResponse.id;
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

    setSelectedMethod(method);
    try {
      const params: any = {
        order_id: orderId,
        method,
        store_user_id: storeUserId,
      };

      if (method === "credit_card") {
        // Use Mercado Pago SDK to generate a proper card token
        if (settings?.payment_gateway === "mercadopago") {
          setTokenizing(true);
          try {
            const token = await generateCardToken();
            params.card_token = token;
          } catch (tokenErr: any) {
            toast.error(tokenErr.message || "Erro ao processar dados do cartão");
            setTokenizing(false);
            return;
          }
          setTokenizing(false);
        } else {
          // For other gateways, send raw (they handle differently)
          params.card_token = cardNumber.replace(/\s/g, "");
        }
        params.installments = parseInt(cardInstallments);
        params.payer_cpf = cardCpf.replace(/\D/g, "");
      }

      if (method === "pix" || method === "boleto") {
        params.payer_cpf = payerCpf.replace(/\D/g, "");
      }

      const result = await createPayment.mutateAsync(params);
      setPaymentData(result);

      if (result.paymentResult?.status === "approved" || result.paymentResult?.status === "paid" || result.payment?.status === "approved" || result.payment?.status === "paid") {
        toast.success("Pagamento aprovado!");
        onSuccess(method, method === "credit_card" ? cardCpf : payerCpf);
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao processar pagamento");
      if (method !== "credit_card") setSelectedMethod(null);
    }
  };

  const copyPixCode = () => {
    const code = paymentData?.paymentResult?.pix_qr_code || paymentData?.payment?.pix_qr_code;
    if (code) {
      navigator.clipboard.writeText(code);
      toast.success("Código PIX copiado!");
    }
  };

  // CPF field rendered inline to avoid remount/focus loss

  // Show PIX result
  if (paymentData && selectedMethod === "pix") {
    const pixQrBase64 = paymentData.paymentResult?.pix_qr_code_base64 || paymentData.payment?.pix_qr_code_base64;
    const pixCode = paymentData.paymentResult?.pix_qr_code || paymentData.payment?.pix_qr_code;

    return (
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
    );
  }

  // Show Boleto result
  if (paymentData && selectedMethod === "boleto") {
    const boletoUrl = paymentData.paymentResult?.boleto_url || paymentData.payment?.boleto_url;
    const boletoBarcode = paymentData.paymentResult?.boleto_barcode || paymentData.payment?.boleto_barcode;

    return (
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
    );
  }

  // Show credit card result (approved)
  if (paymentData && selectedMethod === "credit_card") {
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
    const isProcessing = createPayment.isPending || tokenizing;
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
            <Label>Parcelas</Label>
            <Select value={cardInstallments} onValueChange={setCardInstallments}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Array.from({ length: (settings as any)?.max_installments || 12 }, (_, i) => i + 1).map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}x de {formatPrice(total / n)} {n === 1 ? "à vista" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setSelectedMethod(null)}>
              Voltar
            </Button>
            <Button
              className="flex-1 h-12 text-base font-bold"
              disabled={isProcessing}
              onClick={() => handlePay(selectedMethod)}
            >
              {isProcessing ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
              {selectedMethod === "pix" ? "Gerar QR Code PIX" : "Gerar Boleto"}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Method selection
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Forma de Pagamento</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-2xl font-bold text-center mb-4">{formatPrice(total)}</p>
        {availableMethods.length === 0 && (
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
                // Show CPF step for PIX/Boleto
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
        {/* Trust badges */}
        <div className="flex items-center justify-center gap-4 flex-wrap py-3">
          <img src={siteSeguro} alt="Site Seguro" className="h-14 w-auto" />
          <img src={compraSegura} alt="Compra Segura" className="h-14 w-auto" />
        </div>
        <div className="flex items-center justify-center gap-4 py-2">
          <img src={paymentCards} alt="Bandeiras aceitas" className="h-12 w-auto" />
          <img src={pixLogo} alt="PIX" className="h-12 w-auto" />
        </div>
        <p className="text-[10px] text-muted-foreground text-center">
          Pagamento processado por {settings?.payment_gateway === "mercadopago" ? "Mercado Pago" : settings?.payment_gateway === "pagbank" ? "PagBank" : settings?.payment_gateway === "amplopay" ? "Amplopay" : "Gateway"} em ambiente {settings?.gateway_environment === "production" ? "de produção" : "sandbox"}
        </p>
      </CardContent>
    </Card>
  );
}
