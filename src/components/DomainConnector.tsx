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
  ShieldAlert, Info, Lock, Settings2
} from "lucide-react";
import { normalizeDomain } from "@/lib/storeDomain";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface DomainConnectorProps {
  settingsId: string;
  storeSlug?: string;
}

const PLATFORM_EDGE = "www.msktelemarkting.shop"; // The project's main domain for CNAMEs

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
  detected_provider?: string;
  cloudflare_zone_id?: string;
  cloudflare_api_token?: string;
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
  const [showAdvanced, setShowAdvanced] = useState<string | null>(null);
  const [cfZoneId, setCfZoneId] = useState("");
  const [cfToken, setCfToken] = useState("");
  const [isUpdatingCf, setIsUpdatingCf] = useState(false);

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

  const handleUpdateCloudflare = async (domainId: string) => {
    setIsUpdatingCf(true);
    try {
      const { error } = await supabase
        .from("store_domains")
        .update({
          cloudflare_zone_id: cfZoneId,
          cloudflare_api_token: cfToken
        })
        .eq("id", domainId);

      if (error) throw error;
      toast.success("Configurações Cloudflare salvas!");
      setShowAdvanced(null);
      refetch();
    } catch (err: any) {
      toast.error("Erro ao salvar: " + err.message);
    } finally {
      setIsUpdatingCf(false);
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
      case 'active': return <Badge className="bg-green-500 hover:bg-green-600 text-[10px] h-5">Ativo</Badge>;
      case 'pending_ssl': case 'emitting': return <Badge variant="secondary" className="bg-blue-100 text-blue-700 animate-pulse text-[10px] h-5">SSL Emitindo</Badge>;
      case 'pending_verification': return <Badge variant="outline" className="text-amber-600 border-amber-600 text-[10px] h-5">Verificado</Badge>;
      case 'pending_dns': return <Badge variant="outline" className="text-[10px] h-5">Aguardando DNS</Badge>;
      case 'failed': return <Badge variant="destructive" className="text-[10px] h-5">Falhou</Badge>;
      default: return <Badge variant="outline" className="text-[10px] h-5">{status}</Badge>;
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
              <CardDescription>Conecte seu domínio oficial à sua loja</CardDescription>
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
                          {domain.detected_provider && (
                            <Badge variant="outline" className="text-[9px] h-4 font-normal bg-muted/50">
                              DNS: {domain.detected_provider}
                            </Badge>
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
                      >
                        {verifyingId === domain.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                        onClick={() => handleRemove(domain)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <AccordionContent className="px-4 pb-4">
                    <div className="space-y-6 pt-2">
                      {/* Provider Detection & Warning */}
                      {domain.detected_provider === 'Cloudflare' && (
                        <Alert className="bg-amber-50 border-amber-100">
                          <AlertTriangle className="h-4 w-4 text-amber-600" />
                          <AlertTitle className="text-amber-800 text-sm">Detectamos que você usa Cloudflare</AlertTitle>
                          <AlertDescription className="text-amber-700 text-xs">
                            Para evitar o <strong>Erro 1014/1034</strong>, desative o "Proxy" (nuvem laranja) para o CNAME 'www' e deixe apenas DNS (nuvem cinza).
                          </AlertDescription>
                        </Alert>
                      )}

                      {/* Diagnostic Alerts */}
                      {(domain.status === 'failed' || domain.last_ssl_error) && (
                        <Alert variant="destructive" className="bg-destructive/5">
                          <ShieldAlert className="h-4 w-4" />
                          <AlertTitle className="text-sm">Erro detectado</AlertTitle>
                          <AlertDescription className="text-xs">
                            {domain.last_ssl_error || "Houve um problema ao validar seu domínio. Verifique os registros DNS abaixo."}
                          </AlertDescription>
                        </Alert>
                      )}

                      {/* Step Status */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="bg-muted/30 p-3 rounded-lg border border-border">
                          <p className="text-[10px] font-bold text-muted-foreground mb-1 uppercase">1. Verificação</p>
                          <div className="flex items-center gap-1.5">
                            {domain.txt_status === 'verified' ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> : <Clock className="h-3.5 w-3.5 text-amber-500" />}
                            <span className="text-xs font-medium">{domain.txt_status === 'verified' ? "OK" : "Pendente"}</span>
                          </div>
                        </div>
                        <div className="bg-muted/30 p-3 rounded-lg border border-border">
                          <p className="text-[10px] font-bold text-muted-foreground mb-1 uppercase">2. DNS (CNAME)</p>
                          <div className="flex items-center gap-1.5">
                            {domain.dns_status === 'propagated' ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> : <Clock className="h-3.5 w-3.5 text-amber-500" />}
                            <span className="text-xs font-medium">{domain.dns_status === 'propagated' ? "Configurado" : "Aguardando"}</span>
                          </div>
                        </div>
                        <div className="bg-muted/30 p-3 rounded-lg border border-border">
                          <p className="text-[10px] font-bold text-muted-foreground mb-1 uppercase">3. SSL</p>
                          <div className="flex items-center gap-1.5">
                            {domain.ssl_status === 'active' ? <Lock className="h-3.5 w-3.5 text-green-500" /> : <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin" />}
                            <span className="text-xs font-medium">{domain.ssl_status === 'active' ? "Seguro" : "Emitindo..."}</span>
                          </div>
                        </div>
                        <div className="bg-muted/30 p-3 rounded-lg border border-border">
                          <p className="text-[10px] font-bold text-muted-foreground mb-1 uppercase">4. Publicado</p>
                          <div className="flex items-center gap-1.5">
                            {domain.status === 'active' ? <ShieldCheck className="h-3.5 w-3.5 text-green-500" /> : <Clock className="h-3.5 w-3.5 text-muted-foreground" />}
                            <span className="text-xs font-medium">{domain.status === 'active' ? "Online" : "Processando"}</span>
                          </div>
                        </div>
                      </div>

                      {/* Instructions */}
                      <div className="bg-background border border-border rounded-xl overflow-hidden shadow-sm">
                        <div className="bg-muted/50 px-4 py-2 border-b border-border flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Server className="h-4 w-4 text-primary" />
                            <h4 className="font-bold text-xs uppercase tracking-tight">Instruções de DNS</h4>
                          </div>
                          {domain.detected_provider && (
                            <span className="text-[10px] text-muted-foreground">Provedor: <strong>{domain.detected_provider}</strong></span>
                          )}
                        </div>
                        
                        <div className="p-4 space-y-4">
                          {/* CNAME */}
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <Label className="text-[10px] uppercase text-muted-foreground font-bold">CNAME (Redirecionamento)</Label>
                              <Badge variant="outline" className="font-mono text-[9px]">Obrigatório</Badge>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 bg-muted/20 p-2 rounded-md border border-border/50">
                              <div className="sm:col-span-3">
                                <p className="text-[9px] text-muted-foreground">HOST</p>
                                <p className="text-xs font-mono font-bold">
                                  {domain.hostname.split(".").length > 2 
                                    ? domain.hostname.split(".").slice(0, -2).join(".") 
                                    : "@"}
                                </p>
                              </div>
                              <div className="sm:col-span-7 overflow-hidden">
                                <p className="text-[9px] text-muted-foreground">VALOR / DESTINO</p>
                                <p className="text-xs font-mono truncate">{PLATFORM_EDGE}</p>
                              </div>

                              <div className="sm:col-span-2 flex justify-end">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleCopy(PLATFORM_EDGE, `cname-${domain.id}`)}>
                                  {copied === `cname-${domain.id}` ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
                                </Button>
                              </div>
                            </div>
                          </div>

                          {/* TXT */}
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <Label className="text-[10px] uppercase text-muted-foreground font-bold">TXT (Verificação de Propriedade)</Label>
                              <Badge variant="outline" className="font-mono text-[9px]">Obrigatório</Badge>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 bg-muted/20 p-2 rounded-md border border-border/50">
                              <div className="sm:col-span-3">
                                <p className="text-[9px] text-muted-foreground">HOST</p>
                                <p className="text-xs font-mono font-bold">
                                  {domain.hostname.split(".").length > 2 && !domain.hostname.startsWith("www.")
                                    ? `_lovable.${domain.hostname.split(".").slice(0, -2).join(".")}`
                                    : "_lovable"}
                                </p>
                              </div>

                              <div className="sm:col-span-8 overflow-hidden">
                                <p className="text-[9px] text-muted-foreground">VALOR</p>
                                <p className="text-xs font-mono truncate">{domain.verification_token}</p>
                              </div>
                              <div className="sm:col-span-2 flex justify-end">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleCopy(domain.verification_token, `txt-${domain.id}`)}>
                                  {copied === `txt-${domain.id}` ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Advanced Settings */}
                      <div className="border-t border-border pt-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs gap-1 h-8 text-muted-foreground hover:text-primary px-0"
                          onClick={() => {
                            setShowAdvanced(showAdvanced === domain.id ? null : domain.id);
                            setCfZoneId(domain.cloudflare_zone_id || "");
                            setCfToken(domain.cloudflare_api_token || "");
                          }}
                        >
                          <Settings2 className="h-3.5 w-3.5" />
                          {showAdvanced === domain.id ? "Esconder" : "Configuração Avançada (Cloudflare)"}
                        </Button>

                        {showAdvanced === domain.id && (
                          <div className="mt-4 p-4 bg-muted/20 border border-border rounded-lg space-y-4 animate-in fade-in slide-in-from-top-2">
                            <div className="space-y-1">
                              <h5 className="text-xs font-bold uppercase text-primary tracking-wider">Cloudflare Advanced</h5>
                              <p className="text-[10px] text-muted-foreground">
                                Use esta opção se seu domínio está no Cloudflare e você deseja integração automática via API.
                              </p>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="space-y-1.5">
                                <Label className="text-[10px] uppercase">Zone ID</Label>
                                <Input
                                  value={cfZoneId}
                                  onChange={(e) => setCfZoneId(e.target.value)}
                                  placeholder="Ex: d41d8cd98f00b204e9800998ecf8427e"
                                  className="h-8 text-xs font-mono"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-[10px] uppercase">API Token</Label>
                                <Input
                                  type="password"
                                  value={cfToken}
                                  onChange={(e) => setCfToken(e.target.value)}
                                  placeholder="Token com permissão de DNS"
                                  className="h-8 text-xs font-mono"
                                />
                              </div>
                            </div>
                            <Button
                              size="sm"
                              className="w-full h-8 text-xs"
                              disabled={isUpdatingCf}
                              onClick={() => handleUpdateCloudflare(domain.id)}
                            >
                              {isUpdatingCf ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <CheckCircle2 className="h-3 w-3 mr-2" />}
                              Salvar Credenciais
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* Final Actions */}
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Button
                          variant="default"
                          className="flex-1 h-11"
                          onClick={() => handleVerify(domain)}
                          disabled={verifyingId === domain.id}
                        >
                          {verifyingId === domain.id ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                          Validar Agora
                        </Button>
                        {!domain.is_primary && domain.status === 'active' && (
                          <Button
                            variant="outline"
                            className="flex-1 h-11"
                            onClick={() => handleSetPrimary(domain)}
                          >
                            <Star className="h-4 w-4 mr-2" />
                            Tornar Principal
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