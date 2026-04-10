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
  ExternalLink, ArrowRight, Server, Copy, Check, AlertTriangle, HelpCircle, Trash2, ShieldCheck, Star
} from "lucide-react";
import { normalizeDomain } from "@/lib/storeDomain";

interface DomainConnectorProps {
  settingsId: string;
  currentDomain?: string;
  domainStatus?: string;
  lastCheck?: string | null;
  storeSlug?: string;
  onDomainChange?: (domain: string) => void;
  onSave?: () => void;
  savedVerifyDetails?: any;
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
  ssl_status: 'pending' | 'active' | 'failed';
  created_at: string;
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
      // Check if domain exists already for any store
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
        is_primary: (domains?.length || 0) === 0, // First domain is primary by default
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
      } else if (data?.status === "pending_ssl") {
        toast.info("DNS verificado ✅ O SSL está sendo provisionado.");
      } else {
        toast.info("Configuração incompleta. Verifique os registros DNS.");
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
      const { error } = await supabase
        .from("store_domains")
        .update({ is_primary: true })
        .eq("id", domain.id);

      if (error) throw error;

      // Also update store_settings to keep custom_domain field in sync for backward compatibility
      await supabase
        .from("store_settings")
        .update({ custom_domain: domain.hostname } as any)
        .eq("id", settingsId);

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

      // If it was primary, clear it in store_settings too
      if (domain.is_primary) {
        await supabase
          .from("store_settings")
          .update({ custom_domain: null } as any)
          .eq("id", settingsId);
      }

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

  const getStatusBadge = (status: string, sslStatus?: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500 hover:bg-green-600">Ativo</Badge>;
      case 'pending_ssl':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-700">Provisionando SSL</Badge>;
      case 'pending_verification':
        return <Badge variant="outline" className="text-amber-600 border-amber-600">Aguardando TXT</Badge>;
      case 'pending_dns':
        return <Badge variant="outline">Aguardando DNS</Badge>;
      case 'failed':
        return <Badge variant="destructive">Falhou</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Card className="border-border shadow-sm overflow-hidden">
      <CardHeader className="bg-muted/30 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-lg">Domínios Personalizados</CardTitle>
              <CardDescription>Gerencie seus domínios e aponte para sua loja</CardDescription>
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
              {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : "Adicionar"}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2 uppercase tracking-wider font-semibold">
            Recomendamos usar seu domínio principal (ex: dominio.com.br)
          </p>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Carregando seus domínios...</p>
          </div>
        ) : domains?.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-6">
            <div className="bg-muted rounded-full p-4 mb-4">
              <Globe className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-medium text-foreground">Nenhum domínio próprio</h3>
            <p className="text-sm text-muted-foreground max-w-[280px]">
              Adicione um domínio acima para começar a usar seu próprio endereço.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {domains?.map((domain) => (
              <Accordion type="single" collapsible key={domain.id}>
                <AccordionItem value="item-1" className="border-none">
                  <div className="flex items-center justify-between p-4 hover:bg-muted/20 transition-colors">
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
                          {getStatusBadge(domain.status, domain.ssl_status)}
                          <span className="text-[10px] text-muted-foreground">
                            Adicionado em {new Date(domain.created_at).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <AccordionTrigger className="hover:no-underline p-2 rounded-md hover:bg-muted">
                        <HelpCircle className="h-4 w-4 text-muted-foreground" />
                      </AccordionTrigger>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                        onClick={() => handleVerify(domain)}
                        disabled={verifyingId === domain.id}
                      >
                        {verifyingId === domain.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleRemove(domain)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <AccordionContent className="px-4 pb-4">
                    <div className="space-y-4 pt-2">
                      <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 flex gap-3">
                        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                        <div className="text-xs text-amber-800 space-y-1">
                          <p className="font-bold">Instruções de Configuração DNS</p>
                          <p>Acesse o painel do seu provedor de domínio (Hostinger, Godaddy, Cloudflare, etc) e adicione os registros abaixo exatamente como mostrados.</p>
                          <p className="font-medium">Importante: Propagação DNS pode levar até 48 horas.</p>
                        </div>
                      </div>

                      <div className="overflow-x-auto rounded-lg border border-border">
                        <table className="w-full text-[11px] text-left">
                          <thead className="bg-muted/50 text-muted-foreground uppercase font-bold">
                            <tr className="border-b border-border">
                              <th className="py-2 px-3">Tipo</th>
                              <th className="py-2 px-3">Host / Nome</th>
                              <th className="py-2 px-3">Valor / Destino</th>
                              <th className="py-2 px-3 text-right">Ação</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border font-mono">
                            {/* A Record Root */}
                            <tr>
                              <td className="py-2 px-3"><Badge variant="outline" className="text-[10px] font-mono">A</Badge></td>
                              <td className="py-2 px-3 font-medium">@</td>
                              <td className="py-2 px-3 text-primary">{PLATFORM_IP}</td>
                              <td className="py-2 px-3 text-right">
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleCopy(PLATFORM_IP, `${domain.id}-a`)}>
                                  {copied === `${domain.id}-a` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                                </Button>
                              </td>
                            </tr>
                            {/* CNAME Record WWW */}
                            <tr>
                              <td className="py-2 px-3"><Badge variant="outline" className="text-[10px] font-mono">CNAME</Badge></td>
                              <td className="py-2 px-3 font-medium">www</td>
                              <td className="py-2 px-3 text-primary">{PLATFORM_EDGE}</td>
                              <td className="py-2 px-3 text-right">
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleCopy(PLATFORM_EDGE, `${domain.id}-cname`)}>
                                  {copied === `${domain.id}-cname` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                                </Button>
                              </td>
                            </tr>
                            {/* TXT Verification */}
                            <tr>
                              <td className="py-2 px-3"><Badge variant="outline" className="text-[10px] font-mono">TXT</Badge></td>
                              <td className="py-2 px-3 font-medium">_lovable</td>
                              <td className="py-2 px-3 text-primary truncate max-w-[150px]">{`lovable_verify=${settingsId}`}</td>
                              <td className="py-2 px-3 text-right">
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleCopy(`lovable_verify=${settingsId}`, `${domain.id}-txt`)}>
                                  {copied === `${domain.id}-txt` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                                </Button>
                              </td>

                            </tr>
                          </tbody>
                        </table>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 text-xs"
                          onClick={() => handleVerify(domain)}
                          disabled={verifyingId === domain.id}
                        >
                          {verifyingId === domain.id ? <Loader2 className="h-3 w-3 mr-2 animate-spin" /> : <CheckCircle2 className="h-3 w-3 mr-2" />}
                          Verificar Agora
                        </Button>
                        {!domain.is_primary && domain.status === 'active' && (
                          <Button
                            variant="secondary"
                            size="sm"
                            className="flex-1 text-xs"
                            onClick={() => handleSetPrimary(domain)}
                          >
                            <Star className="h-3 w-3 mr-2" />
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
