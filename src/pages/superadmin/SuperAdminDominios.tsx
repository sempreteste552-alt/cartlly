import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Globe, CheckCircle, XCircle, Clock, ExternalLink, ShieldCheck,
  Loader2, RefreshCw, Store, User, Info, Rocket
} from "lucide-react";
import { toast } from "sonner";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";

export default function SuperAdminDominios() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [tab, setTab] = useState("pending");

  useRealtimeSync("store_domains", [["sa_all_domains"]]);

  const { data: domains, isLoading } = useQuery({
    queryKey: ["sa_all_domains"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_domains")
        .select("*")
        .order("activation_requested_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: stores } = useQuery({
    queryKey: ["sa_stores_for_domains"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_settings")
        .select("id, store_name, store_slug, user_id");
      if (error) throw error;
      return data;
    },
  });

  const { data: profiles } = useQuery({
    queryKey: ["sa_profiles_for_domains"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("user_id, display_name");
      if (error) throw error;
      return data;
    },
  });

  const getStoreInfo = (storeId: string) => {
    const store = stores?.find((s: any) => s.id === storeId);
    const profile = profiles?.find((p: any) => p.user_id === store?.user_id);
    return {
      store_name: store?.store_name || "Sem nome",
      store_slug: store?.store_slug || "",
      owner_name: profile?.display_name || "Desconhecido",
      user_id: store?.user_id || "",
    };
  };

  const pendingDomains = domains?.filter((d: any) => d.status === "pending_activation") || [];
  const activeDomains = domains?.filter((d: any) => d.status === "active") || [];
  const otherDomains = domains?.filter((d: any) => !["pending_activation", "active"].includes(d.status)) || [];

  const handleApprove = async (domain: any) => {
    setProcessingId(domain.id);
    try {
      const storeInfo = getStoreInfo(domain.store_id);

      // 1. Update domain status to active
      const { error } = await supabase.from("store_domains").update({
        status: "active",
        ssl_status: "active",
        dns_status: "propagated",
        activated_by: user?.id,
        activated_at: new Date().toISOString(),
      }).eq("id", domain.id);
      if (error) throw error;

      // 2. If primary, update store_settings
      if (domain.is_primary) {
        await supabase.from("store_settings").update({
          custom_domain: domain.hostname,
          domain_status: "verified",
        } as any).eq("id", domain.store_id);
      }

      // 3. Send notification to tenant
      if (storeInfo.user_id) {
        await supabase.from("admin_notifications").insert({
          sender_user_id: "system",
          target_user_id: storeInfo.user_id,
          title: "🎉 Domínio Ativado!",
          message: `Seu domínio ${domain.hostname} está ativo e funcionando! Seus clientes já podem acessar sua loja pelo endereço https://${domain.hostname}`,
          type: "info",
        });

        // 4. Send push notification
        try {
          await supabase.functions.invoke("send-push-internal", {
            body: {
              target_user_id: storeInfo.user_id,
              title: "🚀 Domínio No Ar!",
              body: `Seu site ${domain.hostname} está online! Compartilhe com seus clientes.`,
              url: `https://${domain.hostname}`,
              target_area: "admin",
            },
          });
        } catch (pushErr) {
          console.warn("Push notification failed (non-critical):", pushErr);
        }
      }

      toast.success(`Domínio ${domain.hostname} ativado com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ["sa_all_domains"] });
      queryClient.invalidateQueries({ queryKey: ["sa_badge_domains"] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao ativar domínio");
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (domain: any) => {
    setProcessingId(domain.id);
    try {
      const storeInfo = getStoreInfo(domain.store_id);

      const { error } = await supabase.from("store_domains").update({
        status: "pending_dns",
        activation_requested_at: null,
      }).eq("id", domain.id);
      if (error) throw error;

      if (storeInfo.user_id) {
        await supabase.from("admin_notifications").insert({
          sender_user_id: "system",
          target_user_id: storeInfo.user_id,
          title: "Domínio Não Ativado",
          message: `A ativação do domínio ${domain.hostname} foi recusada. Verifique se o DNS está configurado corretamente e solicite novamente.`,
          type: "alert",
        });
      }

      toast.success("Solicitação rejeitada.");
      queryClient.invalidateQueries({ queryKey: ["sa_all_domains"] });
      queryClient.invalidateQueries({ queryKey: ["sa_badge_domains"] });
    } catch (err: any) {
      toast.error(err.message || "Erro");
    } finally {
      setProcessingId(null);
    }
  };

  const handleVerifyDns = async (domain: any) => {
    setProcessingId(domain.id);
    try {
      const { data, error } = await supabase.functions.invoke("verify-domain", {
        body: { settingsId: domain.store_id, domain: domain.hostname, domainId: domain.id },
      });
      if (error) throw error;
      toast.info(`DNS: ${data?.dns?.cname?.correct ? "✅ OK" : "❌ Pendente"} | SSL: ${data?.ssl?.ready ? "✅" : "⏳"}`);
      queryClient.invalidateQueries({ queryKey: ["sa_all_domains"] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao verificar");
    } finally {
      setProcessingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active": return <Badge className="bg-green-500 text-white text-[10px]">✅ Ativo</Badge>;
      case "pending_activation": return <Badge className="bg-amber-500 text-white text-[10px] animate-pulse">🔔 Aguardando Ativação</Badge>;
      case "pending_dns": return <Badge variant="outline" className="text-[10px]">⏳ DNS Pendente</Badge>;
      case "pending_ssl": return <Badge variant="secondary" className="text-[10px]">🔒 SSL Emitindo</Badge>;
      case "failed": return <Badge variant="destructive" className="text-[10px]">❌ Falhou</Badge>;
      default: return <Badge variant="outline" className="text-[10px]">{status}</Badge>;
    }
  };

  const DomainCard = ({ domain, showActions = false }: { domain: any; showActions?: boolean }) => {
    const info = getStoreInfo(domain.store_id);
    const isProcessing = processingId === domain.id;

    return (
      <Card className="border-border">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-primary/10 mt-0.5">
                <Globe className="h-4 w-4 text-primary" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-sm">{domain.hostname}</span>
                  {domain.is_primary && <Badge className="text-[9px] h-4 bg-primary/20 text-primary border-none">Principal</Badge>}
                  {getStatusBadge(domain.status)}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Store className="h-3 w-3" /> {info.store_name}</span>
                  <span className="flex items-center gap-1"><User className="h-3 w-3" /> {info.owner_name}</span>
                </div>
                {domain.detected_provider && (
                  <span className="text-[10px] text-muted-foreground">Provedor DNS: {domain.detected_provider}</span>
                )}
                {domain.activation_requested_at && (
                  <span className="text-[10px] text-muted-foreground">
                    Solicitado: {new Date(domain.activation_requested_at).toLocaleString("pt-BR")}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={() => handleVerifyDns(domain)}
                disabled={isProcessing}
              >
                {isProcessing ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                Verificar DNS
              </Button>

              {showActions && (
                <>
                  <Button
                    size="sm"
                    className="h-8 text-xs bg-green-600 hover:bg-green-700"
                    onClick={() => handleApprove(domain)}
                    disabled={isProcessing}
                  >
                    {isProcessing ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle className="h-3 w-3 mr-1" />}
                    Ativar
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => handleReject(domain)}
                    disabled={isProcessing}
                  >
                    <XCircle className="h-3 w-3 mr-1" />
                    Recusar
                  </Button>
                </>
              )}

              {domain.status === "active" && (
                <Button variant="outline" size="sm" className="h-8 text-xs" asChild>
                  <a href={`https://${domain.hostname}`} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3 w-3 mr-1" /> Abrir
                  </a>
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Globe className="h-6 w-6 text-primary" />
            Domínios
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie as solicitações de domínio dos tenants
          </p>
        </div>
        {pendingDomains.length > 0 && (
          <Badge className="bg-amber-500 text-white h-7 text-sm px-3 animate-pulse">
            {pendingDomains.length} pendente{pendingDomains.length > 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      {pendingDomains.length > 0 && (
        <Alert className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
          <Rocket className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-700 dark:text-amber-400 text-xs">
            <strong>Lembrete:</strong> Antes de ativar, adicione o domínio em <strong>Project Settings → Domains</strong> no painel da Lovable.
            Após confirmar que está configurado, clique em "Ativar" para notificar o tenant.
          </AlertDescription>
        </Alert>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="pending" className="gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            Pendentes
            {pendingDomains.length > 0 && (
              <span className="ml-1 bg-amber-500 text-white rounded-full px-1.5 text-[10px] font-bold">
                {pendingDomains.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="active" className="gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" />
            Ativos ({activeDomains.length})
          </TabsTrigger>
          <TabsTrigger value="other" className="gap-1.5">
            <Globe className="h-3.5 w-3.5" />
            Outros ({otherDomains.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-3 mt-4">
          {pendingDomains.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground text-sm">
              Nenhuma solicitação pendente 🎉
            </CardContent></Card>
          ) : (
            pendingDomains.map((d: any) => <DomainCard key={d.id} domain={d} showActions />)
          )}
        </TabsContent>

        <TabsContent value="active" className="space-y-3 mt-4">
          {activeDomains.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground text-sm">
              Nenhum domínio ativo ainda.
            </CardContent></Card>
          ) : (
            activeDomains.map((d: any) => <DomainCard key={d.id} domain={d} />)
          )}
        </TabsContent>

        <TabsContent value="other" className="space-y-3 mt-4">
          {otherDomains.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground text-sm">
              Nenhum domínio neste status.
            </CardContent></Card>
          ) : (
            otherDomains.map((d: any) => <DomainCard key={d.id} domain={d} />)
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
