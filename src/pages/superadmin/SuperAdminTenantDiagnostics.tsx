import { useState } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ArrowLeft, Activity, AlertCircle, CreditCard, ShoppingCart, Mail,
  Wrench, Database, LogIn, Loader2, RefreshCw, Globe, BellOff, Unlock,
  ClipboardCheck, CheckCircle2, XCircle, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useEffect } from "react";

const REPAIR_TOOLS = [
  { id: "resync_subscription", label: "Ressincronizar assinatura", icon: RefreshCw, desc: "Estende o ciclo atual em 30 dias e marca como ativa" },
  { id: "reset_domain_token", label: "Resetar tokens de domínio", icon: Globe, desc: "Limpa verification_token e volta status para pending_dns" },
  { id: "clear_push_subscriptions", label: "Limpar inscrições push", icon: BellOff, desc: "Remove todas as subscriptions push para forçar reinscrição" },
  { id: "unblock_all", label: "Desbloquear tudo", icon: Unlock, desc: "Profile + loja + painel ficam ativos" },
];

const SQL_PRESETS = [
  { id: "recent_orders", label: "Pedidos recentes" },
  { id: "refused_payments", label: "Pagamentos recusados" },
  { id: "low_stock_products", label: "Produtos com estoque baixo" },
  { id: "abandoned_carts", label: "Carrinhos abandonados (30d)" },
  { id: "recent_customers", label: "Clientes recentes" },
];

export default function SuperAdminTenantDiagnostics() {
  const { userId } = useParams<{ userId: string }>();
  const [searchParams] = useSearchParams();
  const autoTest = searchParams.get("autoTest") === "true";
  const [activeTab, setActiveTab] = useState(autoTest ? "integrity" : "logs");
  const [running, setRunning] = useState<string | null>(null);
  const [presetData, setPresetData] = useState<any[] | null>(null);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [integrityResults, setIntegrityResults] = useState<any[] | null>(null);
  const [testingIntegrity, setTestingIntegrity] = useState(false);

  const runIntegrityTest = async () => {
    setTestingIntegrity(true);
    setIntegrityResults(null);
    try {
      const { data, error } = await supabase.functions.invoke("admin-tenant-actions", {
        body: { action: "test_tenant_integrity", targetUserId: userId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setIntegrityResults(data.results || []);
      toast.success("Teste de integridade concluído");
    } catch (e: any) {
      toast.error(e.message || "Falha no teste");
    } finally {
      setTestingIntegrity(false);
    }
  };

  useEffect(() => {
    if (autoTest && userId) {
      runIntegrityTest();
    }
  }, [autoTest, userId]);

  const { data: tenant, isLoading: loadingTenant } = useQuery({
    queryKey: ["sa_tenant", userId],
    queryFn: async () => {
      if (!userId) return null;
      const [profile, store] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
        supabase.from("store_settings").select("*").eq("user_id", userId).maybeSingle(),
      ]);
      return { profile: profile.data, store: store.data };
    },
    enabled: !!userId,
  });

  const { data: logs, isLoading: loadingLogs, refetch: refetchLogs } = useQuery({
    queryKey: ["sa_tenant_logs", userId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin-tenant-actions", {
        body: { action: "get_tenant_logs", targetUserId: userId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    enabled: !!userId,
  });

  const runRepair = async (tool: string) => {
    setRunning(tool);
    try {
      const { data, error } = await supabase.functions.invoke("admin-tenant-actions", {
        body: { action: "repair", tool, targetUserId: userId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(data.message || "Concluído");
      refetchLogs();
    } catch (e: any) {
      toast.error(e.message || "Falha no reparo");
    } finally {
      setRunning(null);
    }
  };

  const runPreset = async (preset: string) => {
    setActivePreset(preset);
    setPresetData(null);
    try {
      const { data, error } = await supabase.functions.invoke("admin-tenant-actions", {
        body: { action: "preset_query", preset, targetUserId: userId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setPresetData(data.data || []);
    } catch (e: any) {
      toast.error(e.message || "Falha na consulta");
    }
  };

  const impersonate = async () => {
    setRunning("impersonate");
    try {
      const { data, error } = await supabase.functions.invoke("admin-tenant-actions", {
        body: { action: "impersonate", targetUserId: userId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data.action_link) {
        window.open(data.action_link, "_blank");
        toast.success("Link de impersonate aberto em nova aba");
      }
    } catch (e: any) {
      toast.error(e.message || "Falha");
    } finally {
      setRunning(null);
    }
  };

  if (loadingTenant) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild><Link to="/superadmin/tenants"><ArrowLeft className="h-4 w-4" /></Link></Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Diagnóstico</h1>
          <p className="text-sm text-muted-foreground">{tenant?.profile?.display_name} • {tenant?.store?.store_name || "—"}</p>
        </div>
        <Button onClick={impersonate} disabled={running === "impersonate"} variant="outline">
          {running === "impersonate" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}
          Login como tenant
        </Button>
      </div>

      <Tabs defaultValue="logs">
        <TabsList>
          <TabsTrigger value="logs"><Activity className="mr-1 h-3.5 w-3.5" />Logs</TabsTrigger>
          <TabsTrigger value="repair"><Wrench className="mr-1 h-3.5 w-3.5" />Reparo</TabsTrigger>
          <TabsTrigger value="sql"><Database className="mr-1 h-3.5 w-3.5" />Console</TabsTrigger>
          <TabsTrigger value="integrity"><ClipboardCheck className="mr-1 h-3.5 w-3.5" />Integridade</TabsTrigger>
        </TabsList>

        {/* LOGS */}
        <TabsContent value="logs" className="space-y-4 mt-4">
          {loadingLogs ? <Skeleton className="h-40" /> : (
            <>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><CreditCard className="h-4 w-4" />Pagamentos recusados/falhos (7d)</CardTitle></CardHeader>
                <CardContent>
                  {!logs?.payment_failures?.length ? <p className="text-xs text-muted-foreground">Nenhum</p> : (
                    <div className="space-y-1 text-xs">
                      {logs.payment_failures.map((p: any) => (
                        <div key={p.id} className="flex gap-2 py-1 border-b border-border/40">
                          <Badge variant="destructive" className="text-[10px]">{p.status}</Badge>
                          <span className="font-mono">R$ {Number(p.amount).toFixed(2)}</span>
                          <span className="text-muted-foreground">{p.gateway}/{p.method}</span>
                          <span className="flex-1 text-muted-foreground truncate">{p.status_detail || "—"}</span>
                          <span className="text-muted-foreground">{new Date(p.created_at).toLocaleString("pt-BR")}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><AlertCircle className="h-4 w-4" />Push (7d)</CardTitle></CardHeader>
                <CardContent>
                  {!logs?.push?.length ? <p className="text-xs text-muted-foreground">Nenhum</p> : (
                    <div className="space-y-1 text-xs max-h-64 overflow-auto">
                      {logs.push.map((p: any) => (
                        <div key={p.id} className="flex gap-2 py-1 border-b border-border/40">
                          <Badge variant={p.status === "sent" ? "default" : "destructive"} className="text-[10px]">{p.status}</Badge>
                          <span className="flex-1 truncate">{p.title}</span>
                          {p.error_message && <span className="text-destructive truncate max-w-[200px]" title={p.error_message}>{p.error_message}</span>}
                          <span className="text-muted-foreground">{new Date(p.created_at).toLocaleString("pt-BR")}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><ShoppingCart className="h-4 w-4" />Pedidos cancelados (7d)</CardTitle></CardHeader>
                <CardContent>
                  {!logs?.cancelled_orders?.length ? <p className="text-xs text-muted-foreground">Nenhum</p> : (
                    <div className="space-y-1 text-xs">
                      {logs.cancelled_orders.map((o: any) => (
                        <div key={o.id} className="flex gap-2 py-1 border-b border-border/40">
                          <Badge variant="outline" className="text-[10px]">{o.status}</Badge>
                          <span className="flex-1 truncate">{o.customer_name}</span>
                          <span className="font-mono">R$ {Number(o.total).toFixed(2)}</span>
                          <span className="text-muted-foreground">{new Date(o.created_at).toLocaleString("pt-BR")}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Mail className="h-4 w-4" />Emails ao tenant (7d)</CardTitle></CardHeader>
                <CardContent>
                  {!logs?.emails?.length ? <p className="text-xs text-muted-foreground">Nenhum</p> : (
                    <div className="space-y-1 text-xs max-h-64 overflow-auto">
                      {logs.emails.map((e: any) => (
                        <div key={e.id} className="flex gap-2 py-1 border-b border-border/40">
                          <Badge variant={e.status === "sent" ? "default" : "destructive"} className="text-[10px]">{e.status}</Badge>
                          <span className="flex-1 truncate">{e.template_name}</span>
                          <span className="text-muted-foreground">{new Date(e.created_at).toLocaleString("pt-BR")}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* REPAIR */}
        <TabsContent value="repair" className="space-y-3 mt-4">
          <Alert>
            <AlertDescription className="text-xs">Cada ferramenta é registrada na auditoria. Use somente quando o tenant pedir suporte ou houver erro confirmado.</AlertDescription>
          </Alert>
          <div className="grid sm:grid-cols-2 gap-3">
            {REPAIR_TOOLS.map((t) => {
              const I = t.icon;
              return (
                <Card key={t.id}>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <I className="h-4 w-4 text-primary" />
                      <p className="font-medium text-sm">{t.label}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">{t.desc}</p>
                    <Button size="sm" variant="outline" className="w-full" onClick={() => runRepair(t.id)} disabled={!!running}>
                      {running === t.id ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Wrench className="mr-2 h-3.5 w-3.5" />}
                      Executar
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* SQL Console */}
        <TabsContent value="sql" className="space-y-3 mt-4">
          <Alert>
            <AlertDescription className="text-xs">Queries pré-aprovadas, somente leitura. Sem SQL livre por segurança.</AlertDescription>
          </Alert>
          <div className="flex flex-wrap gap-2">
            {SQL_PRESETS.map((p) => (
              <Button key={p.id} size="sm" variant={activePreset === p.id ? "default" : "outline"} onClick={() => runPreset(p.id)}>
                {p.label}
              </Button>
            ))}
          </div>
          {presetData && (
            <Card>
              <CardContent className="p-3 max-h-[500px] overflow-auto">
                {presetData.length === 0 ? (
                  <p className="text-xs text-muted-foreground p-4 text-center">Nenhum resultado</p>
                ) : (
                  <pre className="text-[11px] font-mono whitespace-pre-wrap">{JSON.stringify(presetData, null, 2)}</pre>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
        {/* Integrity Test */}
        <TabsContent value="integrity" className="space-y-4 mt-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">Verificação de Integridade</h3>
            <Button 
              onClick={runIntegrityTest} 
              disabled={testingIntegrity}
              className="gap-2"
            >
              {testingIntegrity ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
              Testar Tenant
            </Button>
          </div>

          {integrityResults && (
            <div className="grid gap-3">
              {integrityResults.map((r, i) => (
                <Card key={i} className={cn(
                  "border-l-4",
                  r.status === "ok" ? "border-l-green-500" : r.status === "warn" ? "border-l-amber-500" : "border-l-red-500"
                )}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {r.status === "ok" ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : r.status === "warn" ? (
                        <AlertTriangle className="h-5 w-5 text-amber-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500" />
                      )}
                      <div>
                        <p className="font-semibold">{r.check}</p>
                        <p className="text-sm text-muted-foreground">{r.message}</p>
                      </div>
                    </div>
                    <Badge variant={r.status === "ok" ? "default" : r.status === "warn" ? "secondary" : "destructive"}>
                      {r.status.toUpperCase()}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

