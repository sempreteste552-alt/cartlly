import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Globe, CheckCircle2, Clock, XCircle, Loader2, RefreshCw,
  ExternalLink, ArrowRight, Server, Copy, Check, AlertTriangle, HelpCircle, Upload
} from "lucide-react";

interface DomainConnectorProps {
  settingsId?: string;
  currentDomain: string;
  domainStatus: string;
  lastCheck: string | null;
  storeSlug?: string;
  onDomainChange: (domain: string) => void;
  onSave: () => void;
}

const PROVIDER_MAP: Record<string, { name: string; logo: string; instructions: string[] }> = {
  hostinger: {
    name: "Hostinger",
    logo: "🟣",
    instructions: [
      "Acesse hPanel → Domínios → seu domínio",
      "Clique em 'DNS / Nameservers'",
      "Na aba 'Registros DNS', adicione os registros abaixo",
    ],
  },
  godaddy: {
    name: "GoDaddy",
    logo: "🟢",
    instructions: [
      "Acesse Meus Produtos → Domínios → DNS",
      "Clique em 'Gerenciar DNS'",
      "Adicione os registros abaixo na seção de registros",
    ],
  },
  cloudflare: {
    name: "Cloudflare",
    logo: "🟠",
    instructions: [
      "Acesse o Dashboard → selecione seu domínio",
      "Vá em DNS → Records",
      "Adicione os registros abaixo (desative o proxy/nuvem laranja para o registro A)",
    ],
  },
  registrobr: {
    name: "Registro.br",
    logo: "🔵",
    instructions: [
      "Acesse registro.br → Meus domínios",
      "Clique no domínio → 'Editar zona'",
      "Adicione os registros abaixo",
    ],
  },
  namecheap: {
    name: "Namecheap",
    logo: "🔴",
    instructions: [
      "Acesse Dashboard → Domain List → Manage",
      "Clique em 'Advanced DNS'",
      "Adicione os registros abaixo em 'HOST RECORDS'",
    ],
  },
};

function detectProviderFromNS(nameservers: string[]): string {
  const ns = nameservers.map((n) => n.toLowerCase());
  for (const n of ns) {
    if (n.includes("hostinger") || n.includes("dns-parking")) return "hostinger";
    if (n.includes("godaddy") || n.includes("domaincontrol")) return "godaddy";
    if (n.includes("cloudflare")) return "cloudflare";
    if (n.includes("registro.br") || n.includes("dns.br")) return "registrobr";
    if (n.includes("namecheap") || n.includes("registrar-servers")) return "namecheap";
  }
  return "other";
}

function normalizeDomain(domain: string): string {
  return domain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/\.$/, "");
}

function isValidDomain(domain: string): boolean {
  const cleaned = normalizeDomain(domain);
  return /^[a-zA-Z0-9][a-zA-Z0-9.-]*\.[a-zA-Z]{2,}$/.test(cleaned);
}

export default function DomainConnector({
  settingsId,
  currentDomain,
  domainStatus,
  lastCheck,
  storeSlug,
  onDomainChange,
  onSave,
}: DomainConnectorProps) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<"input" | "detecting" | "instructions" | "verifying" | "done">(
    domainStatus === "verified" ? "done" : currentDomain ? "instructions" : "input"
  );
  const [domain, setDomain] = useState(currentDomain);
  const [provider, setProvider] = useState<string>("");
  const [nameservers, setNameservers] = useState<string[]>([]);
  const [checking, setChecking] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [verifyResult, setVerifyResult] = useState<any>(null);

  const progressValue =
    step === "input" ? 15 :
    step === "detecting" ? 35 :
    step === "instructions" ? 55 :
    step === "verifying" ? 80 :
    100;

  const handleProceed = async () => {
    const cleanDomain = normalizeDomain(domain);
    if (!isValidDomain(cleanDomain)) {
      toast.error("Formato de domínio inválido. Ex: minhaloja.com.br ou www.minhaloja.com.br");
      return;
    }

    setDomain(cleanDomain);
    onDomainChange(cleanDomain);
    setStep("detecting");

    try {
      const providerLookupDomain = cleanDomain.replace(/^www\./, "");
      const nsRes = await fetch(`https://dns.google/resolve?name=${providerLookupDomain}&type=NS`);
      const nsData = await nsRes.json();
      const nsList = nsData.Answer?.map((r: any) => r.data) || [];
      setNameservers(nsList);
      const detected = detectProviderFromNS(nsList);
      setProvider(detected);
      setStep("instructions");
    } catch {
      setProvider("other");
      setStep("instructions");
    }
  };

  const handleVerify = async () => {
    if (!settingsId) {
      toast.error("Salve as configurações primeiro antes de verificar");
      return;
    }

    const domainToVerify = normalizeDomain(domain);
    if (!isValidDomain(domainToVerify)) {
      toast.error("Informe um domínio válido antes de verificar");
      return;
    }

    setStep("verifying");
    setChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke("verify-domain", {
        body: { settingsId, domain: domainToVerify },
      });
      if (error) throw error;

      setDomain(data?.domain || domainToVerify);
      onDomainChange(data?.domain || domainToVerify);
      setVerifyResult(data);
      await queryClient.invalidateQueries({ queryKey: ["store_settings"] });

      if (data?.status === "verified") {
        setStep("done");
        toast.success("Domínio verificado com sucesso! ✅");
      } else if (data?.status === "pending") {
        setStep("instructions");
        toast.info("DNS parcialmente configurado. Continue com os registros faltantes.");
      } else {
        setStep("instructions");
        toast.error("DNS ainda não apontado corretamente. Verifique os registros mostrados.");
      }
    } catch (err: any) {
      setStep("instructions");
      toast.error(err.message || "Erro ao verificar");
    } finally {
      setChecking(false);
    }
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    toast.success("Copiado!");
    setTimeout(() => setCopied(null), 2000);
  };

  const handleReset = () => {
    setStep("input");
    setDomain("");
    setProvider("");
    setVerifyResult(null);
    onDomainChange("");
  };

  const providerInfo = PROVIDER_MAP[provider] || {
    name: "Outro Provedor",
    logo: "🌐",
    instructions: [
      "Acesse o painel de controle do seu provedor de domínio",
      "Localize a seção de gerenciamento DNS",
      "Adicione os registros abaixo",
    ],
  };

  const verificationToken = settingsId?.slice(0, 12) || "...";

  return (
    <Card className="border-border">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Domínio Personalizado</CardTitle>
        </div>
        <CardDescription>Conecte seu domínio próprio à sua loja</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span className={step === "input" ? "text-primary font-medium" : ""}>1. Domínio</span>
            <span className={step === "detecting" || step === "instructions" ? "text-primary font-medium" : ""}>2. Configuração</span>
            <span className={step === "verifying" ? "text-primary font-medium" : ""}>3. Verificação</span>
            <span className={step === "done" ? "text-primary font-medium" : ""}>4. Conectado</span>
          </div>
          <Progress value={progressValue} className="h-2" />
        </div>

        {/* Step 1: Domain Input */}
        {step === "input" && (
          <div className="space-y-3">
            <Label>Digite seu domínio</Label>
            <div className="flex gap-2">
              <Input
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="minhaloja.com.br"
                maxLength={255}
              />
              <Button onClick={handleProceed} disabled={!domain.trim()}>
                Prosseguir <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Ex: minhaloja.com.br ou loja.meusite.com
            </p>
          </div>
        )}

        {/* Step 2: Detecting */}
        {step === "detecting" && (
          <div className="flex flex-col items-center gap-3 py-6">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Detectando provedor DNS de <strong>{domain}</strong>...</p>
          </div>
        )}

        {/* Step 3: Instructions */}
        {step === "instructions" && (
          <div className="space-y-4">
            {/* Provider detected */}
            <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 p-3">
              <span className="text-2xl">{providerInfo.logo}</span>
              <div>
                <p className="text-sm font-medium">
                  Detectamos que seu domínio está na <strong>{providerInfo.name}</strong>
                </p>
                {nameservers.length > 0 && (
                  <p className="text-xs text-muted-foreground font-mono">
                    NS: {nameservers.slice(0, 2).join(", ")}
                  </p>
                )}
              </div>
            </div>

            {/* Verify result badges */}
            {verifyResult && (
              <div className="flex gap-2">
                <Badge variant={verifyResult.aRecord ? "default" : "destructive"} className="text-xs">
                  {verifyResult.aRecord ? <CheckCircle2 className="mr-1 h-3 w-3" /> : <XCircle className="mr-1 h-3 w-3" />}
                  Registro A
                </Badge>
                <Badge variant={verifyResult.txtRecord ? "default" : "destructive"} className="text-xs">
                  {verifyResult.txtRecord ? <CheckCircle2 className="mr-1 h-3 w-3" /> : <XCircle className="mr-1 h-3 w-3" />}
                  Registro TXT
                </Badge>
              </div>
            )}

            {/* Instructions */}
            <div className="space-y-2">
              <p className="text-sm font-medium">📋 Siga os passos:</p>
              <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                {providerInfo.instructions.map((inst, i) => (
                  <li key={i}>{inst}</li>
                ))}
              </ol>
            </div>

            {/* DNS Records Table */}
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead className="bg-muted/50">
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Tipo</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Nome</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Valor</th>
                    <th className="py-2 px-3"></th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  <tr className="border-b border-border/50">
                    <td className="py-2 px-3"><Badge variant="outline" className="text-xs">A</Badge></td>
                    <td className="py-2 px-3">@</td>
                    <td className="py-2 px-3 text-primary font-medium">185.158.133.1</td>
                    <td className="py-2 px-3">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleCopy("185.158.133.1", "a-root")}>
                        {copied === "a-root" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      </Button>
                    </td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-2 px-3"><Badge variant="outline" className="text-xs">A</Badge></td>
                    <td className="py-2 px-3">www</td>
                    <td className="py-2 px-3 text-primary font-medium">185.158.133.1</td>
                    <td className="py-2 px-3">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleCopy("185.158.133.1", "a-www")}>
                        {copied === "a-www" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      </Button>
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3"><Badge variant="outline" className="text-xs">TXT</Badge></td>
                    <td className="py-2 px-3">_lovable</td>
                    <td className="py-2 px-3 text-primary font-medium break-all">lovable_verify={verificationToken}</td>
                    <td className="py-2 px-3">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleCopy(`lovable_verify=${verificationToken}`, "txt")}>
                        {copied === "txt" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      </Button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" /> A propagação DNS pode levar até <strong>72 horas</strong>.
              </p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Server className="h-3 w-3" /> O certificado SSL será provisionado automaticamente.
              </p>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2 pt-2">
              <Button onClick={() => { onSave(); handleVerify(); }} disabled={checking}>
                {checking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Verificar Conexão
              </Button>
              <Button variant="outline" onClick={handleReset}>
                Alterar Domínio
              </Button>
            </div>
          </div>
        )}

        {/* Step: Verifying */}
        {step === "verifying" && (
          <div className="flex flex-col items-center gap-3 py-6">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Verificando registros DNS de <strong>{domain}</strong>...</p>
          </div>
        )}

        {/* Step 4: Done */}
        {step === "done" && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30 p-4">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-sm font-semibold text-green-700 dark:text-green-400">Domínio Conectado!</p>
                <p className="text-xs text-green-600 dark:text-green-500">
                  <strong>{domain}</strong> está verificado e ativo.
                </p>
              </div>
            </div>

            {lastCheck && (
              <p className="text-xs text-muted-foreground">
                Última verificação: {new Date(lastCheck).toLocaleString("pt-BR")}
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <Button variant="default" size="sm" asChild>
                <a href={`https://${domain}`} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" /> Abrir Loja
                </a>
              </Button>
              <Button variant="outline" size="sm" onClick={handleVerify} disabled={checking}>
                {checking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Reverificar
              </Button>
              <Button variant="ghost" size="sm" onClick={handleReset}>
                Alterar Domínio
              </Button>
            </div>
          </div>
        )}
        {/* Tutorial */}
        <Accordion type="single" collapsible className="mt-2">
          <AccordionItem value="tutorial" className="border-border">
            <AccordionTrigger className="text-sm py-2">
              <div className="flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-primary" />
                Tutorial: Como configurar o domínio
              </div>
            </AccordionTrigger>
            <AccordionContent className="text-sm space-y-4 text-muted-foreground">
              <div className="space-y-2">
                <p className="font-medium text-foreground">⚠️ Importante: NÃO altere os Nameservers (NS)</p>
                <p>Você <strong>não</strong> precisa mudar os nameservers do seu domínio. Apenas adicione os registros DNS (A e TXT) no painel do seu provedor atual.</p>
              </div>

              <div className="space-y-2">
                <p className="font-medium text-foreground">Passo a passo:</p>
                <ol className="list-decimal list-inside space-y-2">
                  <li>Acesse o <strong>painel de DNS</strong> do seu provedor de domínio (Hostinger, GoDaddy, Cloudflare, Registro.br, etc.)</li>
                  <li>Adicione um registro <strong>A</strong> com nome <code className="bg-muted px-1 rounded">@</code> apontando para <code className="bg-muted px-1 rounded">185.158.133.1</code></li>
                  <li>Adicione outro registro <strong>A</strong> com nome <code className="bg-muted px-1 rounded">www</code> apontando para <code className="bg-muted px-1 rounded">185.158.133.1</code></li>
                  <li>Adicione um registro <strong>TXT</strong> com nome <code className="bg-muted px-1 rounded">_lovable</code> e valor <code className="bg-muted px-1 rounded">lovable_verify={settingsId?.slice(0, 12) || "..."}</code></li>
                  <li>Aguarde a propagação DNS (pode levar de 5 minutos a 72 horas)</li>
                  <li>Clique em <strong>"Verificar Conexão"</strong> acima</li>
                </ol>
              </div>

              <div className="space-y-2">
                <p className="font-medium text-foreground">Se usar Cloudflare:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li><strong>Desative o proxy (nuvem laranja)</strong> no registro A — use DNS Only (nuvem cinza)</li>
                  <li>Se preferir manter o proxy ativo, use CNAME em vez de A record</li>
                </ul>
              </div>

              <div className="space-y-2">
                <p className="font-medium text-foreground">Problemas comuns:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li><strong>Registro A não detectado:</strong> Verifique se não há outro registro A conflitante para @ ou www</li>
                  <li><strong>TXT não detectado:</strong> Certifique-se de que o nome é <code className="bg-muted px-1 rounded">_lovable</code> (com underscore)</li>
                  <li><strong>Demora na propagação:</strong> Use <a href="https://dnschecker.org" target="_blank" rel="noopener noreferrer" className="text-primary underline">dnschecker.org</a> para verificar</li>
                </ul>
              </div>

              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                <p className="text-xs">
                  <strong>💡 Dica:</strong> Após o domínio ser verificado, o botão "Ver Loja" no painel usará automaticamente seu domínio personalizado e o certificado SSL será provisionado em poucos minutos.
                </p>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}
