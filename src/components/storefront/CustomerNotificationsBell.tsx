import { useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useCustomerNotifications } from "@/hooks/useCustomerNotifications";
import { useTranslation } from "@/i18n";

interface Props {
  storeUserId?: string;
  primaryColor?: string;
  headerTextColor?: string;
  className?: string;
  isMobileNav?: boolean;
}

export function CustomerNotificationsBell({ storeUserId, primaryColor = "#6d28d9", headerTextColor, className, isMobileNav }: Props) {
  const { locale } = useTranslation();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useCustomerNotifications(storeUserId);
  const [open, setOpen] = useState(false);

  const uiText = {
    pt: { now: "agora", alerts: "Avisos", title: "🔔 Notificações", all: "Todas", empty: "Nenhuma notificação" },
    en: { now: "now", alerts: "Alerts", title: "🔔 Notifications", all: "All", empty: "No notifications" },
    es: { now: "ahora", alerts: "Avisos", title: "🔔 Notificaciones", all: "Todas", empty: "Sin notificaciones" },
    fr: { now: "maintenant", alerts: "Alertes", title: "🔔 Notifications", all: "Toutes", empty: "Aucune notification" },
  }[locale];

  const formatDate = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000);
    if (diffMin < 1) return uiText.now;
    if (diffMin < 60) return `${diffMin}min`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7) return `${diffD}d`;
    return d.toLocaleDateString(locale === "pt" ? "pt-BR" : locale === "en" ? "en-US" : locale === "es" ? "es-ES" : "fr-FR");
  };

  if (isMobileNav) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button className="flex flex-col items-center justify-center w-full h-full transition-colors">
            <div className="relative">
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span
                  className="absolute -top-1.5 -right-2.5 h-4 w-4 rounded-full text-[10px] font-bold flex items-center justify-center text-white"
                  style={{ backgroundColor: "#ef4444" }}
                >
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </div>
            <span className="text-[10px] mt-0.5 font-medium">{uiText.alerts}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0 mb-2 shadow-xl border-primary/10" align="center" side="top" sideOffset={8}>
          <NotificationList notifications={notifications} unreadCount={unreadCount} markAsRead={markAsRead} markAllAsRead={markAllAsRead} formatDate={formatDate} primaryColor={primaryColor} uiText={uiText} />
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className={`relative shrink-0 ${className || ""}`} style={{ color: headerTextColor }}>
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 h-5 w-5 rounded-full text-[10px] font-bold flex items-center justify-center text-white animate-pulse"
              style={{ backgroundColor: "#ef4444" }}
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 shadow-xl border-primary/10" align="end" sideOffset={8}>
        <NotificationList notifications={notifications} unreadCount={unreadCount} markAsRead={markAsRead} markAllAsRead={markAllAsRead} formatDate={formatDate} primaryColor={primaryColor} uiText={uiText} />
      </PopoverContent>
    </Popover>
  );
}

function NotificationList({ notifications, unreadCount, markAsRead, markAllAsRead, formatDate, primaryColor, uiText }: any) {
  return (
    <>
      <div className="flex items-center justify-between p-3 border-b">
        <h3 className="font-semibold text-sm">{uiText.title}</h3>
        {unreadCount > 0 && (
          <Button variant="ghost" size="sm" className="text-xs h-7" onClick={markAllAsRead}>
            <CheckCheck className="h-3 w-3 mr-1" /> {uiText.all}
          </Button>
        )}
      </div>
      <ScrollArea className="h-72">
        {notifications.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
            {uiText.empty}
          </div>
        ) : (
          notifications.map((n: any) => (
            <div key={n.id}>
              <button
                onClick={() => { if (!n.read) markAsRead(n); }}
                className={`w-full text-left p-3 hover:bg-muted/50 transition-colors ${!n.read ? "bg-primary/5" : ""}`}
              >
                <div className="flex items-start gap-2">
                  <span className="text-lg shrink-0 mt-0.5">
                    {n.message_type === "promo" || n.message_type === "promotion" ? "🎉" : n.message_type === "alert" ? "⚠️" : "📢"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-sm truncate ${!n.read ? "font-semibold" : "font-medium"}`}>{n.title}</p>
                      {!n.read && (
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: primaryColor }} />
                      )}
                    </div>
                    {n.body && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.body}</p>}
                    <p className="text-[10px] text-muted-foreground/60 mt-1">{formatDate(n.created_at)}</p>
                  </div>
                </div>
              </button>
              <Separator />
            </div>
          ))
        )}
      </ScrollArea>
    </>
  );
}