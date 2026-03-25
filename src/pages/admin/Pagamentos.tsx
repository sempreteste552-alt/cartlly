import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Loader2, CreditCard, MessageCircle } from "lucide-react";
import { useStoreSettings, useUpdateStoreSettings } from "@/hooks/useStoreSettings";

export default function Pagamentos() {
  const { data: settings, isLoading } = useStoreSettings();
  const updateSettings = useUpdateStoreSettings();

  const [paymentPix, setPaymentPix] = useState(false);
  const [paymentBoleto, setPaymentBoleto] = useState(false);
  const [paymentCreditCard, setPaymentCreditCard] = useState(false);
  const [paymentDebitCard, setPaymentDebitCard] = useState(false);
  const [sellViaWhatsapp, setSellViaWhatsapp] = useState(false);

  useEffect(() => {
    if (settings) {
      setPaymentPix(settings.payment_pix);
      setPaymentBoleto(settings.payment_boleto);
      setPaymentCreditCard(settings.payment_credit_card);
      setPaymentDebitCard(settings.payment_debit_card);
      setSellViaWhatsapp((settings as any).sell_via_whatsapp ?? false);
    }
  }, [settings]);

  const handleSave = () => {
    if (!settings) return;
    updateSettings.mutate({
      id: settings.id,
      payment_pix: paymentPix,
      payment_boleto: paymentBoleto,
      payment_credit_card: paymentCreditCard,
      payment_debit_card: paymentDebitCard,
      sell_via_whatsapp: sellViaWhatsapp,
    } as any);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Formas de Pagamento</h1>
        <p className="text-muted-foreground">Habilite os métodos de pagamento da sua loja</p>
      </div>

      <Card className="border-border">
        <CardHeader>
          <div className="flex items-center gap-2"><CreditCard className="h-5 w-5 text-primary" /><CardTitle className="text-lg">Métodos Aceitos</CardTitle></div>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { label: "PIX", desc: "Pagamento instantâneo", value: paymentPix, set: setPaymentPix },
            { label: "Boleto Bancário", desc: "1-3 dias úteis", value: paymentBoleto, set: setPaymentBoleto },
            { label: "Cartão de Crédito", desc: "Parcelamento disponível", value: paymentCreditCard, set: setPaymentCreditCard },
            { label: "Cartão de Débito", desc: "Débito à vista", value: paymentDebitCard, set: setPaymentDebitCard },
          ].map((m) => (
            <div key={m.label} className="flex items-center justify-between rounded-lg border border-border p-3">
              <div><p className="text-sm font-medium">{m.label}</p><p className="text-xs text-muted-foreground">{m.desc}</p></div>
              <Switch checked={m.value} onCheckedChange={m.set} />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <MessageCircle className="h-5 w-5 text-green-500" />
            <div>
              <p className="font-medium">Vender via WhatsApp</p>
              <p className="text-xs text-muted-foreground">Permite finalizar pedidos pelo WhatsApp</p>
            </div>
          </div>
          <Switch checked={sellViaWhatsapp} onCheckedChange={setSellViaWhatsapp} />
        </CardContent>
      </Card>

      <div className="flex justify-end pb-6">
        <Button onClick={handleSave} disabled={updateSettings.isPending} size="lg">
          {updateSettings.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Salvar Pagamentos
        </Button>
      </div>
    </div>
  );
}
