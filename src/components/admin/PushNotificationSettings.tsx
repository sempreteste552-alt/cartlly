import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Bell, Send, Loader2, CheckCircle, XCircle, Smartphone, Users, Megaphone } from "lucide-react";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useAuth } from "@/contexts/AuthContext";
import { useTenantContext } from "@/hooks/useTenantContext";
import { canAccess } from "@/lib/planPermissions";
import { LockedFeature } from "@/components/LockedFeature";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";

export default function PushNotificationSettings() {
  const { user } = useAuth();
  const { ctx } = useTenantContext();
  const { isSupported, isSubscribed, permission, subscribe, unsubscribe, loading } = usePushNotifications();

  const [testTitle, setTestTitle] = useState("🔔 Teste de Notificação");
  const [testBody, setTestBody] = useState("Esta é uma notificação de teste da sua loja!");
  const [testUrl, setTestUrl] = useState("/admin");
  const [sending, setSending] = useState(false);

  const [custTitle, setCustTitle] = useState("🔥 Novidades na loja!");
  const [custBody, setCustBody] = useState("Confira nossas promoções exclusivas!");
  const [custUrl, setCustUrl] = useState("");
  const [sendingCust, setSendingCust] = useState(false);

  const { data: subscriptions } = useQuery({
    queryKey: ["push-subscriptions", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("push_subscriptions")
        .select("id, endpoint, platform, created_at")
        .eq("user_id", user.id);
      return data || [];
    },
    enabled: !!user,
  });

  const { data: customerCount } = useQuery({
    queryKey: ["customer-count", user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { count } = await supabase
        .from("customers")
        .select("id", { count: "exact", head: true })
        .eq("store_user_id", user.id);
      return count || 0;
    },
    enabled: !!user,
  });

  const { data: pushLogs } = useQuery({
    queryKey: ["push-logs", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("push_logs")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);
      return data || [];
    },
    enabled: !!user,
  });

  const handleSendTest = async () => {
    if (!user) return;
    if (!testTitle.trim()) return toast.error("Título é obrigatório");
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-push-internal", {
        body: {
          target_user_id: user.id,
          title: testTitle,
          body: testBody,
          url: testUrl || "/admin",
          type: "admin_message",
        },
      });
      if (error) throw error;
      if (data?.sent > 0) {
        toast.success(`✅ Notificação enviada para ${data.sent} dispositivo(s)!`);
      } else if (data?.removed > 0) {
        toast.warning("Os dispositivos antigos/inválidos foram limpos. Ative o push novamente neste aparelho.");
      } else {
        toast.warning("Nenhum dispositivo válido registrado para receber a notificação.");
      }
    } catch (err: any) {
      toast.error("Erro ao enviar: " + (err.message || "Erro desconhecido"));
    } finally {
      setSending(false);
    }
  };

  const handleSendToCustomers = async () => {
    if (!user) return;
    if (!custTitle.trim()) return toast.error("Título é obrigatório");
    setSendingCust(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-push-customers", {
        body: {
          title: custTitle,
          body: custBody,
          url: custUrl || "/",
        },
      });
      if (error) throw error;

      // Log to tenant_messages for audit trail
      await supabase.from("tenant_messages").insert({
        source_tenant_id: user.id,
        sender_type: "tenant_admin",
        sender_user_id: user.id,
        audience_type: "tenant_admin_to_all_customers",
        target_area: "public_store",
        target_tenant_id: user.id,
        channel: "push",
        title: custTitle.trim(),
        body: custBody || null,
        message_type: "promotion",
        is_global: false,
        delivered_count: data?.sent || 0,
        failed_count: data?.failures || 0,
        status: (data?.sent || 0) > 0 ? "sent" : "failed",
      } as any);

      if ((data?.sent || 0) > 0) {
        toast.success(`📢 Push enviado! ${data?.sent || 0} notificação(ões) entregue(s) para ${data?.customers_with_push || 0} cliente(s).`);
      } else if ((data?.removed || 0) > 0) {
        toast.warning("Foram removidos dispositivos antigos/inválidos dos clientes. Eles precisam ativar o push novamente na loja.");
      } else {
        const msg = data?.message || `Nenhum dos seus ${data?.total_customers || 0} cliente(s) ativou notificações push. Eles precisam clicar no 🔔 dentro da loja para ativar.`;
        toast.warning(msg, { duration: 8000 });
      }
    } catch (err: any) {
      toast.error("Erro ao enviar: " + (err.message || "Erro desconhecido"));
    } finally {
      setSendingCust(false);
    }
  };

  const statusColor = (status: string) => {
    if (status === "sent") return "text-green-500";
    if (status === "failed" || status === "error") return "text-red-500";
    if (status === "expired") return "text-yellow-500";
    return "text-muted-foreground";
  };

  return (
    <div className="space-y-6">
      <Card className="border-border">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Notificações Push</CardTitle>
          </div>
          <CardDescription>Configure e teste notificações push para sua loja</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex items-center gap-3 p-3 rounded-lg border border-border">
              <Smartphone className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Suporte</p>
                <Badge variant={isSupported ? "default" : "secondary"}>
                  {isSupported ? "Suportado" : "Não suportado"}
                </Badge>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg border border-border">
              <Bell className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Permissão</p>
                <Badge variant={permission === "granted" ? "default" : permission === "denied" ? "destructive" : "secondary"}>
                  {permission === "granted" ? "Concedida" : permission === "denied" ? "Negada" : "Pendente"}
                </Badge>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg border border-border">
              <Users className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Dispositivos</p>
                <Badge variant="outline">{subscriptions?.length || 0} registrado(s)</Badge>
              </div>
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">Este dispositivo</p>
              <p className="text-xs text-muted-foreground">
                {isSubscribed ? "Inscrito para receber notificações" : "Não inscrito"}
              </p>
            </div>
            <Button
              variant={isSubscribed ? "outline" : "default"}
              size="sm"
              onClick={isSubscribed ? unsubscribe : subscribe}
              disabled={loading || !isSupported}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {isSubscribed ? "Desativar" : "Ativar Push"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Enviar Teste (Meus Dispositivos)</CardTitle>
          </div>
          <CardDescription>Envie uma notificação de teste para seus próprios dispositivos</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Título</Label>
            <Input value={testTitle} onChange={(e) => setTestTitle(e.target.value)} placeholder="Título da notificação" maxLength={100} />
          </div>
          <div className="space-y-2">
            <Label>Mensagem</Label>
            <Textarea value={testBody} onChange={(e) => setTestBody(e.target.value)} placeholder="Corpo da notificação..." rows={2} maxLength={500} />
          </div>
          <div className="space-y-2">
            <Label>URL ao clicar</Label>
            <Input value={testUrl} onChange={(e) => setTestUrl(e.target.value)} placeholder="/admin" />
          </div>
          <div className="rounded-lg border border-border p-3 bg-muted/30">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                <Bell className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm truncate">{testTitle || "Título"}</p>
                <p className="text-xs text-muted-foreground line-clamp-2">{testBody || "Mensagem..."}</p>
              </div>
            </div>
          </div>
          <Button className="w-full" onClick={handleSendTest} disabled={sending || !testTitle.trim()}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
            Enviar Teste
          </Button>
        </CardContent>
      </Card>

      <LockedFeature isLocked={!canAccess("push_customers", ctx)} featureName="Push para Clientes">
        <Card className="border-border border-primary/30">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Enviar Push para Clientes</CardTitle>
              <Badge variant="outline" className="text-xs ml-auto">PRO</Badge>
            </div>
            <CardDescription>
              Envie notificações push para todos os clientes que instalaram o app da sua loja.
              {customerCount != null && (
                <span className="font-medium"> ({customerCount} clientes cadastrados)</span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Título</Label>
              <Input value={custTitle} onChange={(e) => setCustTitle(e.target.value)} placeholder="🔥 Super promoção!" maxLength={100} />
            </div>
            <div className="space-y-2">
              <Label>Mensagem</Label>
              <Textarea value={custBody} onChange={(e) => setCustBody(e.target.value)} placeholder="Confira as novidades da nossa loja..." rows={3} maxLength={500} />
            </div>
            <div className="space-y-2">
              <Label>URL ao clicar (opcional)</Label>
              <Input value={custUrl} onChange={(e) => setCustUrl(e.target.value)} placeholder="Deixe vazio para ir à home da loja" />
            </div>

            <div className="rounded-lg border border-border p-3 bg-muted/30">
              <p className="text-xs text-muted-foreground mb-2">Preview da notificação</p>
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                  <Megaphone className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">{custTitle || "Título"}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">{custBody || "Mensagem..."}</p>
                </div>
              </div>
            </div>

            <Button className="w-full" onClick={handleSendToCustomers} disabled={sendingCust || !custTitle.trim()}>
              {sendingCust ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Megaphone className="h-4 w-4 mr-2" />}
              Enviar para Todos os Clientes
            </Button>
          </CardContent>
        </Card>
      </LockedFeature>

      {pushLogs && pushLogs.length > 0 && (
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-lg">Histórico de Envios</CardTitle>
            <CardDescription>Últimas 10 notificações enviadas</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pushLogs.map((log: any) => (
                <div key={log.id} className="flex items-center gap-3 p-2 rounded-lg border border-border text-sm">
                  {log.status === "sent" ? (
                    <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{log.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{log.body}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <Badge variant="outline" className={`text-[10px] ${statusColor(log.status)}`}>
                      {log.status}
                    </Badge>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {new Date(log.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
