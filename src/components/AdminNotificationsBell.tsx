import { useState } from "react";
import { Bell, Check, CheckCheck, Send, Loader2 } from "lucide-react";
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
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useAdminNotifications();
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
        toast.error("Nenhuma assinatura push encontrada. Ative as notificações primeiro.");
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
        <div className="flex items-center justify-between p-3 border-b">
          <h3 className="font-semibold text-sm">🔔 Notificações</h3>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={markAllAsRead}>
                <CheckCheck className="h-3 w-3 mr-1" /> Todas
              </Button>
            )}
          </div>
        </div>

        {/* Push notifications controls */}
        <div className="p-2 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            {!isSubscribed ? (
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs h-8"
                onClick={subscribe}
                disabled={pushLoading || !isSupported}
              >
                {pushLoading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Bell className="h-3 w-3 mr-1" />}
                {!isSupported ? "Push não suportado" : "Ativar Push"}
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs h-8"
                onClick={handleTestPush}
                disabled={testingPush}
              >
                {testingPush ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Send className="h-3 w-3 mr-1" />}
                Testar Push
              </Button>
            )}
          </div>
        </div>

        <ScrollArea className="max-h-72">
          {notifications.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
              Nenhuma notificação
            </div>
          ) : (
            notifications.map((n) => (
              <div key={n.id}>
                <button
                  onClick={() => { if (!n.read) markAsRead(n.id); }}
                  className={`w-full text-left p-3 hover:bg-muted/50 transition-colors ${!n.read ? "bg-primary/5" : ""}`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-lg shrink-0 mt-0.5">{getNotificationEmoji(n.type)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-sm truncate ${!n.read ? "font-semibold" : "font-medium"}`}>{n.title}</p>
                        {!n.read && <span className="h-2 w-2 rounded-full bg-primary shrink-0" />}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.message}</p>
                      <p className="text-[10px] text-muted-foreground/60 mt-1">{formatDate(n.created_at)}</p>
                    </div>
                  </div>
                </button>
                <Separator />
              </div>
            ))
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
