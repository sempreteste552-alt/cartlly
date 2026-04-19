import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, CreditCard, ShieldCheck, Zap, CheckCircle2, XCircle, AlertTriangle, Power, Eye, EyeOff } from "lucide-react";
import { useStoreSettings, useUpdateStoreSettings } from "@/hooks/useStoreSettings";
import { toast } from "sonner";
import { LockedFeature } from "@/components/LockedFeature";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";
import { useAuth } from "@/contexts/AuthContext";

const GATEWAYS = [
  { id: "mercadopago", name: "Mercado Pago", description: "Gateway líder na América Latina.", requiresPublicKey: true, publicKeyLabel: "Public Key", publicKeyPlaceholder: "APP_USR-xxxxxxxx", secretKeyLabel: "Access Token", secretKeyPlaceholder: "APP_USR-xxxxxxxx-xxxxxx", docsUrl: "https://www.mercadopago.com.br/developers/pt/docs", color: "#009ee3", testEndpoint: "https://api.mercadopago.com/v1/payment_methods" },
  { id: "stripe", name: "Stripe", description: "Pagamentos globais com Apple Pay e Google Pay.", requiresPublicKey: true, publicKeyLabel: "Publishable Key", publicKeyPlaceholder: "pk_live_xxxxxxxx", secretKeyLabel: "Secret Key", secretKeyPlaceholder: "sk_live_xxxxxxxx", docsUrl: "https://stripe.com/docs", color: "#635bff", testEndpoint: "" },
  { id: "pagbank", name: "PagBank (PagSeguro)", description: "Soluções completas de pagamento.", requiresPublicKey: true, publicKeyLabel: "Token Público", publicKeyPlaceholder: "XXXXXXXX-XXXX", secretKeyLabel: "Token Privado", secretKeyPlaceholder: "XXXXXXXX-XXXX", docsUrl: "https://dev.pagbank.uol.com.br", color: "#41b64f", testEndpoint: "" },
  { id: "amplopay", name: "Amplopay", description: "Gateway com PIX e Boleto simplificado.", requiresPublicKey: true, publicKeyLabel: "Public Key", publicKeyPlaceholder: "pk_xxxxxxxx", secretKeyLabel: "Secret Key", secretKeyPlaceholder: "sk_xxxxxxxx", docsUrl: "https://app.amplopay.com/docs", color: "#6366f1", testEndpoint: "" },
  { id: "asaas", name: "Asaas", description: "PIX, Cartão de Crédito e Boleto em uma só API.", requiresPublicKey: false, publicKeyLabel: "", publicKeyPlaceholder: "", secretKeyLabel: "API Key", secretKeyPlaceholder: "$aact_xxxxxxxx...", docsUrl: "https://docs.asaas.com", color: "#1d8cf8", testEndpoint: "" },
];

type TestStatus = "idle" | "testing" | "success" | "error";

export function GatewaySettings() {
  const { data: settings, isLoading } = useStoreSettings();
  const updateSettings = useUpdateStoreSettings();
  const { isLocked } = usePlanFeatures();
  const { user } = useAuth();
  const gatewayLocked = isLocked("gateway");

  const [paymentGateway, setPaymentGateway] = useState("");
  const [gatewayPublicKey, setGatewayPublicKey] = useState("");
  const [gatewaySecretKey, setGatewaySecretKey] = useState("");
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [showPublicKey, setShowPublicKey] = useState(false);
  const [gatewayEnvironment, setGatewayEnvironment] = useState("sandbox");
  const [maxInstallments, setMaxInstallments] = useState(12);
  const [gatewayActive, setGatewayActive] = useState(false);
  const [testStatus, setTestStatus] = useState<TestStatus>("idle");
  const [testMessage, setTestMessage] = useState("");
  const [testOwner, setTestOwner] = useState<{ name: string; email: string; store: string } | null>(null);

  useEffect(() => {
    if (settings) {
      setPaymentGateway(settings.payment_gateway ?? "");
      setGatewayPublicKey(settings.gateway_public_key ?? "");
      setGatewaySecretKey((settings as any).gateway_secret_key ?? "");
      setGatewayEnvironment(settings.gateway_environment ?? "sandbox");
      setMaxInstallments((settings as any).max_installments ?? 12);
      setGatewayActive(!!(settings.payment_gateway && settings.gateway_public_key && (settings as any).gateway_secret_key));
    }
  }, [settings]);

  const selectedGateway = GATEWAYS.find((g) => g.id === paymentGateway);

  const handleTestApi = async () => {
    if (!paymentGateway || !gatewayPublicKey) {
      toast.error("Configure o gateway e a chave pública primeiro.");
      return;
    }
    if (!gatewaySecretKey) {
      toast.error("Configure a chave secreta primeiro.");
      return;
    }
    if (!user?.id) {
      toast.error("Usuário não autenticado.");
      return;
    }
    toast.info("Salve as configurações antes de testar. Testando com dados salvos...");
    setTestStatus("testing");
    setTestMessage("");
    setTestOwner(null);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(
        `${supabaseUrl}/functions/v1/create-payment`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ test: true, gateway: paymentGateway, store_user_id: user.id }),
        }
      );
      const data = await response.json();

      if (response.ok || data.test_ok) {
        setTestStatus("success");
        setTestMessage(data.message || `Gateway ${selectedGateway?.name} conectado!`);
        if (data.owner_name || data.owner_email) {
          setTestOwner({ name: data.owner_name || "", email: data.owner_email || "", store: data.store_name || "" });
        }
      } else {
        setTestStatus("error");
        setTestMessage(data.error || "Gateway não respondeu corretamente.");
      }
    } catch (err: any) {
      setTestStatus("error");
      setTestMessage("Erro de conexão: " + err.message);
    }
  };

  const handleSave = () => {
    if (!settings) return;
    updateSettings.mutate({
      id: settings.id,
      payment_gateway: paymentGateway || null,
      gateway_public_key: gatewayPublicKey.trim() || null,
      gateway_secret_key: gatewaySecretKey.trim() || null,
      gateway_environment: gatewayEnvironment,
      max_installments: maxInstallments,
    } as any);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <LockedFeature isLocked={gatewayLocked} featureName="Gateway de Pagamento" logoUrl={settings?.logo_url || undefined}>
    <div className="space-y-6">
      {/* Gateway Status Card with Toggle */}
      <Card className={`border-border ${paymentGateway ? "border-l-4" : ""}`} style={paymentGateway && selectedGateway ? { borderLeftColor: selectedGateway.color } : {}}>
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Power className={`h-5 w-5 ${gatewayActive ? "text-green-500" : "text-muted-foreground"}`} />
            <div>
              <p className="font-medium">Status do Gateway</p>
              <p className="text-xs text-muted-foreground">
                {paymentGateway ? `${selectedGateway?.name} - ${gatewayEnvironment === "production" ? "Produção" : "Sandbox"}` : "Nenhum gateway configurado"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={gatewayActive ? (gatewayEnvironment === "production" ? "default" : "secondary") : "outline"}>
              {gatewayActive ? (gatewayEnvironment === "production" ? "✅ Ativo" : "🧪 Sandbox") : "❌ Desativado"}
            </Badge>
            <Switch
              checked={gatewayActive}
              onCheckedChange={(checked) => {
                if (checked && (!paymentGateway || !gatewayPublicKey || !gatewaySecretKey)) {
                  toast.error("Configure o gateway e as chaves antes de ativar.");
                  return;
                }
                setGatewayActive(checked);
                if (settings) {
                  updateSettings.mutate({
                    id: settings.id,
                    payment_gateway: checked ? paymentGateway : null,
                  } as any);
                  toast.success(checked ? "✅ Gateway ativado!" : "❌ Gateway desativado!");
                }
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Gateway Selection */}
      <Card className="border-border">
        <CardHeader>
          <div className="flex items-center gap-2"><CreditCard className="h-5 w-5 text-primary" /><CardTitle className="text-lg">Selecionar Gateway</CardTitle></div>
          <CardDescription>Escolha o processador de pagamentos</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select value={paymentGateway || "none"} onValueChange={(v) => setPaymentGateway(v === "none" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhum</SelectItem>
              {GATEWAYS.map((gw) => <SelectItem key={gw.id} value={gw.id}>{gw.name}</SelectItem>)}
            </SelectContent>
          </Select>

          {selectedGateway && (
            <div className="space-y-4 rounded-lg border border-border p-4">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" style={{ color: selectedGateway.color }} />
                <span className="font-medium text-sm">{selectedGateway.name}</span>
                <span className="text-xs text-muted-foreground ml-1">— {selectedGateway.description}</span>
              </div>

              <Select value={gatewayEnvironment} onValueChange={setGatewayEnvironment}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sandbox">Sandbox (Testes)</SelectItem>
                  <SelectItem value="production">Produção</SelectItem>
                </SelectContent>
              </Select>

              {selectedGateway.requiresPublicKey && (
                <div className="space-y-2">
                  <Label>{selectedGateway.publicKeyLabel}</Label>
                  <div className="relative">
                    <Input type={showPublicKey ? "text" : "password"} value={gatewayPublicKey} onChange={(e) => setGatewayPublicKey(e.target.value)} placeholder={selectedGateway.publicKeyPlaceholder} className="font-mono text-xs pr-10" maxLength={500} />
                    <button type="button" onClick={() => setShowPublicKey(!showPublicKey)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                      {showPublicKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>{selectedGateway.secretKeyLabel || "Chave Secreta"}</Label>
                <div className="relative">
                  <Input type={showSecretKey ? "text" : "password"} value={gatewaySecretKey} onChange={(e) => setGatewaySecretKey(e.target.value)} placeholder={selectedGateway.secretKeyPlaceholder || "Chave secreta do gateway"} className="font-mono text-xs pr-10" maxLength={500} />
                  <button type="button" onClick={() => setShowSecretKey(!showSecretKey)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                    {showSecretKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-start gap-2 rounded-md bg-muted p-3">
                <ShieldCheck className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                <p className="text-xs text-muted-foreground">Suas chaves são armazenadas de forma segura e usadas apenas no servidor.</p>
              </div>

              {/* Webhook URL */}
              <div className="rounded-md bg-blue-50 dark:bg-blue-950 p-3 text-xs text-blue-700 dark:text-blue-300">
                <p className="font-medium mb-1">URL do Webhook (configure no painel do gateway):</p>
                <code className="block bg-blue-100 dark:bg-blue-900 p-2 rounded text-[10px] break-all">
                  {`https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/payment-webhook?gateway=${paymentGateway}`}
                </code>
              </div>

              {/* Docs link */}
              <a href={selectedGateway.docsUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                📖 Ver documentação do {selectedGateway.name}
              </a>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Installments Config */}
      {selectedGateway && (
        <Card className="border-border">
          <CardHeader>
            <div className="flex items-center gap-2"><CreditCard className="h-5 w-5 text-primary" /><CardTitle className="text-lg">Parcelamento</CardTitle></div>
            <CardDescription>Configure o número máximo de parcelas aceitas</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Máximo de Parcelas</Label>
              <Select value={String(maxInstallments)} onValueChange={(v) => setMaxInstallments(parseInt(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}x {n === 1 ? "(à vista)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Clientes poderão parcelar em até {maxInstallments}x no cartão de crédito</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* API Test */}
      {selectedGateway && (
        <Card className="border-border">
          <CardHeader>
            <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" /><CardTitle className="text-lg">Teste de API</CardTitle></div>
            <CardDescription>Verifique se as credenciais estão funcionando</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Gateway</p>
                <p className="font-medium">{selectedGateway.name}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Ambiente</p>
                <p className="font-medium">{gatewayEnvironment === "production" ? "Produção" : "Sandbox"}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Chave Pública</p>
                <p className="font-mono text-xs truncate">{gatewayPublicKey ? `${gatewayPublicKey.slice(0, 12)}...` : "Não configurada"}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Chave Secreta</p>
                <p className="font-mono text-xs">{gatewaySecretKey ? "••••••••" : "Não configurada"}</p>
              </div>
            </div>

            <Button onClick={handleTestApi} disabled={testStatus === "testing"} variant="outline" className="w-full">
              {testStatus === "testing" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {testStatus === "idle" && <Zap className="mr-2 h-4 w-4" />}
              {testStatus === "success" && <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />}
              {testStatus === "error" && <XCircle className="mr-2 h-4 w-4 text-red-500" />}
              {testStatus === "testing" ? "Testando..." : "Testar Conexão"}
            </Button>

            {testMessage && (
              <div className={`rounded-lg p-3 text-sm space-y-2 ${
                testStatus === "success" ? "bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300" : "bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300"
              }`}>
                <div className="flex items-start gap-2">
                  {testStatus === "success" ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" /> : <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />}
                  <p>{testMessage}</p>
                </div>
                {testOwner && testStatus === "success" && (
                  <div className="border-t border-green-200 dark:border-green-800 pt-2 mt-2 text-xs space-y-1">
                    <p><span className="font-medium">👤 Titular da Conta:</span> {testOwner.name}</p>
                    <p><span className="font-medium">📧 Email da Conta:</span> {testOwner.email}</p>
                    {testOwner.store && <p><span className="font-medium">🏪 Conta:</span> {testOwner.store}</p>}
                    <p><span className="font-medium">🌐 Ambiente:</span> {gatewayEnvironment === "production" ? "Produção" : "Sandbox"}</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end pb-6">
        <Button onClick={handleSave} disabled={updateSettings.isPending} size="lg">
          {updateSettings.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Salvar Configurações do Gateway
        </Button>
      </div>
    </div>
    </LockedFeature>
  );
}
