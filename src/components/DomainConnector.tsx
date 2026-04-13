import { useState } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Globe, CheckCircle2, Clock, Loader2, RefreshCw,
  ExternalLink, Server, Copy, Check, Trash2, ShieldCheck, Star,
  ShieldAlert, Lock, Info
} from "lucide-react";
import { normalizeDomain } from "@/lib/storeDomain";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface DomainConnectorProps {
  settingsId: string;
  storeSlug?: string;
}

// Lovable hosting IP - same used in Project Settings → Domains
const LOVABLE_IP = "185.158.133.1";

interface StoreDomain {
  id: string;
  store_id: string;
  hostname: string;
  verification_token: string;
  is_primary: boolean;
  status: string;
  dns_status: string;
  txt_status: string;
  ssl_status: string;
  is_published: boolean;
  created_at: string;
  last_verified_at: string | null;
  dns_validation_details?: any;
  ssl_validation_details?: any;
  last_ssl_error?: string;
  detected_provider?: string;
}

export default function DomainConnector({ settingsId, storeSlug }: DomainConnectorProps) {
  const queryClient = useQueryClient();
  const [newDomain, setNewDomain] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const { data: domains, isLoading, refetch } = useQuery({
    queryKey: ["store_domains", settingsId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_domains")
        .select("*")
        .eq("store_id", settingsId)
        .order("is_primary", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as StoreDomain[];
    },
    enabled: !!settingsId,
  });

  const handleAddDomain = async () => {
    let cleanDomain = normalizeDomain(newDomain);
    if (!cleanDomain || !cleanDomain.includes(".")) {
      toast.error("Informe um domínio válido (ex: minhaloja.com.br)");
      return;
    }

    setIsAdding(true);
    try {
      const { data: existing } = await supabase
        .from("store_domains")
        .select("id")
        .eq("hostname", cleanDomain)
        .maybeSingle();

      if (existing) {
        toast.error("Este domínio já está vinculado a outra loja.");
        return;
      }

      const { error } = await supabase.from("store_domains").insert({
        store_id: settingsId,
        hostname: cleanDomain,
        is_primary: (domains?.length || 0) === 0,
        status: "pending_dns",
      });

      if (error) throw error;
      toast.success("Domínio registrado! Agora configure o DNS e solicite a ativação.");
      setNewDomain("");
      refetch();
    } catch (err: any) {
      toast.error(err.message || "Erro ao adicionar domínio");
    } finally {
      setIsAdding(false);
    }
  };

  const handleVerify = async (domain: StoreDomain) => {
    setVerifyingId(domain.id);
    try {
      const { data, error } = await supabase.functions.invoke("verify-domain", {
        body: { settingsId, domain: domain.hostname, domainId: domain.id },
      });
      if (error) throw error;

      if (data?.status === "active") {
        toast.success(`🎉 Domínio ${domain.hostname} verificado e online!`);
      } else {
        toast.info("Status atualizado. Verifique as pendências abaixo.");
      }
      refetch();
      queryClient.invalidateQueries({ queryKey: ["store_settings"] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao verificar domínio");
    } finally {
      setVerifyingId(null);
    }
  };

  const handleSetPrimary = async (domain: StoreDomain) => {
    try {
      await supabase.from("store_domains").update({ is_primary: false }).eq("store_id", settingsId);
      const { error } = await supabase.from("store_domains").update({ is_primary: true }).eq("id", domain.id);
      if (error) throw error;
      toast.success("Domínio primário definido!");
      refetch();
      queryClient.invalidateQueries({ queryKey: ["store_settings"] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao definir primário");
    }
  };

  const handleRemove = async (domain: StoreDomain) => {
    if (!confirm(`Tem certeza que deseja remover o domínio ${domain.hostname}?`)) return;
    try {
      const { error } = await supabase.from("store_domains").delete().eq("id", domain.id);
      if (error) throw error;
      toast.success("Domínio removido.");
      refetch();
      queryClient.invalidateQueries({ queryKey: ["store_settings"] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao remover domínio");
    }
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    toast.success("Copiado!");
    setTimeout(() => setCopied(null), 2000);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500 hover:bg-green-600 text-[10px] h-5">✅ Ativo</Badge>;
      case "pending_ssl":
      case "emitting":
        return <Badge variant="secondary" className="bg-blue-100 text-blue-700 animate-pulse text-[10px] h-5">🔒 SSL Emitindo</Badge>;
      case "pending_dns":
        return <Badge variant="outline" className="text-[10px] h-5">⏳ Aguardando DNS</Badge>;
      case "pending_activation":
        return <Badge variant="outline" className="text-amber-600 border-amber-600 text-[10px] h-5">🔔 Aguardando Ativação</Badge>;
      case "failed":
        return <Badge variant="destructive" className="text-[10px] h-5">❌ Falhou</Badge>;
      default:
        return <Badge variant="outline" className="text-[10px] h-5">{status}</Badge>;
    }
  };

  const isActive = (d: StoreDomain) => d.status === "active";

  return (
    <Card className="border-border shadow-sm overflow-hidden">
      <CardHeader className="bg-muted/30 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-lg">Domínio Próprio</CardTitle>
              <CardDescription>Conecte seu domínio oficial à sua loja</CardDescription>
            </div>
          </div>
          <ShieldCheck className="h-8 w-8 text-primary/20" />
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {/* Add domain input */}
        <div className="p-4 bg-background border-b border-border">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                placeholder="ex: minhaloja.com.br"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                disabled={isAdding}
                className="pr-10"
                onKeyDown={(e) => e.key === "Enter" && handleAddDomain()}
              />
              <Globe className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
            <Button onClick={handleAddDomain} disabled={isAdding || !newDomain.trim()}>
              {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : "Conectar"}
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Carregando domínios...</p>
          </div>
        ) : domains?.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-6">
            <div className="bg-muted rounded-full p-4 mb-4">
              <Globe className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-medium text-foreground">Nenhum domínio conectado</h3>
            <p className="text-sm text-muted-foreground max-w-[280px]">
              Adicione um domínio acima para profissionalizar seu negócio.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {domains?.map((domain) => (
              <Accordion type="single" collapsible key={domain.id} defaultValue={domains.length === 1 ? "item-1" : undefined}>
                <AccordionItem value="item-1" className="border-none">
                  {/* Domain header */}
                  <div className="flex items-center justify-between p-4 hover:bg-muted/10 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${domain.is_primary ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                        {domain.is_primary ? <Star className="h-4 w-4 fill-primary" /> : <Globe className="h-4 w-4" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">{domain.hostname}</span>
                          {domain.is_primary && (
                            <Badge className="text-[10px] h-4 bg-primary/20 text-primary border-none">Principal</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          {getStatusBadge(domain.status)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <AccordionTrigger className="hover:no-underline p-2 rounded-md hover:bg-muted shrink-0">
                        <span className="text-xs mr-2 text-muted-foreground font-normal hidden sm:inline">Detalhes</span>
                      </AccordionTrigger>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-primary shrink-0"
                        onClick={() => handleVerify(domain)}
                        disabled={verifyingId === domain.id}
                        title="Verificar DNS"
                      >
                        {verifyingId === domain.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                        onClick={() => handleRemove(domain)}
                        title="Remover domínio"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <AccordionContent className="px-4 pb-4">
                    <div className="space-y-5 pt-2">

                      {/* Activation notice */}
                      {!isActive(domain) && (
                        <Alert className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
                          <Info className="h-4 w-4 text-blue-600" />
                          <AlertTitle className="text-blue-800 dark:text-blue-300 text-sm">Ativação necessária</AlertTitle>
                          <AlertDescription className="text-blue-700 dark:text-blue-400 text-xs space-y-1">
                            <p>Após configurar o DNS abaixo, entre em contato com o <strong>suporte da plataforma</strong> para que ativem seu domínio no servidor.</p>
                            <p className="text-[10px] opacity-80">O suporte precisa registrar o domínio no hosting para que o SSL e o tráfego funcionem.</p>
                          </AlertDescription>
                        </Alert>
                      )}

                      {/* Error alert */}
                      {(domain.status === "failed" || domain.last_ssl_error) && (
                        <Alert variant="destructive" className="bg-destructive/5">
                          <ShieldAlert className="h-4 w-4" />
                          <AlertTitle className="text-sm">Erro detectado</AlertTitle>
                          <AlertDescription className="text-xs">
                            {domain.last_ssl_error || "Houve um problema ao validar seu domínio. Verifique os registros DNS abaixo."}
                          </AlertDescription>
                        </Alert>
                      )}

                      {/* Step progress */}
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-muted/30 p-3 rounded-lg border border-border text-center">
                          <p className="text-[10px] font-bold text-muted-foreground mb-1 uppercase">1. DNS</p>
                          <div className="flex items-center justify-center gap-1.5">
                            {domain.dns_status === "propagated" ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                            ) : (
                              <Clock className="h-3.5 w-3.5 text-amber-500" />
                            )}
                            <span className="text-xs font-medium">
                              {domain.dns_status === "propagated" ? "OK" : "Pendente"}
                            </span>
                          </div>
                        </div>
                        <div className="bg-muted/30 p-3 rounded-lg border border-border text-center">
                          <p className="text-[10px] font-bold text-muted-foreground mb-1 uppercase">2. SSL</p>
                          <div className="flex items-center justify-center gap-1.5">
                            {domain.ssl_status === "active" ? (
                              <Lock className="h-3.5 w-3.5 text-green-500" />
                            ) : (
                              <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin" />
                            )}
                            <span className="text-xs font-medium">
                              {domain.ssl_status === "active" ? "Seguro" : "Aguardando"}
                            </span>
                          </div>
                        </div>
                        <div className="bg-muted/30 p-3 rounded-lg border border-border text-center">
                          <p className="text-[10px] font-bold text-muted-foreground mb-1 uppercase">3. Status</p>
                          <div className="flex items-center justify-center gap-1.5">
                            {isActive(domain) ? (
                              <ShieldCheck className="h-3.5 w-3.5 text-green-500" />
                            ) : (
                              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                            <span className="text-xs font-medium">
                              {isActive(domain) ? "Online" : "Pendente"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* DNS Instructions - A Record based (matches Lovable hosting) */}
                      {!isActive(domain) && (
                        <div className="bg-background border border-border rounded-xl overflow-hidden shadow-sm">
                          <div className="bg-muted/50 px-4 py-2 border-b border-border flex items-center gap-2">
                            <Server className="h-4 w-4 text-primary" />
                            <h4 className="font-bold text-xs uppercase tracking-tight">Configure no seu provedor de DNS</h4>
                          </div>

                          <div className="p-4 space-y-4">
                            {/* A Record - Root */}
                            <DnsRow
                              type="A"
                              host="@"
                              hostLabel="(domínio raiz)"
                              value={LOVABLE_IP}
                              onCopy={() => handleCopy(LOVABLE_IP, `a-root-${domain.id}`)}
                              isCopied={copied === `a-root-${domain.id}`}
                            />

                            {/* A Record - www */}
                            <DnsRow
                              type="A"
                              host="www"
                              hostLabel="(subdomínio www)"
                              value={LOVABLE_IP}
                              onCopy={() => handleCopy(LOVABLE_IP, `a-www-${domain.id}`)}
                              isCopied={copied === `a-www-${domain.id}`}
                            />

                            {/* TXT Record - Verification */}
                            <DnsRow
                              type="TXT"
                              host="_lovable"
                              hostLabel="(verificação)"
                              value={`lovable_verify=${domain.verification_token || settingsId}`}
                              onCopy={() => handleCopy(`lovable_verify=${domain.verification_token || settingsId}`, `txt-${domain.id}`)}
                              isCopied={copied === `txt-${domain.id}`}
                            />

                            <div className="pt-2 space-y-1.5 border-t border-border/50">
                              <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                                <Clock className="h-3 w-3" />
                                A propagação DNS pode levar até <strong>72 horas</strong>.
                              </p>
                              <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                                <Lock className="h-3 w-3" />
                                O certificado SSL será provisionado automaticamente.
                              </p>
                              <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                                <Info className="h-3 w-3" />
                                Após configurar, solicite a ativação ao suporte da plataforma.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {!domain.is_primary && (
                          <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => handleSetPrimary(domain)}>
                            <Star className="mr-1.5 h-3 w-3" />
                            Definir como Principal
                          </Button>
                        )}
                        {isActive(domain) && (
                          <Button variant="default" size="sm" className="text-xs h-8" asChild>
                            <a href={`https://${domain.hostname}`} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="mr-1.5 h-3 w-3" />
                              Abrir Loja
                            </a>
                          </Button>
                        )}
                        {domain.last_verified_at && (
                          <span className="text-[10px] text-muted-foreground ml-auto">
                            Verificado: {new Date(domain.last_verified_at).toLocaleString("pt-BR")}
                          </span>
                        )}
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* Reusable DNS row component */
function DnsRow({
  type,
  host,
  hostLabel,
  value,
  onCopy,
  isCopied,
}: {
  type: string;
  host: string;
  hostLabel?: string;
  value: string;
  onCopy: () => void;
  isCopied: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="font-mono text-[10px] font-bold">{type}</Badge>
        {hostLabel && <span className="text-[10px] text-muted-foreground">{hostLabel}</span>}
      </div>
      <div className="grid grid-cols-12 gap-2 bg-muted/20 p-2.5 rounded-md border border-border/50 items-center">
        <div className="col-span-3">
          <p className="text-[9px] text-muted-foreground uppercase">Host</p>
          <p className="text-xs font-mono font-bold">{host}</p>
        </div>
        <div className="col-span-7 overflow-hidden">
          <p className="text-[9px] text-muted-foreground uppercase">Valor</p>
          <p className="text-xs font-mono truncate text-primary font-medium">{value}</p>
        </div>
        <div className="col-span-2 flex justify-end">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onCopy}>
            {isCopied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
