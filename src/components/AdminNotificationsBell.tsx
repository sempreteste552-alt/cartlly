import { useState } from "react";
import { Bell, Check, CheckCheck, Send, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useAdminNotifications, getNotificationEmoji } from "@/hooks/useAdminNotifications";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export function AdminNotificationsBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification, clearAll } = useAdminNotifications();
  const { isSupported, isSubscribed, subscribe, loading: pushLoading } = usePushNotifications();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [testingPush, setTestingPush] = useState(false);

  const formatDate = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "agora";
    if (diffMin < 60) return `${diffMin}min`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7) return `${diffD}d`;
    return d.toLocaleDateString("pt-BR");
  };

  const handleTestPush = async () => {
    if (!user) return;
    setTestingPush(true);
    try {
      // Auto-subscribe if not subscribed yet
      if (!isSubscribed && isSupported) {
        await subscribe();
        // Wait briefly for subscription to be saved
        await new Promise(r => setTimeout(r, 1500));
      }

      const { data, error } = await supabase.functions.invoke("send-push", {
        body: {
          title: "🔔 Teste de Notificação",
          body: "Se você está vendo isso, as notificações push estão funcionando!",
          url: "/admin",
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

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative shrink-0">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center animate-pulse">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end" sideOffset={8}>
        <div className="flex items-center justify-between p-3 border-b sticky top-0 bg-background z-10">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm">🔔 Notificações</h3>
            {unreadCount > 0 && (
              <span className="bg-primary/10 text-primary text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-[10px] h-7 px-2" 
                onClick={(e) => { e.stopPropagation(); markAllAsRead(); }}
                title="Marcar todas como lidas"
              >
                <CheckCheck className="h-3 w-3 mr-1" /> Marcar Lidas
              </Button>
            )}
            {notifications.length > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-[10px] h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10" 
                onClick={(e) => { e.stopPropagation(); if (confirm("Limpar todas as notificações?")) clearAll(); }}
              >
                <Trash2 className="h-3 w-3 mr-1" /> Limpar
              </Button>
            )}
          </div>
        </div>

        {/* Push notifications controls */}
        <div className="p-2 border-b bg-muted/30">
          <div className="flex flex-col gap-2">
            {!isSubscribed ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs h-8"
                  onClick={subscribe}
                  disabled={pushLoading || !isSupported}
                >
                  {pushLoading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Bell className="h-3 w-3 mr-1" />}
                  {!isSupported ? "Push não suportado" : "Ativar Notificações Push"}
                </Button>
                {/iPad|iPhone|iPod/.test(navigator.userAgent) && !window.matchMedia('(display-mode: standalone)').matches && (
                  <p className="text-[10px] text-orange-600 font-medium px-1 text-center">
                    No iOS, adicione à tela de início para receber notificações fora do navegador.
                  </p>
                )}
                {/iPad|iPhone|iPod/.test(navigator.userAgent) && window.matchMedia('(display-mode: standalone)').matches && !isSubscribed && (
                  <p className="text-[10px] text-primary font-medium px-1 text-center">
                    Clique acima para autorizar notificações neste dispositivo.
                  </p>
                )}
              </>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs h-8"
                onClick={handleTestPush}
                disabled={testingPush}
              >
                {testingPush ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Send className="h-3 w-3 mr-1" />}
                Testar Notificações
              </Button>
            )}
          </div>
        </div>

        <ScrollArea className="max-h-[450px]">
          {notifications.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              <Bell className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p>Sua central de notificações está vazia</p>
            </div>
          ) : (
            <div className="flex flex-col">
              {notifications.map((n) => (
                <div key={n.id} className="group relative">
                  <button
                    onClick={() => { if (!n.read) markAsRead(n.id); }}
                    className={`w-full text-left p-4 hover:bg-muted/50 transition-colors ${!n.read ? "bg-primary/5 border-l-2 border-primary" : "border-l-2 border-transparent"}`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-xl shrink-0 mt-0.5">{getNotificationEmoji(n.type)}</span>
                      <div className="flex-1 min-w-0 pr-6">
                        <div className="flex items-center justify-between gap-2">
                          <p className={`text-sm truncate ${!n.read ? "font-bold text-foreground" : "font-medium text-muted-foreground"}`}>{n.title}</p>
                          {!n.read && <span className="h-2 w-2 rounded-full bg-primary shrink-0 animate-pulse" />}
                        </div>
                        <p className={`text-xs mt-1 leading-relaxed ${!n.read ? "text-foreground/80" : "text-muted-foreground/70"}`}>
                          {n.message}
                        </p>
                        <p className="text-[10px] text-muted-foreground/60 mt-2 font-medium">{formatDate(n.created_at)}</p>
                      </div>
                    </div>
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteNotification(n.id);
                    }}
                    title="Excluir notificação"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <Separator />
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
