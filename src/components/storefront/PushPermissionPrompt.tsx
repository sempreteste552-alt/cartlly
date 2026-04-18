import { useState, useEffect, useCallback } from "react";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useCustomerAuth } from "@/hooks/useCustomerAuth";
import { toast } from "sonner";
import { ensureCurrentPushSubscription } from "@/lib/pushSubscription";
import { useTranslation } from "@/i18n";

interface PushPermissionPromptProps {
  storeName?: string;
  logoUrl?: string;
  primaryColor?: string;
  storeUserId?: string;
}

export function PushPermissionPrompt({ storeName, logoUrl, primaryColor, storeUserId }: PushPermissionPromptProps) {
  const { locale } = useTranslation();
  const { user } = useCustomerAuth();
  const [show, setShow] = useState(false);
  const uiText = {
    pt: {
      denied: "Permissão de notificação negada. Ative nas configurações do dispositivo.",
      enabled: "🔔 Notificações ativadas!",
      error: "Erro ao ativar notificações: ",
      title: "🔔 Ative as notificações",
      description: "Receba promoções, novidades e ofertas exclusivas de",
      action: "Ativar Notificações",
      later: "Agora não",
      storeFallback: "esta loja",
    },
    en: {
      denied: "Notification permission denied. Enable it in your device settings.",
      enabled: "🔔 Notifications enabled!",
      error: "Error enabling notifications: ",
      title: "🔔 Turn on notifications",
      description: "Receive promotions, news and exclusive offers from",
      action: "Enable notifications",
      later: "Not now",
      storeFallback: "this store",
    },
    es: {
      denied: "Permiso de notificaciones denegado. Actívalo en la configuración del dispositivo.",
      enabled: "🔔 ¡Notificaciones activadas!",
      error: "Error al activar notificaciones: ",
      title: "🔔 Activa las notificaciones",
      description: "Recibe promociones, novedades y ofertas exclusivas de",
      action: "Activar notificaciones",
      later: "Ahora no",
      storeFallback: "esta tienda",
    },
    fr: {
      denied: "Autorisation de notification refusée. Activez-la dans les réglages de l'appareil.",
      enabled: "🔔 Notifications activées !",
      error: "Erreur lors de l'activation des notifications : ",
      title: "🔔 Activez les notifications",
      description: "Recevez promotions, nouveautés et offres exclusives de",
      action: "Activer les notifications",
      later: "Pas maintenant",
      storeFallback: "cette boutique",
    },
  }[locale];

  useEffect(() => {
    const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    if (!supported) return;
    if (Notification.permission !== "default") return;

    const dismissed = sessionStorage.getItem("push-prompt-dismissed");
    if (dismissed) return;

    // Avoid stacking with the PWA install banner.
    // Only show this prompt if the app is already installed (standalone)
    // OR the user already dismissed/handled the install banner.
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // @ts-ignore iOS Safari
      window.navigator.standalone === true;
    const installDismissed = localStorage.getItem("pwa-install-dismissed") === "1";

    if (!isStandalone && !installDismissed) {
      const onDismiss = () => setShow(true);
      window.addEventListener("pwa-install-dismissed", onDismiss, { once: true });
      return () => window.removeEventListener("pwa-install-dismissed", onDismiss);
    }

    const timer = setTimeout(() => setShow(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  const handleAllow = useCallback(async () => {
    setShow(false);
    sessionStorage.setItem("push-prompt-dismissed", "1");

    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        toast.error(uiText.denied);
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await ensureCurrentPushSubscription(registration);

      if (user) {
        const json = subscription.toJSON();
        if (json.endpoint && json.keys?.p256dh && json.keys?.auth) {
          await supabase.from("push_subscriptions").upsert(
            {
              user_id: user.id,
              endpoint: json.endpoint,
              p256dh: json.keys.p256dh,
              auth: json.keys.auth,
              store_user_id: storeUserId || null,
            },
            { onConflict: "user_id,endpoint" }
          );
        }
      }

      toast.success(uiText.enabled);
    } catch (err: any) {
      console.error("Push permission error:", err);
      toast.error(uiText.error + (err.message || "Unknown error"));
    }
  }, [user, uiText, storeUserId]);

  const handleDismiss = () => {
    setShow(false);
    sessionStorage.setItem("push-prompt-dismissed", "1");
  };

  if (!show) return null;

  const color = primaryColor || "#6d28d9";
  const name = storeName || uiText.storeFallback;

  return (
    <div className="fixed bottom-20 md:bottom-6 left-4 right-4 md:left-auto md:right-6 md:max-w-sm z-[70] animate-in slide-in-from-bottom-4 duration-500">
      <div className="rounded-2xl shadow-2xl border border-border overflow-hidden bg-card">
        <div className="p-1" style={{ background: `linear-gradient(135deg, ${color}, ${adjustColor(color, -30)})` }} />
        <div className="p-4 space-y-3">
          <div className="flex items-start gap-3">
            <div
              className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${color}15` }}
            >
              {logoUrl ? (
                <img src={logoUrl} alt="" className="h-8 w-8 rounded-lg object-contain" />
              ) : (
                <Bell className="h-5 w-5" style={{ color }} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm text-foreground">
                 {uiText.title}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                 {uiText.description} {name} {locale === "pt" ? "em tempo real!" : locale === "en" ? "in real time!" : locale === "es" ? "en tiempo real!" : "en temps réel !"}
              </p>
            </div>
            <button onClick={handleDismiss} className="p-1 rounded hover:bg-muted shrink-0">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <Button
              className="flex-1 text-white text-sm font-bold"
              style={{ backgroundColor: color }}
              onClick={handleAllow}
            >
              <Bell className="h-4 w-4 mr-1.5" />
               {uiText.action}
            </Button>
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={handleDismiss}>
              {uiText.later}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function adjustColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.max(0, Math.min(255, ((num >> 16) & 0xff) + amount));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + amount));
  const b = Math.max(0, Math.min(255, (num & 0xff) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}
