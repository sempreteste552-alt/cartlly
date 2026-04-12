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
  ExternalLink, ArrowRight, Server, Copy, Check, AlertTriangle, HelpCircle, Trash2, ShieldCheck, Star, Shield
} from "lucide-react";
import { normalizeDomain } from "@/lib/storeDomain";

interface DomainConnectorProps {
  settingsId: string;
}

const PLATFORM_IP = "185.158.133.1";
const PLATFORM_EDGE = "edge.lovableproject.com";

interface StoreDomain {
  id: string;
  store_id: string;
  hostname: string;
  verification_token: string;
  is_primary: boolean;
  status: 'pending_dns' | 'pending_verification' | 'pending_ssl' | 'active' | 'failed';
  dns_status: 'pending' | 'propagated' | 'failed';
  txt_status: 'pending' | 'verified' | 'failed';
  ssl_status: 'pending' | 'active' | 'failed';
  is_published: boolean;
  created_at: string;
  last_verified_at: string | null;
}

export default function DomainConnector({
  settingsId,
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
    const cleanDomain = normalizeDomain(newDomain);
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
      } else {
        toast.info("Status atualizado. Verifique os pendentes.");
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
      // Set all domains for this store to not primary
      await supabase
        .from("store_domains")
        .update({ is_primary: false })
        .eq("store_id", settingsId);

      // Set selected domain as primary
      const { error } = await supabase
        .from("store_domains")
        .update({ is_primary: true })
        .eq("id", domain.id);

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
      const { error } = await supabase
        .from("store_domains")
        .delete()
        .eq("id", domain.id);

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

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return 'Domínio Publicado';
      case 'pending_ssl': return 'SSL Emitindo';
      case 'pending_verification': return 'Domínio Verificado';
      case 'pending_dns': return 'Aguardando DNS';
      case 'failed': return 'Erro na Configuração';
      default: return status;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active': return <Badge className="bg-green-500 hover:bg-green-600">Ativo</Badge>;
      case 'pending_ssl': return <Badge variant="secondary" className="bg-blue-100 text-blue-700 animate-pulse">SSL Emitindo</Badge>;
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
                placeholder="ex: minhaloja.com.br"
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
                              Verificado há {Math.round((new Date().getTime() - new Date(domain.last_verified_at).getTime()) / 60000)} min
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <AccordionTrigger className="hover:no-underline p-2 rounded-md hover:bg-muted shrink-0">
                        <span className="text-xs mr-2 text-muted-foreground font-normal hidden sm:inline">Configurações</span>
                      </AccordionTrigger>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-primary shrink-0"
                        onClick={() => handleVerify(domain)}
                        disabled={verifyingId === domain.id}
                        title="Atualizar status"
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
                    <div className="space-y-6 pt-2">
                      {/* Step Status Indicator */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
                        <div className={`flex flex-col items-center p-2 rounded-lg border ${domain.dns_status === 'propagated' ? 'bg-green-50 border-green-100 text-green-700' : 'bg-muted border-border text-muted-foreground'}`}>
                          {domain.dns_status === 'propagated' ? <CheckCircle2 className="h-4 w-4 mb-1" /> : <Clock className="h-4 w-4 mb-1" />}
                          <span className="text-[10px] font-medium">1. DNS</span>
                        </div>
                        <div className={`flex flex-col items-center p-2 rounded-lg border ${domain.txt_status === 'verified' ? 'bg-green-50 border-green-100 text-green-700' : 'bg-muted border-border text-muted-foreground'}`}>
                          {domain.txt_status === 'verified' ? <CheckCircle2 className="h-4 w-4 mb-1" /> : <Clock className="h-4 w-4 mb-1" />}
                          <span className="text-[10px] font-medium">2. Verificação</span>
                        </div>
                        <div className={`flex flex-col items-center p-2 rounded-lg border ${domain.ssl_status === 'active' ? 'bg-green-50 border-green-100 text-green-700' : 'bg-muted border-border text-muted-foreground'}`}>
                          {domain.ssl_status === 'active' ? <CheckCircle2 className="h-4 w-4 mb-1" /> : <Shield className="h-4 w-4 mb-1" />}
                          <span className="text-[10px] font-medium">3. SSL</span>
                        </div>
                        <div className={`flex flex-col items-center p-2 rounded-lg border ${domain.status === 'active' ? 'bg-green-50 border-green-100 text-green-700' : 'bg-muted border-border text-muted-foreground'}`}>
                          {domain.status === 'active' ? <CheckCircle2 className="h-4 w-4 mb-1" /> : <Globe className="h-4 w-4 mb-1" />}
                          <span className="text-[10px] font-medium">4. Publicado</span>
                        </div>
                      </div>

                      <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 flex gap-3">
                        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                        <div className="text-xs text-amber-800 space-y-1">
                          <p className="font-bold">Instruções Obrigatórias</p>
                          <p>Acesse seu provedor de domínio e adicione os 3 registros abaixo exatamente como indicados.</p>
                          <p className="font-medium">O SSL será emitido automaticamente após a propagação do DNS.</p>
                        </div>
                      </div>

                      <div className="overflow-x-auto rounded-lg border border-border">
                        <table className="w-full text-[11px] text-left">
                          <thead className="bg-muted/50 text-muted-foreground uppercase font-bold">
                            <tr className="border-b border-border">
                              <th className="py-2 px-3">Tipo</th>
                              <th className="py-2 px-3">Host / Nome</th>
                              <th className="py-2 px-3">Valor / Destino</th>
                              <th className="py-2 px-3">Finalidade</th>
                              <th className="py-2 px-3 text-right">Copiar</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border font-mono">
                            <tr>
                              <td className="py-2 px-3"><Badge variant="outline" className="text-[10px] font-mono bg-white">A</Badge></td>
                              <td className="py-2 px-3 font-medium">@</td>
                              <td className="py-2 px-3 text-primary">{PLATFORM_IP}</td>
                              <td className="py-2 px-3 text-muted-foreground">Raiz do domínio</td>
                              <td className="py-2 px-3 text-right">
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleCopy(PLATFORM_IP, `${domain.id}-a`)}>
                                  {copied === `${domain.id}-a` ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
                                </Button>
                              </td>
                            </tr>
                            <tr>
                              <td className="py-2 px-3"><Badge variant="outline" className="text-[10px] font-mono bg-white">CNAME</Badge></td>
                              <td className="py-2 px-3 font-medium">www</td>
                              <td className="py-2 px-3 text-primary">{PLATFORM_EDGE}</td>
                              <td className="py-2 px-3 text-muted-foreground">Subdomínio www</td>
                              <td className="py-2 px-3 text-right">
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleCopy(PLATFORM_EDGE, `${domain.id}-cname`)}>
                                  {copied === `${domain.id}-cname` ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
                                </Button>
                              </td>
                            </tr>
                            <tr>
                              <td className="py-2 px-3"><Badge variant="outline" className="text-[10px] font-mono bg-white">TXT</Badge></td>
                              <td className="py-2 px-3 font-medium">_lovable</td>
                              <td className="py-2 px-3 text-primary truncate max-w-[120px]">lovable_verify={domain.verification_token || settingsId}</td>
                              <td className="py-2 px-3 text-muted-foreground">Verificação de posse</td>
                              <td className="py-2 px-3 text-right">
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleCopy(`lovable_verify=${domain.verification_token || settingsId}`, `${domain.id}-txt`)}>
                                  {copied === `${domain.id}-txt` ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
                                </Button>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2">
                        <Button
                          variant="default"
                          className="flex-1"
                          onClick={() => handleVerify(domain)}
                          disabled={verifyingId === domain.id}
                        >
                          {verifyingId === domain.id ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                          Verificar Configurações
                        </Button>
                        {!domain.is_primary && domain.status === 'active' && (
                          <Button
                            variant="outline"
                            className="flex-1"
                            onClick={() => handleSetPrimary(domain)}
                          >
                            <Star className="h-4 w-4 mr-2" />
                            Definir como Principal
                          </Button>
                        )}
                        {domain.status === 'active' && (
                          <Button
                            variant="secondary"
                            className="flex-1"
                            asChild
                          >
                            <a href={`https://${domain.hostname}`} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-4 w-4 mr-2" />
                              Abrir Loja
                            </a>
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