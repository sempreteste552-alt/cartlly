import { useState, useEffect, useCallback } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
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
  ExternalLink, ArrowRight, Server, Copy, Check, AlertTriangle, HelpCircle, Trash2, ShieldCheck, Star, Shield,
  ShieldAlert, Info, Lock
} from "lucide-react";
import { normalizeDomain } from "@/lib/storeDomain";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface DomainConnectorProps {
  settingsId: string;
  storeSlug?: string;
}

const PLATFORM_EDGE = "edge.lovableproject.com";

interface StoreDomain {
  id: string;
  store_id: string;
  hostname: string;
  verification_token: string;
  is_primary: boolean;
  status: 'pending_dns' | 'pending_verification' | 'pending_ssl' | 'active' | 'failed' | 'emitting';
  dns_status: 'pending' | 'propagated' | 'failed' | 'conflict';
  txt_status: 'pending' | 'verified' | 'failed';
  ssl_status: 'pending' | 'active' | 'failed' | 'emitting';
  is_published: boolean;
  created_at: string;
  last_verified_at: string | null;
  dns_validation_details?: any;
  ssl_validation_details?: any;
  conflicting_records?: any[];
  last_ssl_error?: string;
}

export default function DomainConnector({
  settingsId,
  storeSlug,
}: DomainConnectorProps) {
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

    // Force/Suggest www
    if (!cleanDomain.startsWith("www.") && cleanDomain.split(".").length === 2) {
      if (confirm(`Recomendamos usar 'www.${cleanDomain}' para melhor estabilidade e SSL. Deseja adicionar com www?`)) {
        cleanDomain = `www.${cleanDomain}`;
      }
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
        status: 'pending_dns'
      });

      if (error) throw error;

      toast.success("Domínio adicionado com sucesso!");
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
        body: { 
          settingsId, 
          domain: domain.hostname,
          domainId: domain.id
        },
      });
      
      if (error) throw error;

      if (data?.status === "active") {
        toast.success(`🎉 Domínio ${domain.hostname} verificado e online!`);
      } else if (data?.dnsStatus === 'conflict') {
        toast.warning("Detectamos conflitos no DNS que podem impedir o SSL.");
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
      case 'active': return <Badge className="bg-green-500 hover:bg-green-600">Ativo</Badge>;
      case 'pending_ssl': case 'emitting': return <Badge variant="secondary" className="bg-blue-100 text-blue-700 animate-pulse">SSL Emitindo</Badge>;
      case 'pending_verification': return <Badge variant="outline" className="text-amber-600 border-amber-600">Verificado</Badge>;
      case 'pending_dns': return <Badge variant="outline">Aguardando DNS</Badge>;
      case 'failed': return <Badge variant="destructive">Falhou</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Card className="border-border shadow-sm overflow-hidden">
      <CardHeader className="bg-muted/30 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-lg">Domínio Próprio</CardTitle>
              <CardDescription>Conecte seu domínio oficial à sua loja (ex: www.loja.com)</CardDescription>
            </div>
          </div>
          <ShieldCheck className="h-8 w-8 text-primary/20" />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="p-4 bg-background border-b border-border">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                placeholder="ex: www.minhaloja.com.br"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                disabled={isAdding}
                className="pr-10"
              />
              <Globe className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
            <Button onClick={handleAddDomain} disabled={isAdding || !newDomain.trim()}>
              {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : "Conectar"}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">
            <strong>Dica:</strong> Recomendamos sempre usar o subdomínio <strong>www</strong> como principal.
          </p>
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
              Sua loja está usando o endereço padrão. Adicione um domínio acima para profissionalizar seu negócio.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {domains?.map((domain) => (
              <Accordion type="single" collapsible key={domain.id} defaultValue={domains.length === 1 ? "item-1" : undefined}>
                <AccordionItem value="item-1" className="border-none">
                  <div className="flex items-center justify-between p-4 hover:bg-muted/10 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${domain.is_primary ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                        {domain.is_primary ? <Star className="h-4 w-4 fill-primary" /> : <Globe className="h-4 w-4" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">{domain.hostname}</span>
                          {domain.is_primary && <Badge className="text-[10px] h-4 bg-primary/20 text-primary border-none">Principal</Badge>}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          {getStatusBadge(domain.status)}
                          {domain.last_verified_at && (
                            <span className="text-[10px] text-muted-foreground">
                              Checado há {Math.round((new Date().getTime() - new Date(domain.last_verified_at).getTime()) / 60000)} min
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <AccordionTrigger className="hover:no-underline p-2 rounded-md hover:bg-muted shrink-0">
                        <span className="text-xs mr-2 text-muted-foreground font-normal hidden sm:inline">Gerenciar</span>
                      </AccordionTrigger>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-primary shrink-0"
                        onClick={() => handleVerify(domain)}
                        disabled={verifyingId === domain.id}
                        title="Validar agora"
                      >
                        {verifyingId === domain.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                        onClick={() => handleRemove(domain)}
                        title="Remover"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <AccordionContent className="px-4 pb-4">
                    <div className="space-y-6 pt-2">
                      {/* Conflict Alerts */}
                      {domain.conflicting_records && domain.conflicting_records.length > 0 && (
                        <Alert variant="destructive" className="bg-destructive/5 border-destructive/20">
                          <ShieldAlert className="h-4 w-4" />
                          <AlertTitle>Conflito de DNS detectado</AlertTitle>
                          <AlertDescription className="text-xs space-y-2">
                            {domain.conflicting_records.map((conflict, idx) => (
                              <p key={idx}>{conflict.message}</p>
                            ))}
                            <p className="font-bold">Remova os registros 'A' do domínio raiz ou configure redirecionamento.</p>
                          </AlertDescription>
                        </Alert>
                      )}

                      {/* SSL Error Diagnostics */}
                      {domain.ssl_status === 'failed' && domain.last_ssl_error && (
                        <Alert variant="destructive" className="bg-destructive/5 border-destructive/20">
                          <Lock className="h-4 w-4" />
                          <AlertTitle>Erro na emissão do SSL</AlertTitle>
                          <AlertDescription className="text-xs">
                            Motivo provável: {domain.last_ssl_error}
                            <br />
                            Certifique-se que o DNS propagou e não há bloqueios de proxy (Cloudflare, etc).
                          </AlertDescription>
                        </Alert>
                      )}

                      {/* Relationship with Tenant */}
                      <div className="bg-primary/5 border border-primary/10 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                          <p className="text-xs font-medium text-primary uppercase tracking-wider mb-1">Status de Publicação</p>
                          <div className="flex items-center gap-2">
                            {domain.status === 'active' ? (
                              <div className="flex items-center gap-2 text-sm font-semibold text-green-600">
                                <CheckCircle2 className="h-4 w-4" />
                                Loja publicada em: https://{domain.hostname}
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 text-sm font-semibold text-amber-600">
                                <Clock className="h-4 w-4" />
                                Aguardando ativação final
                              </div>
                            )}
                          </div>
                        </div>
                        {domain.status === 'active' ? (
                          <Button size="sm" asChild>
                            <a href={`https://${domain.hostname}`} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-4 w-4 mr-2" />
                              Acessar Domínio
                            </a>
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" asChild>
                            <a href={`/loja/${storeSlug}`} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-4 w-4 mr-2" />
                              Ver Loja (Slug)
                            </a>
                          </Button>
                        )}
                      </div>

                      {/* Step Status Indicator (4 Steps) */}
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {/* 1. Verificação */}
                        <div className="bg-background border border-border rounded-xl p-4 shadow-sm flex flex-col justify-between">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] font-bold uppercase text-muted-foreground">1. Verificação</span>
                            {domain.txt_status === 'verified' ? (
                              <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none h-5 text-[10px]">OK</Badge>
                            ) : (
                              <Badge variant="secondary" className="animate-pulse h-5 text-[10px]">Pendente</Badge>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground">TXT _lovable verificado.</p>
                        </div>

                        {/* 2. DNS */}
                        <div className="bg-background border border-border rounded-xl p-4 shadow-sm flex flex-col justify-between">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] font-bold uppercase text-muted-foreground">2. DNS</span>
                            {domain.dns_status === 'propagated' ? (
                              <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none h-5 text-[10px]">Configurado</Badge>
                            ) : domain.dns_status === 'conflict' ? (
                              <Badge variant="destructive" className="h-5 text-[10px]">Conflito</Badge>
                            ) : (
                              <Badge variant="outline" className="h-5 text-[10px]">Aguardando</Badge>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground">CNAME apontado p/ Lovable.</p>
                        </div>

                        {/* 3. SSL */}
                        <div className="bg-background border border-border rounded-xl p-4 shadow-sm flex flex-col justify-between">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] font-bold uppercase text-muted-foreground">3. SSL</span>
                            {domain.ssl_status === 'active' ? (
                              <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none h-5 text-[10px]">Ativo</Badge>
                            ) : domain.ssl_status === 'emitting' ? (
                              <Badge variant="secondary" className="bg-blue-50 text-blue-600 animate-pulse border-none h-5 text-[10px]">Emitindo</Badge>
                            ) : (
                              <Badge variant="outline" className="h-5 text-[10px]">Pendente</Badge>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground">HTTPS seguro ativado.</p>
                        </div>

                        {/* 4. Publicação */}
                        <div className="bg-background border border-border rounded-xl p-4 shadow-sm flex flex-col justify-between">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] font-bold uppercase text-muted-foreground">4. Publicação</span>
                            {domain.status === 'active' ? (
                              <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none h-5 text-[10px]">Publicado</Badge>
                            ) : (
                              <Badge variant="outline" className="h-5 text-[10px]">Aguardando</Badge>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground">Domínio pronto para uso.</p>
                        </div>
                      </div>

                      {/* DNS Table */}
                      <div className="bg-muted/30 border border-border rounded-xl p-6 space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Server className="h-4 w-4 text-primary" />
                          <h4 className="font-bold text-sm">Configuração Recomendada</h4>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Adicione os dois registros abaixo no seu provedor de domínio:
                        </p>

                        <div className="space-y-3">
                          {/* CNAME RECORD */}
                          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-center bg-background p-4 rounded-lg border border-border shadow-sm">
                            <div className="flex flex-col">
                              <span className="text-[10px] text-muted-foreground font-bold uppercase">Tipo</span>
                              <Badge variant="outline" className="w-fit font-mono mt-1">CNAME</Badge>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[10px] text-muted-foreground font-bold uppercase">Host / Nome</span>
                              <span className="text-sm font-mono font-medium mt-1">www</span>
                            </div>
                            <div className="flex flex-col sm:col-span-1">
                              <span className="text-[10px] text-muted-foreground font-bold uppercase">Valor / Destino</span>
                              <span className="text-sm font-mono font-medium mt-1 text-primary truncate">{PLATFORM_EDGE}</span>
                            </div>
                            <div className="flex justify-end">
                              <Button variant="secondary" size="sm" className="h-8 gap-2" onClick={() => handleCopy(PLATFORM_EDGE, `${domain.id}-cname`)}>
                                {copied === `${domain.id}-cname` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                                {copied === `${domain.id}-cname` ? 'Copiado' : 'Copiar'}
                              </Button>
                            </div>
                          </div>

                          {/* TXT RECORD */}
                          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-center bg-background p-4 rounded-lg border border-border shadow-sm">
                            <div className="flex flex-col">
                              <span className="text-[10px] text-muted-foreground font-bold uppercase">Tipo</span>
                              <Badge variant="outline" className="w-fit font-mono mt-1">TXT</Badge>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[10px] text-muted-foreground font-bold uppercase">Host / Nome</span>
                              <span className="text-sm font-mono font-medium mt-1">_lovable</span>
                            </div>
                            <div className="flex flex-col sm:col-span-1">
                              <span className="text-[10px] text-muted-foreground font-bold uppercase">Valor</span>
                              <span className="text-sm font-mono font-medium mt-1 text-primary truncate">lovable_verify={domain.verification_token}</span>
                            </div>
                            <div className="flex justify-end">
                              <Button variant="secondary" size="sm" className="h-8 gap-2" onClick={() => handleCopy(`lovable_verify=${domain.verification_token}`, `${domain.id}-txt`)}>
                                {copied === `${domain.id}-txt` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                                {copied === `${domain.id}-txt` ? 'Copiado' : 'Copiar'}
                              </Button>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-3 pt-2">
                          <Alert className="bg-blue-50/50 border-blue-100">
                            <Info className="h-4 w-4 text-blue-600" />
                            <AlertDescription className="text-[11px] text-blue-800">
                              <strong>Atenção ao Domínio Raiz:</strong> Recomendamos configurar um <strong>redirecionamento</strong> no seu provedor do domínio principal (ex: dominio.com) para o <strong>www</strong> (www.dominio.com). Isso evita falhas de SSL e garante que todos os clientes acessem sua loja.
                            </AlertDescription>
                          </Alert>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2 pt-2">
                        <Button
                          variant="default"
                          className="flex-1 h-11"
                          onClick={() => handleVerify(domain)}
                          disabled={verifyingId === domain.id}
                        >
                          {verifyingId === domain.id ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                          Validar e Atualizar Status
                        </Button>
                        {!domain.is_primary && domain.status === 'active' && (
                          <Button
                            variant="outline"
                            className="flex-1 h-11"
                            onClick={() => handleSetPrimary(domain)}
                          >
                            <Star className="h-4 w-4 mr-2" />
                            Definir como Principal
                          </Button>
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