import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, QrCode, CreditCard, FileText, Copy, CheckCircle, ExternalLink } from "lucide-react";
import { useCreatePayment } from "@/hooks/usePayments";
import { toast } from "sonner";

interface PaymentStepProps {
  orderId: string;
  storeUserId: string;
  total: number;
  settings: any;
  onSuccess: () => void;
}

const formatPrice = (price: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(price);

export default function PaymentStep({ orderId, storeUserId, total, settings, onSuccess }: PaymentStepProps) {
  const [selectedMethod, setSelectedMethod] = useState<"pix" | "credit_card" | "boleto" | null>(null);
  const [paymentData, setPaymentData] = useState<any>(null);
  const createPayment = useCreatePayment();

  const availableMethods = [
    { id: "pix" as const, label: "PIX", desc: "Pagamento instantâneo", icon: QrCode, enabled: settings?.payment_pix },
    { id: "credit_card" as const, label: "Cartão de Crédito", desc: "Parcelamento disponível", icon: CreditCard, enabled: settings?.payment_credit_card },
    { id: "boleto" as const, label: "Boleto Bancário", desc: "Vencimento em 3 dias", icon: FileText, enabled: settings?.payment_boleto },
  ].filter((m) => m.enabled);

  const handlePay = async (method: "pix" | "credit_card" | "boleto") => {
    setSelectedMethod(method);
    try {
      const result = await createPayment.mutateAsync({
        order_id: orderId,
        method,
        store_user_id: storeUserId,
      });
      setPaymentData(result);

      if (result.paymentResult?.status === "approved") {
        toast.success("Pagamento aprovado!");
        onSuccess();
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao processar pagamento");
      setSelectedMethod(null);
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
              <p className="text-xs text-gray-500 text-center">Ou copie o código PIX:</p>
              <div className="flex gap-2">
                <code className="flex-1 text-xs bg-gray-100 p-2 rounded break-all max-h-20 overflow-auto">{pixCode}</code>
                <Button variant="outline" size="sm" onClick={copyPixCode}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
          <div className="bg-yellow-50 p-3 rounded-lg text-xs text-yellow-800">
            <p className="font-medium">⏱️ Este código expira em 30 minutos</p>
            <p>Após o pagamento, seu pedido será confirmado automaticamente.</p>
          </div>
          <Button className="w-full" variant="outline" onClick={onSuccess}>
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
              <p className="text-xs text-gray-500">Código de barras:</p>
              <div className="flex gap-2">
                <code className="flex-1 text-xs bg-gray-100 p-2 rounded break-all">{boletoBarcode}</code>
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
              <ExternalLink className="mr-2 h-4 w-4" /> Abrir Boleto
            </Button>
          )}
          <Button className="w-full" onClick={onSuccess}>Concluir</Button>
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
          <p className="text-sm text-gray-500">
            {paymentData.payment?.card_brand?.toUpperCase()} ****{paymentData.payment?.card_last_four}
          </p>
          <Button className="w-full" onClick={onSuccess}>Concluir</Button>
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
          <p className="text-center text-sm text-gray-500">Nenhuma forma de pagamento configurada.</p>
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
              <p className="text-xs text-gray-500">{method.desc}</p>
            </div>
          </Button>
        ))}
        <Separator />
        <p className="text-[10px] text-gray-400 text-center">
          Pagamento processado por {settings?.payment_gateway === "mercadopago" ? "Mercado Pago" : settings?.payment_gateway === "pagbank" ? "PagBank" : "Gateway"} em ambiente {settings?.gateway_environment === "production" ? "de produção" : "sandbox"}
        </p>
      </CardContent>
    </Card>
  );
}
