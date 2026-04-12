import { useState, useEffect } from "react";
import { Bell, Check, CheckCheck, Send, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { Separator } from "@/components/ui/separator";
import { useAdminNotifications, getNotificationEmoji } from "@/hooks/useAdminNotifications";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

const NOTIFICATION_SOUND = "/sounds/notification.mp3";

const playNotificationSound = () => {
  try {
    const audio = new Audio(NOTIFICATION_SOUND);
    audio.volume = 0.6;
    audio.play().catch(() => {});
  } catch (err) {
    console.error("Error playing sound:", err);
  }
};

export function AdminNotificationsBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification, clearAll } = useAdminNotifications();
  const { isSupported, isSubscribed, subscribe, loading: pushLoading } = usePushNotifications();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [testingPush, setTestingPush] = useState(false);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("admin_support_global_realtime")
      .on(
        "postgres_changes",
        { 
          event: "INSERT", 
          schema: "public", 
          table: "support_messages",
          filter: `sender_type=eq.customer`
        },
        async (payload: any) => {
          // Verify if this message is for this store
          const { data: conv } = await supabase
            .from("support_conversations")
            .select("tenant_id")
            .eq("id", payload.new.conversation_id)
            .single();

          if (conv && conv.tenant_id === user.id) {
            playNotificationSound();
            toast.info("Nova mensagem de suporte recebida!", {
              description: payload.new.body.substring(0, 50) + "...",
              action: {
                label: "Ver",
                onClick: () => navigate(`/admin/suporte?conv=${payload.new.conversation_id}`),
              },
            });
            queryClient.invalidateQueries({ queryKey: ["support_conversations"] });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

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
        <Button variant="ghost" size="icon" className="relative shrink-0 hover:bg-primary/5 rounded-full transition-all active:scale-95 group">
          <Bell className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 h-4 w-4 rounded-full bg-red-600 text-white text-[9px] font-black flex items-center justify-center border-2 border-background shadow-sm ring-1 ring-red-600/20">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] sm:w-[400px] p-0 flex flex-col max-h-[85vh] shadow-2xl border-primary/10" align="end" sideOffset={12}>
        <div className="flex items-center justify-between p-4 border-b bg-background/95 backdrop-blur-sm sticky top-0 z-20">
          <div className="flex items-center gap-2.5">
            <div className="bg-primary/10 p-1.5 rounded-lg">
              <Bell className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-sm tracking-tight text-foreground">Notificações</h3>
              {unreadCount > 0 && (
                <p className="text-[10px] text-muted-foreground font-medium">
                  {unreadCount} {unreadCount === 1 ? 'não lida' : 'não lidas'}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {unreadCount > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-[11px] h-8 px-2.5 font-semibold text-primary hover:text-primary hover:bg-primary/5 rounded-full transition-all" 
                onClick={(e) => { e.stopPropagation(); markAllAsRead(); }}
              >
                <CheckCheck className="h-3.5 w-3.5 mr-1.5" /> Marcar Lidas
              </Button>
            )}
            {notifications.length > 0 && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/5 rounded-full" 
                onClick={(e) => { e.stopPropagation(); if (confirm("Limpar todas as notificações?")) clearAll(); }}
                title="Limpar todas"
              >
                <Trash2 className="h-4 w-4" />
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
                  <p className="text-[10px] text-amber-600 font-medium px-1 text-center">
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

        <div className="flex-1 overflow-y-auto min-h-0 max-h-[500px] overscroll-contain touch-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground/60 space-y-3">
              <div className="p-4 bg-muted rounded-full">
                <Bell className="h-8 w-8 opacity-40" />
              </div>
              <div>
                <p className="font-semibold text-foreground/80">Sua central está vazia</p>
                <p className="text-xs">Você receberá atualizações aqui.</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-border/50">
              {notifications.map((n) => (
                <div key={n.id} className="group relative hover:bg-muted/30 transition-all duration-200">
                  <button
                    onClick={() => { if (!n.read) markAsRead(n.id); }}
                    className={`w-full text-left p-4.5 pl-6 pr-12 transition-colors relative ${!n.read ? "bg-primary/[0.03]" : "opacity-75"}`}
                  >
                    {!n.read && (
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-primary shadow-sm shadow-primary/40 animate-pulse" />
                    )}
                    <div className="flex items-start gap-4">
                      <div className={`p-2 rounded-xl shrink-0 mt-0.5 shadow-sm bg-white border border-border/50 group-hover:scale-110 transition-transform`}>
                        <span className="text-xl leading-none block">{getNotificationEmoji(n.type)}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <p className={`text-sm truncate leading-snug tracking-tight ${!n.read ? "font-bold text-foreground" : "font-medium text-muted-foreground"}`}>{n.title}</p>
                        </div>
                        <p className={`text-xs leading-relaxed line-clamp-2 ${!n.read ? "text-foreground/85 font-normal" : "text-muted-foreground/75 font-normal"}`}>
                          {n.message}
                        </p>
                        <div className="flex items-center gap-1.5 mt-2.5">
                          <span className="text-[10px] text-muted-foreground/50 font-medium tracking-wide uppercase">{formatDate(n.created_at)}</span>
                          {!n.read && <span className="text-[10px] text-primary/70 font-bold px-1.5 py-0.5 bg-primary/5 rounded-md uppercase tracking-wider">Novo</span>}
                        </div>
                      </div>
                    </div>
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-3 top-1/2 -translate-y-1/2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-all hover:text-destructive hover:bg-destructive/10 rounded-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteNotification(n.id);
                    }}
                    title="Excluir notificação"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
