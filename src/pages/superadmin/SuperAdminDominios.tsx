import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Globe, CheckCircle, XCircle, Clock, ExternalLink, ShieldCheck,
  Loader2, RefreshCw, Store, User, Rocket, Plus, Trash2,
  AlertTriangle, ShieldAlert, Activity, Search, Zap,
} from "lucide-react";
import { toast } from "sonner";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";

const PLATFORM_IP = "185.158.133.1";

export default function SuperAdminDominios() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [tab, setTab] = useState("pending");
  const [search, setSearch] = useState("");

  // Add domain dialog state
  const [addOpen, setAddOpen] = useState(false);
  const [newHostname, setNewHostname] = useState("");
  const [newStoreId, setNewStoreId] = useState("");
  const [newPrimary, setNewPrimary] = useState(true);
  const [adding, setAdding] = useState(false);

  useRealtimeSync("store_domains", [["sa_all_domains"]]);

  const { data: domains, isLoading } = useQuery({
    queryKey: ["sa_all_domains"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_domains")
        .select("*")
        .order("created_at", { ascending: false });
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

  // ----- Smart alerts -----
  const alerts = useMemo(() => {
    if (!domains) return [] as Array<{ id: string; level: "danger" | "warn"; msg: string; domain: any }>;
    const out: Array<{ id: string; level: "danger" | "warn"; msg: string; domain: any }> = [];
    const now = Date.now();
    domains.forEach((d: any) => {
      // SSL failed
      if (d.last_ssl_error) {
        out.push({ id: `ssl-${d.id}`, level: "danger", msg: `SSL com erro em ${d.hostname}: ${d.last_ssl_error}`, domain: d });
      }
      // Active sem verificação há mais de 7 dias
      if (d.status === "active" && d.last_verified_at) {
        const days = (now - new Date(d.last_verified_at).getTime()) / 86400000;
        if (days > 7) {
          out.push({ id: `stale-${d.id}`, level: "warn", msg: `${d.hostname} sem reverificação há ${Math.floor(days)} dias`, domain: d });
        }
      }
      // Pendente DNS há mais de 72h
      if (d.status === "pending_dns" && d.created_at) {
        const hrs = (now - new Date(d.created_at).getTime()) / 3600000;
        if (hrs > 72) {
          out.push({ id: `slow-${d.id}`, level: "warn", msg: `${d.hostname} pendente há mais de 72h. Verifique com o lojista.`, domain: d });
        }
      }
      // Failed
      if (d.status === "failed") {
        out.push({ id: `fail-${d.id}`, level: "danger", msg: `${d.hostname} falhou. Requer intervenção manual.`, domain: d });
      }
      // Conflicting records
      if (Array.isArray(d.conflicting_records) && d.conflicting_records.length > 0) {
        out.push({ id: `conflict-${d.id}`, level: "warn", msg: `${d.hostname} tem ${d.conflicting_records.length} registro(s) DNS conflitante(s)`, domain: d });
      }
    });
    return out;
  }, [domains]);

  const filtered = useMemo(() => {
    if (!domains) return [];
    if (!search.trim()) return domains;
    const q = search.toLowerCase();
    return domains.filter((d: any) => {
      const info = getStoreInfo(d.store_id);
      return (
        d.hostname?.toLowerCase().includes(q) ||
        info.store_name.toLowerCase().includes(q) ||
        info.store_slug.toLowerCase().includes(q) ||
        info.owner_name.toLowerCase().includes(q)
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domains, search, stores, profiles]);

  const pendingDomains = filtered.filter((d: any) => d.status === "pending_activation");
  const activeDomains = filtered.filter((d: any) => d.status === "active");
  const failedDomains = filtered.filter((d: any) => d.status === "failed");
  const otherDomains = filtered.filter((d: any) => !["pending_activation", "active", "failed"].includes(d.status));

  // KPIs
  const kpis = useMemo(() => {
    const total = domains?.length || 0;
    const active = domains?.filter((d: any) => d.status === "active").length || 0;
    const pending = domains?.filter((d: any) => d.status === "pending_activation").length || 0;
    const failed = domains?.filter((d: any) => d.status === "failed").length || 0;
    const broken = alerts.filter((a) => a.level === "danger").length;
    return { total, active, pending, failed, broken };
  }, [domains, alerts]);

  const handleApprove = async (domain: any) => {
    setProcessingId(domain.id);
    try {
      const storeInfo = getStoreInfo(domain.store_id);
      const { error } = await supabase.from("store_domains").update({
        status: "active",
        ssl_status: "active",
        dns_status: "propagated",
        is_published: true,
        activated_by: user?.id,
        activated_at: new Date().toISOString(),
        last_verified_at: new Date().toISOString(),
      }).eq("id", domain.id);
      if (error) throw error;

      if (domain.is_primary) {
        await supabase.from("store_settings").update({
          custom_domain: domain.hostname,
          domain_status: "verified",
        } as any).eq("id", domain.store_id);
      }

      if (storeInfo.user_id) {
        await supabase.from("admin_notifications").insert({
          sender_user_id: "system",
          target_user_id: storeInfo.user_id,
          title: "🎉 Domínio Ativado!",
          message: `Seu domínio ${domain.hostname} está ativo! Acesse https://${domain.hostname}`,
          type: "info",
        });

        try {
          await supabase.functions.invoke("send-push-internal", {
            body: {
              target_user_id: storeInfo.user_id,
              title: "🚀 Domínio No Ar!",
              body: `Seu site ${domain.hostname} está online!`,
              url: `https://${domain.hostname}`,
              target_area: "admin",
            },
          });
        } catch (pushErr) {
          console.warn("Push notification failed:", pushErr);
        }
      }

      toast.success(`Domínio ${domain.hostname} ativado!`);
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
          message: `A ativação do domínio ${domain.hostname} foi recusada. Verifique o DNS.`,
          type: "alert",
        });
      }

      toast.success("Solicitação rejeitada.");
      queryClient.invalidateQueries({ queryKey: ["sa_all_domains"] });
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
      const dnsOk = data?.dns?.cname?.correct ?? data?.dns?.a?.correct;
      toast.info(`DNS: ${dnsOk ? "✅ OK" : "❌ Pendente"} | SSL: ${data?.ssl?.ready ? "✅" : "⏳"}`);
      queryClient.invalidateQueries({ queryKey: ["sa_all_domains"] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao verificar");
    } finally {
      setProcessingId(null);
    }
  };

  const handleForceActivate = async (domain: any) => {
    await handleApprove(domain);
  };

  const handleDelete = async (domain: any) => {
    setProcessingId(domain.id);
    try {
      const { error } = await supabase.from("store_domains").delete().eq("id", domain.id);
      if (error) throw error;

      // Limpa custom_domain do store_settings se for o mesmo
      await supabase.from("store_settings").update({
        custom_domain: null,
        domain_status: "none",
      } as any).eq("id", domain.store_id).eq("custom_domain", domain.hostname);

      toast.success(`Domínio ${domain.hostname} removido.`);
      queryClient.invalidateQueries({ queryKey: ["sa_all_domains"] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao remover");
    } finally {
      setProcessingId(null);
    }
  };

  const handleAddDomain = async () => {
    const host = newHostname.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (!host || !newStoreId) {
      toast.error("Preencha hostname e selecione a loja.");
      return;
    }
    setAdding(true);
    try {
      const token = `lovable_verify_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
      const { error } = await supabase.from("store_domains").insert({
        hostname: host,
        store_id: newStoreId,
        is_primary: newPrimary,
        status: "pending_dns",
        verification_token: token,
      });
      if (error) throw error;

      if (newPrimary) {
        await supabase.from("store_settings").update({
          custom_domain: host,
          domain_status: "pending_dns",
        } as any).eq("id", newStoreId);
      }

      toast.success(`Domínio ${host} cadastrado!`);
      setAddOpen(false);
      setNewHostname("");
      setNewStoreId("");
      setNewPrimary(true);
      queryClient.invalidateQueries({ queryKey: ["sa_all_domains"] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao adicionar");
    } finally {
      setAdding(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active": return <Badge className="bg-green-500 text-white text-[10px]">✅ Ativo</Badge>;
      case "pending_activation": return <Badge className="bg-amber-500 text-white text-[10px] animate-pulse">🔔 Aguardando</Badge>;
      case "pending_dns": return <Badge variant="outline" className="text-[10px]">⏳ DNS</Badge>;
      case "pending_ssl": return <Badge variant="secondary" className="text-[10px]">🔒 SSL</Badge>;
      case "pending_verification": return <Badge variant="secondary" className="text-[10px]">🔍 Verificando</Badge>;
      case "failed": return <Badge variant="destructive" className="text-[10px]">❌ Falhou</Badge>;
      default: return <Badge variant="outline" className="text-[10px]">{status}</Badge>;
    }
  };

  const DomainCard = ({ domain, showActions = false }: { domain: any; showActions?: boolean }) => {
    const info = getStoreInfo(domain.store_id);
    const isProcessing = processingId === domain.id;
    const lastVerifiedDays = domain.last_verified_at
      ? Math.floor((Date.now() - new Date(domain.last_verified_at).getTime()) / 86400000)
      : null;

    return (
      <Card className="border-border">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <div className="p-2 rounded-lg bg-primary/10 mt-0.5 shrink-0">
                <Globe className="h-4 w-4 text-primary" />
              </div>
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-sm truncate">{domain.hostname}</span>
                  {domain.is_primary && <Badge className="text-[9px] h-4 bg-primary/20 text-primary border-none">Principal</Badge>}
                  {getStatusBadge(domain.status)}
                  {domain.ssl_status === "active" && <Badge variant="outline" className="text-[9px] h-4">🔒 SSL</Badge>}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1"><Store className="h-3 w-3" /> {info.store_name}</span>
                  <span className="flex items-center gap-1"><User className="h-3 w-3" /> {info.owner_name}</span>
                  {info.store_slug && <span className="text-[10px]">/{info.store_slug}</span>}
                </div>
                <div className="flex items-center gap-3 flex-wrap text-[10px] text-muted-foreground">
                  {domain.detected_provider && <span>DNS: {domain.detected_provider}</span>}
                  {domain.activation_requested_at && (
                    <span>Solicitado: {new Date(domain.activation_requested_at).toLocaleString("pt-BR")}</span>
                  )}
                  {domain.last_verified_at && (
                    <span>Última verificação: {lastVerifiedDays === 0 ? "hoje" : `${lastVerifiedDays}d atrás`}</span>
                  )}
                  {domain.last_ssl_error && (
                    <span className="text-destructive">⚠️ SSL: {domain.last_ssl_error}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap shrink-0">
              <Button variant="ghost" size="sm" className="h-8 text-xs"
                onClick={() => handleVerifyDns(domain)} disabled={isProcessing}>
                {isProcessing ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                Verificar
              </Button>

              {showActions && (
                <>
                  <Button size="sm" className="h-8 text-xs bg-green-600 hover:bg-green-700"
                    onClick={() => handleApprove(domain)} disabled={isProcessing}>
                    <CheckCircle className="h-3 w-3 mr-1" /> Ativar
                  </Button>
                  <Button variant="destructive" size="sm" className="h-8 text-xs"
                    onClick={() => handleReject(domain)} disabled={isProcessing}>
                    <XCircle className="h-3 w-3 mr-1" /> Recusar
                  </Button>
                </>
              )}

              {domain.status !== "active" && !showActions && (
                <Button variant="outline" size="sm" className="h-8 text-xs"
                  onClick={() => handleForceActivate(domain)} disabled={isProcessing}>
                  <Zap className="h-3 w-3 mr-1" /> Forçar Ativação
                </Button>
              )}

              {domain.status === "active" && (
                <Button variant="outline" size="sm" className="h-8 text-xs" asChild>
                  <a href={`https://${domain.hostname}`} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3 w-3 mr-1" /> Abrir
                  </a>
                </Button>
              )}

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir domínio?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Tem certeza que deseja remover <strong>{domain.hostname}</strong>?
                      Esta ação não pode ser desfeita e o lojista perderá o acesso pelo domínio próprio.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleDelete(domain)} className="bg-destructive">
                      Excluir
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Globe className="h-6 w-6 text-primary" />
            Domínios
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie todos os domínios personalizados da plataforma
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-9">
                <Plus className="h-4 w-4 mr-1.5" />
                Adicionar Domínio
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adicionar domínio manualmente</DialogTitle>
                <DialogDescription>
                  Vincule um domínio diretamente a uma loja. O DNS deve apontar para <code className="text-primary">{PLATFORM_IP}</code>.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <div className="space-y-1.5">
                  <Label htmlFor="hostname">Hostname</Label>
                  <Input
                    id="hostname"
                    placeholder="exemplo.com.br"
                    value={newHostname}
                    onChange={(e) => setNewHostname(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="store">Loja</Label>
                  <Select value={newStoreId} onValueChange={setNewStoreId}>
                    <SelectTrigger id="store">
                      <SelectValue placeholder="Selecione a loja..." />
                    </SelectTrigger>
                    <SelectContent>
                      {stores?.map((s: any) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.store_name} {s.store_slug ? `(/${s.store_slug})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newPrimary}
                    onChange={(e) => setNewPrimary(e.target.checked)}
                    className="h-4 w-4"
                  />
                  Definir como domínio principal da loja
                </label>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddOpen(false)}>Cancelar</Button>
                <Button onClick={handleAddDomain} disabled={adding}>
                  {adding ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                  Adicionar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><CardContent className="p-3">
          <div className="flex items-center gap-2"><Globe className="h-4 w-4 text-muted-foreground" /><span className="text-xs text-muted-foreground">Total</span></div>
          <div className="text-2xl font-bold mt-1">{kpis.total}</div>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" /><span className="text-xs text-muted-foreground">Ativos</span></div>
          <div className="text-2xl font-bold mt-1 text-green-500">{kpis.active}</div>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-amber-500" /><span className="text-xs text-muted-foreground">Pendentes</span></div>
          <div className="text-2xl font-bold mt-1 text-amber-500">{kpis.pending}</div>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="flex items-center gap-2"><XCircle className="h-4 w-4 text-destructive" /><span className="text-xs text-muted-foreground">Falhas</span></div>
          <div className="text-2xl font-bold mt-1 text-destructive">{kpis.failed}</div>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-orange-500" /><span className="text-xs text-muted-foreground">Alertas</span></div>
          <div className="text-2xl font-bold mt-1 text-orange-500">{alerts.length}</div>
        </CardContent></Card>
      </div>

      {/* Smart alerts */}
      {alerts.length > 0 && (
        <Card className="border-orange-200 dark:border-orange-900/50 bg-orange-50/50 dark:bg-orange-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              Alertas inteligentes ({alerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 max-h-48 overflow-y-auto">
            {alerts.slice(0, 10).map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-2 text-xs p-2 rounded-md bg-background/60">
                <div className="flex items-center gap-2 min-w-0">
                  {a.level === "danger"
                    ? <ShieldAlert className="h-3.5 w-3.5 text-destructive shrink-0" />
                    : <AlertTriangle className="h-3.5 w-3.5 text-orange-500 shrink-0" />}
                  <span className="truncate">{a.msg}</span>
                </div>
                <Button variant="ghost" size="sm" className="h-6 text-[10px] shrink-0"
                  onClick={() => handleVerifyDns(a.domain)}>
                  Verificar
                </Button>
              </div>
            ))}
            {alerts.length > 10 && (
              <p className="text-[10px] text-muted-foreground text-center pt-1">
                +{alerts.length - 10} alertas adicionais
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {pendingDomains.length > 0 && (
        <Alert className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
          <Rocket className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-700 dark:text-amber-400 text-xs">
            <strong>Lembrete:</strong> Antes de ativar, adicione o domínio em <strong>Project Settings → Domains</strong>.
            Após confirmar, clique em "Ativar" para notificar o tenant.
          </AlertDescription>
        </Alert>
      )}

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por domínio, loja ou dono..."
          className="pl-9 h-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
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
          <TabsTrigger value="failed" className="gap-1.5">
            <XCircle className="h-3.5 w-3.5" />
            Falhas ({failedDomains.length})
          </TabsTrigger>
          <TabsTrigger value="other" className="gap-1.5">
            <Activity className="h-3.5 w-3.5" />
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

        <TabsContent value="failed" className="space-y-3 mt-4">
          {failedDomains.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground text-sm">
              Nenhuma falha registrada.
            </CardContent></Card>
          ) : (
            failedDomains.map((d: any) => <DomainCard key={d.id} domain={d} />)
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
