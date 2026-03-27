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

interface PaymentStepProps {
  orderId: string;
  storeUserId: string;
  total: number;
  settings: any;
  onSuccess: (method?: string) => void;
}

const formatPrice = (price: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(price);

export default function PaymentStep({ orderId, storeUserId, total, settings, onSuccess }: PaymentStepProps) {
  const [selectedMethod, setSelectedMethod] = useState<"pix" | "credit_card" | "boleto" | null>(null);
  const [paymentData, setPaymentData] = useState<any>(null);
  const [showCardForm, setShowCardForm] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
  const createPayment = useCreatePayment();
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Card form state
  const [cardNumber, setCardNumber] = useState("");
  const [cardName, setCardName] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [cardInstallments, setCardInstallments] = useState("1");

  // Poll payment status for PIX/Boleto
  useEffect(() => {
    if (!paymentData?.payment?.id || selectedMethod === "credit_card") return;
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
        setTimeout(() => onSuccess(selectedMethod || undefined), 1500);
      } else if (data?.status === "rejected" || data?.status === "failed") {
        setPaymentStatus("rejected");
        toast.error("Pagamento recusado");
        if (pollingRef.current) clearInterval(pollingRef.current);
      }
    };

    pollingRef.current = setInterval(poll, 5000);
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [paymentData?.payment?.id, selectedMethod]);

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

  const handlePay = async (method: "pix" | "credit_card" | "boleto") => {
    if (method === "credit_card" && !showCardForm) {
      setShowCardForm(true);
      setSelectedMethod(method);
      return;
    }

    if (method === "credit_card") {
      if (!cardNumber || !cardName || !cardExpiry || !cardCvv) {
        toast.error("Preencha todos os dados do cartão");
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
        params.card_token = cardNumber.replace(/\s/g, "");
        params.installments = parseInt(cardInstallments);
        params.card_holder_name = cardName;
        params.card_expiry = cardExpiry;
        params.card_cvv = cardCvv;
      }

      const result = await createPayment.mutateAsync(params);
      setPaymentData(result);

      if (result.paymentResult?.status === "approved") {
        toast.success("Pagamento aprovado!");
        onSuccess(method);
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
          <Button className="w-full" variant="outline" onClick={() => onSuccess("pix")}>
            Já realizei o pagamento
          </Button>
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
          <Button className="w-full" onClick={() => onSuccess("boleto")}>Concluir</Button>
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
          <Button className="w-full" onClick={() => onSuccess("credit_card")}>Concluir</Button>
        </CardContent>
      </Card>
    );
  }

  // Credit card form
  if (showCardForm && selectedMethod === "credit_card") {
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
              disabled={createPayment.isPending}
              onClick={() => handlePay("credit_card")}
            >
              {createPayment.isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <CreditCard className="mr-2 h-5 w-5" />}
              Pagar {formatPrice(total)}
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
            onClick={() => handlePay(method.id)}
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
          Pagamento processado por {settings?.payment_gateway === "mercadopago" ? "Mercado Pago" : settings?.payment_gateway === "pagbank" ? "PagBank" : "Gateway"} em ambiente {settings?.gateway_environment === "production" ? "de produção" : "sandbox"}
        </p>
      </CardContent>
    </Card>
  );
}
