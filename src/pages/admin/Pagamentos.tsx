import { RoleGate } from "@/components/RoleGate";
import { PlanGate } from "@/components/PlanGate";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, CreditCard, MessageCircle, BarChart3, Zap } from "lucide-react";
import { useStoreSettings, useUpdateStoreSettings } from "@/hooks/useStoreSettings";
import PaymentsDashboard from "@/components/PaymentsDashboard";
import { GatewaySettings } from "@/components/admin/GatewaySettings";
import { PaymentFlags } from "@/components/storefront/PaymentFlags";


export default function Pagamentos() {
  const { data: settings, isLoading } = useStoreSettings();
  const updateSettings = useUpdateStoreSettings();
  const [tab, setTab] = useState("dashboard");

  const [paymentPix, setPaymentPix] = useState(false);
  const [paymentBoleto, setPaymentBoleto] = useState(false);
  const [paymentCreditCard, setPaymentCreditCard] = useState(false);
  const [paymentDebitCard, setPaymentDebitCard] = useState(false);
  const [sellViaWhatsapp, setSellViaWhatsapp] = useState(false);
  const [acceptedPaymentMethods, setAcceptedPaymentMethods] = useState<string[]>([]);

  useEffect(() => {
    if (settings) {
      setPaymentPix(settings.payment_pix);
      setPaymentBoleto(settings.payment_boleto);
      setPaymentCreditCard(settings.payment_credit_card);
      setPaymentDebitCard(settings.payment_debit_card);
      setSellViaWhatsapp((settings as any).sell_via_whatsapp ?? false);
      setAcceptedPaymentMethods((settings as any).accepted_payment_methods ?? ["visa", "mastercard", "elo", "amex", "hipercard", "pix", "boleto"]);
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
      accepted_payment_methods: acceptedPaymentMethods,
    } as any);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <RoleGate allowedRoles={["owner", "admin"]}>
      <PlanGate feature="payment_dashboard">
        <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Pagamentos</h1>
        <p className="text-muted-foreground">Gerencie métodos e visualize transações</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="dashboard"><BarChart3 className="h-4 w-4 mr-1" /> Transações</TabsTrigger>
          <TabsTrigger value="config"><CreditCard className="h-4 w-4 mr-1" /> Métodos Aceitos</TabsTrigger>
          <TabsTrigger value="gateway"><Zap className="h-4 w-4 mr-1" /> Gateway</TabsTrigger>
        </TabsList>


        <TabsContent value="dashboard" className="mt-4">
          <PaymentsDashboard />
        </TabsContent>

        <TabsContent value="config" className="mt-4 max-w-2xl">
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
          <Card className="border-border mt-4">
            <CardHeader>
              <div className="flex items-center gap-2"><CreditCard className="h-5 w-5 text-primary" /><CardTitle className="text-lg">Bandeiras e Ícones</CardTitle></div>
              <p className="text-xs text-muted-foreground">Selecione quais ícones de pagamento aparecerão no rodapé e checkout da loja</p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  { id: "visa", label: "Visa" },
                  { id: "mastercard", label: "Mastercard" },
                  { id: "elo", label: "Elo" },
                  { id: "amex", label: "American Express" },
                  { id: "hipercard", label: "Hipercard" },
                  { id: "pix", label: "PIX" },
                  { id: "boleto", label: "Boleto" },
                  { id: "diners", label: "Diners Club" },
                  { id: "discover", label: "Discover" },
                  { id: "applepay", label: "Apple Pay" },
                ].map((flag) => (
                  <div key={flag.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                    <div className="flex items-center gap-3">
                      <PaymentFlags acceptedMethods={[flag.id]} />
                      <span className="text-sm font-medium">{flag.label}</span>
                    </div>
                    <Switch 
                      checked={acceptedPaymentMethods.includes(flag.id)} 
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setAcceptedPaymentMethods([...acceptedPaymentMethods, flag.id]);
                        } else {
                          setAcceptedPaymentMethods(acceptedPaymentMethods.filter(f => f !== flag.id));
                        }
                      }} 
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border mt-4">
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

          <div className="flex justify-end pb-6 mt-4">
            <Button onClick={handleSave} disabled={updateSettings.isPending} size="lg">
              {updateSettings.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar Pagamentos
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="gateway" className="mt-4 max-w-2xl">
          <GatewaySettings />
        </TabsContent>
      </Tabs>

    </div>
      </PlanGate>
    </RoleGate>
  );
}
