import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Upload, X, Palette, CreditCard, Store, Globe, ShieldCheck, Zap } from "lucide-react";
import { useStoreSettings, useUpdateStoreSettings, useUploadStoreLogo } from "@/hooks/useStoreSettings";

const GATEWAYS = [
  {
    id: "mercadopago",
    name: "Mercado Pago",
    description: "Gateway líder na América Latina. Aceita PIX, cartões, boleto.",
    publicKeyLabel: "Public Key",
    publicKeyPlaceholder: "APP_USR-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    docsUrl: "https://www.mercadopago.com.br/developers/pt/docs",
    color: "#009ee3",
  },
  {
    id: "pagbank",
    name: "PagBank (PagSeguro)",
    description: "Soluções completas de pagamento do PagSeguro.",
    publicKeyLabel: "Token Público",
    publicKeyPlaceholder: "XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX",
    docsUrl: "https://dev.pagbank.uol.com.br",
    color: "#41b64f",
  },
  {
    id: "pagarme",
    name: "Pagar.me",
    description: "Infraestrutura de pagamentos da Stone Co.",
    publicKeyLabel: "Public Key",
    publicKeyPlaceholder: "pk_xxxxxxxxxxxxxxxxxxxxxxxx",
    docsUrl: "https://docs.pagar.me",
    color: "#65a300",
  },
];

export default function Configuracoes() {
  const { data: settings, isLoading } = useStoreSettings();
  const updateSettings = useUpdateStoreSettings();
  const uploadLogo = useUploadStoreLogo();
  const fileRef = useRef<HTMLInputElement>(null);

  const [storeName, setStoreName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#6d28d9");
  const [secondaryColor, setSecondaryColor] = useState("#f5f3ff");
  const [accentColor, setAccentColor] = useState("#8b5cf6");
  const [paymentPix, setPaymentPix] = useState(false);
  const [paymentBoleto, setPaymentBoleto] = useState(false);
  const [paymentCreditCard, setPaymentCreditCard] = useState(false);
  const [paymentDebitCard, setPaymentDebitCard] = useState(false);
  const [customDomain, setCustomDomain] = useState("");
  const [paymentGateway, setPaymentGateway] = useState<string>("");
  const [gatewayPublicKey, setGatewayPublicKey] = useState("");
  const [gatewayEnvironment, setGatewayEnvironment] = useState("sandbox");

  useEffect(() => {
    if (settings) {
      setStoreName(settings.store_name);
      setLogoUrl(settings.logo_url ?? "");
      setPrimaryColor(settings.primary_color);
      setSecondaryColor(settings.secondary_color);
      setAccentColor(settings.accent_color);
      setPaymentPix(settings.payment_pix);
      setPaymentBoleto(settings.payment_boleto);
      setPaymentCreditCard(settings.payment_credit_card);
      setPaymentDebitCard(settings.payment_debit_card);
      setCustomDomain(settings.custom_domain ?? "");
      setPaymentGateway(settings.payment_gateway ?? "");
      setGatewayPublicKey(settings.gateway_public_key ?? "");
      setGatewayEnvironment(settings.gateway_environment ?? "sandbox");
    }
  }, [settings]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return alert("Máximo 2MB para logo.");
    const url = await uploadLogo.mutateAsync(file);
    setLogoUrl(url);
  };

  const handleSave = () => {
    if (!settings) return;
    updateSettings.mutate({
      id: settings.id,
      store_name: storeName.trim() || "Minha Loja",
      logo_url: logoUrl || null,
      primary_color: primaryColor,
      secondary_color: secondaryColor,
      accent_color: accentColor,
      payment_pix: paymentPix,
      payment_boleto: paymentBoleto,
      payment_credit_card: paymentCreditCard,
      payment_debit_card: paymentDebitCard,
      custom_domain: customDomain.trim() || null,
      payment_gateway: paymentGateway || null,
      gateway_public_key: gatewayPublicKey.trim() || null,
      gateway_environment: gatewayEnvironment,
    });
  };

  const selectedGateway = GATEWAYS.find((g) => g.id === paymentGateway);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Configurações</h1>
        <p className="text-muted-foreground">Personalize sua loja</p>
      </div>

      {/* Store Info */}
      <Card className="border-border">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Store className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Informações da Loja</CardTitle>
          </div>
          <CardDescription>Nome e identidade visual</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="storeName">Nome da Loja</Label>
            <Input id="storeName" value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder="Minha Loja" maxLength={100} />
          </div>
          <div className="space-y-2">
            <Label>Logo</Label>
            <div className="flex items-center gap-4">
              {logoUrl ? (
                <div className="relative">
                  <img src={logoUrl} alt="Logo" className="h-20 w-20 rounded-lg object-contain border border-border bg-card p-1" />
                  <button type="button" onClick={() => setLogoUrl("")} className="absolute -right-2 -top-2 rounded-full bg-destructive p-1 text-destructive-foreground">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <div onClick={() => fileRef.current?.click()} className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-border hover:border-primary/50 transition-colors">
                  {uploadLogo.isPending ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : <Upload className="h-5 w-5 text-muted-foreground" />}
                </div>
              )}
              <p className="text-xs text-muted-foreground">PNG ou JPG, máximo 2MB</p>
            </div>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/svg+xml" className="hidden" onChange={handleLogoUpload} />
          </div>
        </CardContent>
      </Card>

      {/* Colors */}
      <Card className="border-border">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Cores da Loja</CardTitle>
          </div>
          <CardDescription>Personalize as cores do seu front-end</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Primária", id: "primaryColor", value: primaryColor, set: setPrimaryColor },
              { label: "Secundária", id: "secondaryColor", value: secondaryColor, set: setSecondaryColor },
              { label: "Destaque", id: "accentColor", value: accentColor, set: setAccentColor },
            ].map((c) => (
              <div key={c.id} className="space-y-2">
                <Label htmlFor={c.id}>{c.label}</Label>
                <div className="flex items-center gap-2">
                  <input type="color" id={c.id} value={c.value} onChange={(e) => c.set(e.target.value)} className="h-9 w-12 cursor-pointer rounded border border-border" />
                  <Input value={c.value} onChange={(e) => c.set(e.target.value)} className="font-mono text-xs" maxLength={7} />
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-lg border border-border p-4">
            <p className="text-xs text-muted-foreground mb-2">Pré-visualização</p>
            <div className="flex gap-3 items-center">
              <div className="h-10 w-10 rounded-lg" style={{ backgroundColor: primaryColor }} />
              <div className="h-10 w-10 rounded-lg" style={{ backgroundColor: secondaryColor }} />
              <div className="h-10 w-10 rounded-lg" style={{ backgroundColor: accentColor }} />
              <div className="ml-2 flex-1 rounded-lg p-3" style={{ backgroundColor: secondaryColor }}>
                <div className="h-3 w-24 rounded" style={{ backgroundColor: primaryColor }} />
                <div className="mt-2 h-2 w-16 rounded" style={{ backgroundColor: accentColor, opacity: 0.6 }} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment Methods */}
      <Card className="border-border">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Formas de Pagamento</CardTitle>
          </div>
          <CardDescription>Selecione os métodos aceitos na loja</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { label: "PIX", desc: "Pagamento instantâneo", value: paymentPix, set: setPaymentPix },
            { label: "Boleto Bancário", desc: "Compensação em 1-3 dias úteis", value: paymentBoleto, set: setPaymentBoleto },
            { label: "Cartão de Crédito", desc: "Parcelamento disponível", value: paymentCreditCard, set: setPaymentCreditCard },
            { label: "Cartão de Débito", desc: "Débito à vista", value: paymentDebitCard, set: setPaymentDebitCard },
          ].map((method) => (
            <div key={method.label} className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium">{method.label}</p>
                <p className="text-xs text-muted-foreground">{method.desc}</p>
              </div>
              <Switch checked={method.value} onCheckedChange={method.set} />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Payment Gateway */}
      <Card className="border-border">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Gateway de Pagamento</CardTitle>
          </div>
          <CardDescription>Configure o processador de pagamentos da loja</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Gateway selection */}
          <div className="space-y-2">
            <Label>Provedor</Label>
            <Select value={paymentGateway || "none"} onValueChange={(v) => setPaymentGateway(v === "none" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um gateway" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {GATEWAYS.map((gw) => (
                  <SelectItem key={gw.id} value={gw.id}>{gw.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Gateway cards */}
          {!paymentGateway && (
            <div className="grid gap-3">
              {GATEWAYS.map((gw) => (
                <div
                  key={gw.id}
                  onClick={() => setPaymentGateway(gw.id)}
                  className="flex items-center gap-3 rounded-lg border border-border p-3 cursor-pointer hover:border-primary/50 transition-colors"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: gw.color + "18" }}>
                    <CreditCard className="h-5 w-5" style={{ color: gw.color }} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{gw.name}</p>
                    <p className="text-xs text-muted-foreground">{gw.description}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Selected gateway config */}
          {selectedGateway && (
            <div className="space-y-4 rounded-lg border border-border p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md" style={{ backgroundColor: selectedGateway.color + "18" }}>
                    <CreditCard className="h-4 w-4" style={{ color: selectedGateway.color }} />
                  </div>
                  <span className="font-medium text-sm">{selectedGateway.name}</span>
                </div>
                <Badge variant={gatewayEnvironment === "production" ? "default" : "secondary"}>
                  {gatewayEnvironment === "production" ? "Produção" : "Sandbox"}
                </Badge>
              </div>

              <div className="space-y-2">
                <Label>Ambiente</Label>
                <Select value={gatewayEnvironment} onValueChange={setGatewayEnvironment}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sandbox">Sandbox (Testes)</SelectItem>
                    <SelectItem value="production">Produção</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="publicKey">{selectedGateway.publicKeyLabel}</Label>
                <Input
                  id="publicKey"
                  value={gatewayPublicKey}
                  onChange={(e) => setGatewayPublicKey(e.target.value)}
                  placeholder={selectedGateway.publicKeyPlaceholder}
                  maxLength={500}
                  className="font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground">
                  Chave pública para integração no front-end.
                </p>
              </div>

              <div className="flex items-start gap-2 rounded-md bg-muted p-3">
                <ShieldCheck className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                <div className="text-xs text-muted-foreground">
                  <p className="font-medium text-foreground">Chave secreta (Secret Key)</p>
                  <p className="mt-0.5">
                    A chave secreta do {selectedGateway.name} deve ser configurada como variável de ambiente segura no backend, nunca no front-end.
                  </p>
                </div>
              </div>

              <a
                href={selectedGateway.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-xs text-primary hover:underline"
              >
                Documentação do {selectedGateway.name} →
              </a>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Domain */}
      <Card className="border-border">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Domínio</CardTitle>
          </div>
          <CardDescription>Configure o endereço da sua loja</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="domain">Domínio personalizado</Label>
            <Input id="domain" value={customDomain} onChange={(e) => setCustomDomain(e.target.value)} placeholder="minhaloja.com.br" maxLength={255} />
            <p className="text-xs text-muted-foreground">Opcional. Configure o DNS do seu domínio para apontar para a loja.</p>
          </div>
        </CardContent>
      </Card>

      {/* Save button */}
      <div className="flex justify-end pb-6">
        <Button onClick={handleSave} disabled={updateSettings.isPending} size="lg">
          {updateSettings.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Salvar Configurações
        </Button>
      </div>
    </div>
  );
}
