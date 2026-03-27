import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAllTenants } from "@/hooks/useUserRole";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell, Send, Plus, Users, User, Megaphone, AlertTriangle, Info, Tag, Trash2, Loader2, BellRing, BellOff } from "lucide-react";
import { toast } from "sonner";

const typeConfig: Record<string, { label: string; icon: any; color: string }> = {
  info: { label: "Informação", icon: Info, color: "bg-blue-500" },
  warning: { label: "Aviso", icon: AlertTriangle, color: "bg-yellow-500" },
  alert: { label: "Alerta", icon: Bell, color: "bg-red-500" },
  promo: { label: "Promoção", icon: Tag, color: "bg-green-500" },
};

export default function SuperAdminNotificacoes() {
  const { user } = useAuth();
  const { data: tenants } = useAllTenants();
  const queryClient = useQueryClient();
  const { isSupported, isSubscribed, subscribe, unsubscribe, loading: pushLoading } = usePushNotifications();

  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState("info");
  const [targetUserId, setTargetUserId] = useState("all");
  const [sending, setSending] = useState(false);
  const [testingPush, setTestingPush] = useState(false);

  const handleTestPush = async () => {
    if (!user) return;
    setTestingPush(true);
    try {
      if (!isSubscribed && isSupported) {
        await subscribe();
        await new Promise(r => setTimeout(r, 1500));
      }

      const { data, error } = await supabase.functions.invoke("send-push", {
        body: {
          title: "🔔 Teste Push — Super Admin",
          body: "Se você está vendo isso, as notificações push do Super Admin estão funcionando!",
          url: "/superadmin/notificacoes",
          targetUserId: user.id,
        },
      });
      if (error) throw error;
      if (data?.sent > 0) {
        toast.success("✅ Push enviado! Verifique seu dispositivo.");
      } else {
        toast.error("Não foi possível enviar. Verifique se permitiu notificações no navegador.");
      }
    } catch (err: any) {
      toast.error("Erro ao testar push: " + (err.message || "Erro"));
    } finally {
      setTestingPush(false);
    }
  };

  const { data: notifications, isLoading } = useQuery({
    queryKey: ["admin_notifications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) {
      toast.error("Preencha título e mensagem");
      return;
    }
    setSending(true);
    try {
      if (targetUserId === "all") {
        // Broadcast: create one notification per tenant
        const tenantIds = tenants?.map(t => t.user_id) || [];
        if (tenantIds.length === 0) {
          // If no tenants, create broadcast with null target
          const { error } = await supabase.from("admin_notifications").insert({
            sender_user_id: user!.id,
            target_user_id: null,
            title: title.trim(),
            message: message.trim(),
            type,
          } as any);
          if (error) throw error;
        } else {
          const rows = tenantIds.map(tid => ({
            sender_user_id: user!.id,
            target_user_id: tid,
            title: title.trim(),
            message: message.trim(),
            type,
          }));
          const { error } = await supabase.from("admin_notifications").insert(rows as any);
          if (error) throw error;
        }
      } else {
        const { error } = await supabase.from("admin_notifications").insert({
          sender_user_id: user!.id,
          target_user_id: targetUserId,
          title: title.trim(),
          message: message.trim(),
          type,
        } as any);
        if (error) throw error;
      }

      toast.success("Notificação enviada!");
      queryClient.invalidateQueries({ queryKey: ["admin_notifications"] });
      setFormOpen(false);
      setTitle(""); setMessage(""); setType("info"); setTargetUserId("all");
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("admin_notifications").delete().eq("id", id);
    if (error) toast.error("Erro: " + error.message);
    else {
      toast.success("Notificação removida");
      queryClient.invalidateQueries({ queryKey: ["admin_notifications"] });
    }
  };

  const getTenantName = (userId: string | null) => {
    if (!userId) return "Todos";
    const t = tenants?.find(t => t.user_id === userId);
    return t?.display_name || t?.store?.store_name || "Desconhecido";
  };

  if (isLoading) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Notificações</h1>
          <p className="text-muted-foreground">Envie mensagens e avisos para tenants</p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Nova Notificação
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        <Card className="border-border">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{notifications?.length || 0}</p>
            <p className="text-xs text-muted-foreground">Total enviadas</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{notifications?.filter(n => !(n as any).read).length || 0}</p>
            <p className="text-xs text-muted-foreground">Não lidas</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{notifications?.filter(n => (n as any).read).length || 0}</p>
            <p className="text-xs text-muted-foreground">Lidas</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{tenants?.length || 0}</p>
            <p className="text-xs text-muted-foreground">Tenants</p>
          </CardContent>
        </Card>
      </div>

      {/* Push Notifications Control */}
      <Card className="border-border">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-full ${isSubscribed ? "bg-green-500/10" : "bg-muted"}`}>
                {isSubscribed ? <BellRing className="h-5 w-5 text-green-600" /> : <BellOff className="h-5 w-5 text-muted-foreground" />}
              </div>
              <div>
                <p className="font-medium text-sm">Push Notifications</p>
                <p className="text-xs text-muted-foreground">
                  {!isSupported ? "Não suportado neste navegador" : isSubscribed ? "Ativas — você receberá alertas em tempo real" : "Desativadas — ative para receber alertas"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isSubscribed && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleTestPush}
                    disabled={testingPush}
                  >
                    {testingPush ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Send className="mr-1 h-3 w-3" />}
                    Testar Push
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={unsubscribe}
                    disabled={pushLoading}
                    className="text-destructive"
                  >
                    <BellOff className="mr-1 h-3 w-3" /> Desativar
                  </Button>
                </>
              )}
              {!isSubscribed && isSupported && (
                <Button
                  size="sm"
                  onClick={subscribe}
                  disabled={pushLoading}
                >
                  {pushLoading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <BellRing className="mr-1 h-3 w-3" />}
                  Ativar Push
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {!notifications?.length ? (
        <Card className="border-border">
          <CardContent className="flex flex-col items-center justify-center p-12">
            <Megaphone className="h-12 w-12 text-muted-foreground/40" />
            <h3 className="mt-4 text-lg font-medium">Nenhuma notificação enviada</h3>
            <p className="text-sm text-muted-foreground mt-1">Envie a primeira notificação para seus tenants</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications.map((n: any) => {
            const tc = typeConfig[n.type] || typeConfig.info;
            const TypeIcon = tc.icon;
            return (
              <Card key={n.id} className="border-border">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${tc.color} text-white`}>
                        <TypeIcon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{n.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <Badge variant="outline" className="text-[10px]">
                            <User className="mr-1 h-2.5 w-2.5" />
                            {getTenantName(n.target_user_id)}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(n.created_at).toLocaleString("pt-BR")}
                          </span>
                          <Badge variant={n.read ? "secondary" : "default"} className="text-[10px]">
                            {n.read ? "Lida" : "Não lida"}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(n.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Send Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Send className="h-5 w-5" /> Nova Notificação</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Destinatário</Label>
              <Select value={targetUserId} onValueChange={setTargetUserId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    <span className="flex items-center gap-2"><Users className="h-3.5 w-3.5" /> Todos os Tenants</span>
                  </SelectItem>
                  {tenants?.map(t => (
                    <SelectItem key={t.user_id} value={t.user_id}>
                      {t.display_name || t.store?.store_name || "Sem nome"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(typeConfig).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Título</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Título da notificação" />
            </div>
            <div className="space-y-2">
              <Label>Mensagem</Label>
              <Textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Escreva a mensagem..." rows={4} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
              <Button onClick={handleSend} disabled={sending}>
                <Send className="mr-2 h-4 w-4" />
                {sending ? "Enviando..." : "Enviar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
