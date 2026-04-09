import { useState, useEffect } from "react";
import { ShippingZonesManager } from "@/components/ShippingZonesManager";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Truck } from "lucide-react";
import { useStoreSettings, useUpdateStoreSettings } from "@/hooks/useStoreSettings";


export default function Frete() {
  const { data: settings, isLoading } = useStoreSettings();
  const updateSettings = useUpdateStoreSettings();

  const [shippingEnabled, setShippingEnabled] = useState(false);
  const [shippingFlatRate, setShippingFlatRate] = useState("");
  const [shippingFreeAbove, setShippingFreeAbove] = useState("");
  const [storeCep, setStoreCep] = useState("");

  useEffect(() => {
    if (settings) {
      setShippingEnabled((settings as any).shipping_enabled ?? false);
      setShippingFlatRate(String((settings as any).shipping_flat_rate ?? ""));
      setShippingFreeAbove(String((settings as any).shipping_free_above ?? ""));
      setStoreCep((settings as any).store_cep ?? "");
    }
  }, [settings]);

  const handleSave = () => {
    if (!settings) return;
    updateSettings.mutate({
      id: settings.id,
      shipping_enabled: shippingEnabled,
      shipping_flat_rate: shippingFlatRate ? Number(shippingFlatRate) : null,
      shipping_free_above: shippingFreeAbove ? Number(shippingFreeAbove) : null,
      store_cep: storeCep.trim() || null,
    } as any);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <>
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Frete e Entregas</h1>
        <p className="text-muted-foreground">Configure as opções de entrega da sua loja</p>
      </div>

      <Card className="border-border">
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Truck className="h-5 w-5 text-primary" />
            <div>
              <p className="font-medium">Calculadora de Frete</p>
              <p className="text-xs text-muted-foreground">Exibe cálculo de frete no checkout</p>
            </div>
          </div>
          <Switch checked={shippingEnabled} onCheckedChange={setShippingEnabled} />
        </CardContent>
      </Card>

      {shippingEnabled && (
        <>
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">Valores de Frete</CardTitle>
              <CardDescription>Defina o valor fixo e frete grátis</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>CEP de origem (sua loja)</Label>
                <Input value={storeCep} onChange={(e) => setStoreCep(e.target.value)} placeholder="01001-000" maxLength={9} />
              </div>
              <div className="space-y-2">
                <Label>Valor fixo do frete (R$)</Label>
                <Input type="number" step="0.01" value={shippingFlatRate} onChange={(e) => setShippingFlatRate(e.target.value)} placeholder="15.00" />
              </div>
              <div className="space-y-2">
                <Label>Frete grátis acima de (R$)</Label>
                <Input type="number" step="0.01" value={shippingFreeAbove} onChange={(e) => setShippingFreeAbove(e.target.value)} placeholder="200.00" />
                <p className="text-xs text-muted-foreground">Deixe vazio para não oferecer frete grátis</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">Zonas de Frete por CEP</CardTitle>
              <CardDescription>Configure faixas de CEP com preços e prazos personalizados (ViaCEP)</CardDescription>
            </CardHeader>
            <CardContent>
              <ShippingZonesManager />
            </CardContent>
          </Card>
        </>
      )}

      <div className="flex justify-end pb-6">
        <Button onClick={handleSave} disabled={updateSettings.isPending} size="lg">
          {updateSettings.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Salvar Frete
        </Button>
      </div>
    </div>
    </>
  );
}
