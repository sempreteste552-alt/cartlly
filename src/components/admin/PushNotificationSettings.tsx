import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Bell, Send, Loader2, CheckCircle, XCircle, Smartphone, Users } from "lucide-react";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";

export default function PushNotificationSettings() {
  const { user } = useAuth();
  const { isSupported, isSubscribed, permission, subscribe, unsubscribe, loading } = usePushNotifications();

  const [testTitle, setTestTitle] = useState("🔔 Teste de Notificação");
  const [testBody, setTestBody] = useState("Esta é uma notificação de teste da sua loja!");
  const [testUrl, setTestUrl] = useState("/admin");
  const [sending, setSending] = useState(false);

  // Fetch push subscriptions count
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

  // Fetch push logs
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
      } else {
        toast.warning("Nenhum dispositivo registrado para receber a notificação.");
      }
    } catch (err: any) {
      toast.error("Erro ao enviar: " + (err.message || "Erro desconhecido"));
    } finally {
      setSending(false);
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
      {/* Status Card */}
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

      {/* Test Push */}
      <Card className="border-border">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Enviar Teste</CardTitle>
          </div>
          <CardDescription>Envie uma notificação de teste para seus dispositivos</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Título</Label>
            <Input
              value={testTitle}
              onChange={(e) => setTestTitle(e.target.value)}
              placeholder="Título da notificação"
              maxLength={100}
            />
          </div>
          <div className="space-y-2">
            <Label>Mensagem</Label>
            <Textarea
              value={testBody}
              onChange={(e) => setTestBody(e.target.value)}
              placeholder="Corpo da notificação..."
              rows={3}
              maxLength={500}
            />
          </div>
          <div className="space-y-2">
            <Label>URL ao clicar (opcional)</Label>
            <Input
              value={testUrl}
              onChange={(e) => setTestUrl(e.target.value)}
              placeholder="/admin"
            />
          </div>

          {/* Preview */}
          <div className="rounded-lg border border-border p-4 bg-muted/30">
            <p className="text-xs text-muted-foreground mb-2">Preview</p>
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

          <Button
            className="w-full"
            onClick={handleSendTest}
            disabled={sending || !testTitle.trim()}
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
            Enviar Notificação de Teste
          </Button>
        </CardContent>
      </Card>

      {/* Push Logs */}
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
