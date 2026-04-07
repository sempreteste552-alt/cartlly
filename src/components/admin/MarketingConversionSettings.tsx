import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, Megaphone, Gift, Timer, Truck, ShieldCheck } from "lucide-react";
import { useStoreMarketingConfig, useUpdateStoreMarketingConfig } from "@/hooks/useStoreMarketingConfig";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";

export default function MarketingConversionSettings() {
  const { data: config, isLoading } = useStoreMarketingConfig();
  const updateConfig = useUpdateStoreMarketingConfig();
  const { isLocked } = usePlanFeatures();

  const [announcementEnabled, setAnnouncementEnabled] = useState(false);
  const [announcementText, setAnnouncementText] = useState("");
  const [announcementBgColor, setAnnouncementBgColor] = useState("#000000");
  const [announcementTextColor, setAnnouncementTextColor] = useState("#ffffff");
  const [announcementLink, setAnnouncementLink] = useState("");

  const [popupEnabled, setPopupEnabled] = useState(false);
  const [popupCode, setPopupCode] = useState("");
  const [popupTitle, setPopupTitle] = useState("");
  const [popupDescription, setPopupDescription] = useState("");
  const [popupDelay, setPopupDelay] = useState(5);

  const [countdownEnabled, setCountdownEnabled] = useState(false);
  const [countdownText, setCountdownText] = useState("");
  const [countdownEndDate, setCountdownEndDate] = useState("");
  const [countdownBgColor, setCountdownBgColor] = useState("#dc2626");
  const [countdownTextColor, setCountdownTextColor] = useState("#ffffff");

  const [freeShippingEnabled, setFreeShippingEnabled] = useState(false);
  const [freeShippingThreshold, setFreeShippingThreshold] = useState(0);
  const [freeShippingBarColor, setFreeShippingBarColor] = useState("#16a34a");

  const [trustBadgesEnabled, setTrustBadgesEnabled] = useState(false);

  useEffect(() => {
    if (config) {
      setAnnouncementEnabled(config.announcement_bar_enabled);
      setAnnouncementText(config.announcement_bar_text || "");
      setAnnouncementBgColor(config.announcement_bar_bg_color);
      setAnnouncementTextColor(config.announcement_bar_text_color);
      setAnnouncementLink(config.announcement_bar_link || "");
      setPopupEnabled(config.popup_coupon_enabled);
      setPopupCode(config.popup_coupon_code || "");
      setPopupTitle(config.popup_coupon_title || "");
      setPopupDescription(config.popup_coupon_description || "");
      setPopupDelay(config.popup_coupon_delay_seconds);
      setCountdownEnabled(config.countdown_enabled);
      setCountdownText(config.countdown_text || "");
      setCountdownEndDate(config.countdown_end_date ? config.countdown_end_date.slice(0, 16) : "");
      setCountdownBgColor(config.countdown_bg_color);
      setCountdownTextColor(config.countdown_text_color);
      setFreeShippingEnabled(config.free_shipping_bar_enabled);
      setFreeShippingThreshold(config.free_shipping_threshold);
      setFreeShippingBarColor(config.free_shipping_bar_color);
      setTrustBadgesEnabled(config.trust_badges_enabled);
    }
  }, [config]);

  const handleSave = () => {
    if (!config) return;
    updateConfig.mutate({
      id: config.id,
      announcement_bar_enabled: announcementEnabled,
      announcement_bar_text: announcementText.trim() || null,
      announcement_bar_bg_color: announcementBgColor,
      announcement_bar_text_color: announcementTextColor,
      announcement_bar_link: announcementLink.trim() || null,
      popup_coupon_enabled: popupEnabled,
      popup_coupon_code: popupCode.trim() || null,
      popup_coupon_title: popupTitle.trim() || null,
      popup_coupon_description: popupDescription.trim() || null,
      popup_coupon_delay_seconds: popupDelay,
      countdown_enabled: countdownEnabled,
      countdown_text: countdownText.trim() || null,
      countdown_end_date: countdownEndDate ? new Date(countdownEndDate).toISOString() : null,
      countdown_bg_color: countdownBgColor,
      countdown_text_color: countdownTextColor,
      free_shipping_bar_enabled: freeShippingEnabled,
      free_shipping_threshold: freeShippingThreshold,
      free_shipping_bar_color: freeShippingBarColor,
      trust_badges_enabled: trustBadgesEnabled,
    });
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Announcement Bar */}
      <Card className="border-primary/30 animate-pulse shadow-lg shadow-primary/10">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            <Timer className="h-4 w-4 text-primary animate-bounce" />
            <CardTitle className="text-lg">Barra de Anúncio</CardTitle>
            <Badge variant="secondary" className="text-[10px]">STARTER+</Badge>
          </div>
          <CardDescription>Banner fixo no topo da loja com mensagem promocional</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Ativar</Label>
            <Switch checked={announcementEnabled} onCheckedChange={setAnnouncementEnabled} />
          </div>
          {announcementEnabled && (
            <>
              <div className="space-y-2">
                <Label>Texto</Label>
                <Input value={announcementText} onChange={(e) => setAnnouncementText(e.target.value)} placeholder="🔥 Frete Grátis acima de R$ 199!" maxLength={200} />
              </div>
              <div className="space-y-2">
                <Label>Link (opcional)</Label>
                <Input value={announcementLink} onChange={(e) => setAnnouncementLink(e.target.value)} placeholder="/promocoes" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Cor de Fundo</Label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={announcementBgColor} onChange={(e) => setAnnouncementBgColor(e.target.value)} className="h-9 w-12 cursor-pointer rounded border border-border" />
                    <Input value={announcementBgColor} onChange={(e) => setAnnouncementBgColor(e.target.value)} className="font-mono text-xs" maxLength={7} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Cor do Texto</Label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={announcementTextColor} onChange={(e) => setAnnouncementTextColor(e.target.value)} className="h-9 w-12 cursor-pointer rounded border border-border" />
                    <Input value={announcementTextColor} onChange={(e) => setAnnouncementTextColor(e.target.value)} className="font-mono text-xs" maxLength={7} />
                  </div>
                </div>
              </div>
              {/* Preview */}
              <div className="rounded-lg overflow-hidden border border-border">
                <div className="text-center py-2 text-sm font-medium" style={{ backgroundColor: announcementBgColor, color: announcementTextColor }}>
                  {announcementText || "Preview da barra de anúncio"}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Popup Coupon */}
      <Card className="border-border">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Popup de Cupom</CardTitle>
            <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px]">PREMIUM</Badge>
          </div>
          <CardDescription>Popup com cupom de desconto para novos visitantes</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Ativar</Label>
            <Switch checked={popupEnabled} onCheckedChange={setPopupEnabled} />
          </div>
          {popupEnabled && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Título do Popup</Label>
                  <Input value={popupTitle} onChange={(e) => setPopupTitle(e.target.value)} placeholder="Ganhe 10% OFF!" />
                </div>
                <div className="space-y-2">
                  <Label>Código do Cupom</Label>
                  <Input value={popupCode} onChange={(e) => setPopupCode(e.target.value.toUpperCase())} placeholder="BEMVINDO10" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea value={popupDescription} onChange={(e) => setPopupDescription(e.target.value)} placeholder="Use o cupom na sua primeira compra!" />
              </div>
              <div className="space-y-2">
                <Label>Delay (segundos): {popupDelay}s</Label>
                <Input type="number" value={popupDelay} onChange={(e) => setPopupDelay(Number(e.target.value))} min={1} max={60} />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Countdown Banner */}
      <Card className="border-border">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Timer className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Contagem Regressiva</CardTitle>
            <Badge variant="secondary" className="text-[10px]">PRO+</Badge>
          </div>
          <CardDescription>Banner com timer para promoções temporárias</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Ativar</Label>
            <Switch checked={countdownEnabled} onCheckedChange={setCountdownEnabled} />
          </div>
          {countdownEnabled && (
            <>
              <div className="space-y-2">
                <Label>Texto</Label>
                <Input value={countdownText} onChange={(e) => setCountdownText(e.target.value)} placeholder="🔥 Promoção relâmpago! Termina em:" />
              </div>
              <div className="space-y-2">
                <Label>Data/Hora de Término</Label>
                <Input type="datetime-local" value={countdownEndDate} onChange={(e) => setCountdownEndDate(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Cor de Fundo</Label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={countdownBgColor} onChange={(e) => setCountdownBgColor(e.target.value)} className="h-9 w-12 cursor-pointer rounded border border-border" />
                    <Input value={countdownBgColor} onChange={(e) => setCountdownBgColor(e.target.value)} className="font-mono text-xs" maxLength={7} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Cor do Texto</Label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={countdownTextColor} onChange={(e) => setCountdownTextColor(e.target.value)} className="h-9 w-12 cursor-pointer rounded border border-border" />
                    <Input value={countdownTextColor} onChange={(e) => setCountdownTextColor(e.target.value)} className="font-mono text-xs" maxLength={7} />
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Free Shipping Bar */}
      <Card className="border-border">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Barra de Frete Grátis</CardTitle>
            <Badge variant="secondary" className="text-[10px]">PRO+</Badge>
          </div>
          <CardDescription>Barra de progresso mostrando quanto falta para frete grátis</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Ativar</Label>
            <Switch checked={freeShippingEnabled} onCheckedChange={setFreeShippingEnabled} />
          </div>
          {freeShippingEnabled && (
            <>
              <div className="space-y-2">
                <Label>Valor mínimo para frete grátis (R$)</Label>
                <Input type="number" value={freeShippingThreshold} onChange={(e) => setFreeShippingThreshold(Number(e.target.value))} min={0} />
              </div>
              <div className="space-y-2">
                <Label>Cor da Barra</Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={freeShippingBarColor} onChange={(e) => setFreeShippingBarColor(e.target.value)} className="h-9 w-12 cursor-pointer rounded border border-border" />
                  <Input value={freeShippingBarColor} onChange={(e) => setFreeShippingBarColor(e.target.value)} className="font-mono text-xs" maxLength={7} />
                </div>
              </div>
              {/* Preview */}
              <div className="rounded-lg border border-border p-3 space-y-2">
                <p className="text-xs text-center text-muted-foreground">Faltam R$ {freeShippingThreshold.toFixed(2)} para frete grátis!</p>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: "35%", backgroundColor: freeShippingBarColor }} />
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Trust Badges */}
      <Card className="border-border">
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Selos de Confiança</CardTitle>
            <Badge variant="secondary" className="text-[10px]">STARTER+</Badge>
          </div>
          <CardDescription>Exiba selos de segurança e garantia na loja</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <Label>Ativar</Label>
            <Switch checked={trustBadgesEnabled} onCheckedChange={setTrustBadgesEnabled} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updateConfig.isPending} size="lg">
          {updateConfig.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Salvar Marketing
        </Button>
      </div>
    </div>
  );
}
