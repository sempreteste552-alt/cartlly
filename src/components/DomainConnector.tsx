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
  ExternalLink, ArrowRight, Copy, Check, HelpCircle
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
  const [step, setStep] = useState<"input" | "instructions" | "verifying" | "done">(
    domainStatus === "verified" ? "done" : currentDomain ? "instructions" : "input"
  );
  const [domain, setDomain] = useState(currentDomain);
  const [checking, setChecking] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [verifyResult, setVerifyResult] = useState<any>(null);

  const progressValue =
    step === "input" ? 20 :
    step === "instructions" ? 50 :
    step === "verifying" ? 80 :
    100;

  const handleProceed = () => {
    const cleanDomain = normalizeDomain(domain);
    if (!isValidDomain(cleanDomain)) {
      toast.error("Formato de domínio inválido. Ex: minhaloja.com.br ou www.minhaloja.com.br");
      return;
    }
    setDomain(cleanDomain);
    onDomainChange(cleanDomain);
    setStep("instructions");
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
    setVerifyResult(null);
    onDomainChange("");
  };

  const verificationToken = settingsId?.slice(0, 12) || "...";
  // CNAME target for tenant routing
  const cnameTarget = `${storeSlug || "store"}.cartlly.lovable.app`;

  return (
    <Card className="border-border">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Domínio Personalizado</CardTitle>
        </div>
        <CardDescription>Conecte seu domínio próprio à sua loja via CNAME</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span className={step === "input" ? "text-primary font-medium" : ""}>1. Domínio</span>
            <span className={step === "instructions" ? "text-primary font-medium" : ""}>2. Configuração DNS</span>
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

        {/* Step 2: Instructions (CNAME-based) */}
        {step === "instructions" && (
          <div className="space-y-4">
            {/* Verify result badges */}
            {verifyResult && (
              <div className="flex gap-2">
                <Badge variant={verifyResult.aRecord ? "default" : "destructive"} className="text-xs">
                  {verifyResult.aRecord ? <CheckCircle2 className="mr-1 h-3 w-3" /> : <XCircle className="mr-1 h-3 w-3" />}
                  DNS
                </Badge>
                <Badge variant={verifyResult.txtRecord ? "default" : "destructive"} className="text-xs">
                  {verifyResult.txtRecord ? <CheckCircle2 className="mr-1 h-3 w-3" /> : <XCircle className="mr-1 h-3 w-3" />}
                  Verificação TXT
                </Badge>
              </div>
            )}

            {/* Instructions */}
            <div className="space-y-2">
              <p className="text-sm font-medium">📋 Configure os registros DNS no seu provedor:</p>
              <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                <li>Acesse o painel de gerenciamento DNS do seu provedor de domínio</li>
                <li>Adicione os registros abaixo</li>
                <li>Aguarde a propagação DNS (pode levar até 72h)</li>
              </ol>
            </div>

            {/* DNS Records Table - Now CNAME-based */}
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
                🔒 O certificado SSL será provisionado automaticamente.
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
                <p>Altere apenas os registros DNS (A e TXT). Modificar os nameservers pode derrubar seu e-mail e outros serviços.</p>
              </div>
              <div className="space-y-2">
                <p className="font-medium text-foreground">📌 Passo a passo:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Acesse o painel do seu provedor de domínio (Hostinger, GoDaddy, Registro.br, etc.)</li>
                  <li>Vá em "Gerenciamento DNS" ou "Zona DNS"</li>
                  <li>Adicione um registro <strong>A</strong> com nome <strong>@</strong> apontando para <strong>185.158.133.1</strong></li>
                  <li>Adicione outro registro <strong>A</strong> com nome <strong>www</strong> apontando para <strong>185.158.133.1</strong></li>
                  <li>Adicione um registro <strong>TXT</strong> com nome <strong>_lovable</strong> e valor <strong>lovable_verify={verificationToken}</strong></li>
                  <li>Salve e aguarde a propagação (até 72h)</li>
                  <li>Clique em "Verificar Conexão" acima</li>
                </ol>
              </div>
              <div className="space-y-2">
                <p className="font-medium text-foreground">🔧 Provedores populares:</p>
                <ul className="space-y-1 list-disc list-inside">
                  <li><strong>Hostinger:</strong> hPanel → Domínios → DNS / Nameservers</li>
                  <li><strong>GoDaddy:</strong> Meus Produtos → DNS → Gerenciar DNS</li>
                  <li><strong>Cloudflare:</strong> Dashboard → DNS → Records (desative proxy)</li>
                  <li><strong>Registro.br:</strong> Meus domínios → Editar zona</li>
                  <li><strong>Namecheap:</strong> Dashboard → Advanced DNS</li>
                </ul>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}
