import { useState, useEffect, useCallback } from "react";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useCustomerAuth } from "@/hooks/useCustomerAuth";
import { toast } from "sonner";

const VAPID_PUBLIC_KEY = "BCAULtrTpChA__hHpjRmVSWLWVsbxY7XUp0O3C41EffJXifYDtUwanUeFC0gixBtMQZxnl7ansKJ7bdJGkEjTVw";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

interface PushPermissionPromptProps {
  storeName?: string;
  logoUrl?: string;
  primaryColor?: string;
}

export function PushPermissionPrompt({ storeName, logoUrl, primaryColor }: PushPermissionPromptProps) {
  const { user } = useCustomerAuth();
  const [show, setShow] = useState(false);

  useEffect(() => {
    const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    if (!supported) return;
    if (Notification.permission !== "default") return;

    const dismissed = sessionStorage.getItem("push-prompt-dismissed");
    if (dismissed) return;

    // Show after a short delay so the page loads first
    const timer = setTimeout(() => setShow(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  const handleAllow = useCallback(async () => {
    setShow(false);
    sessionStorage.setItem("push-prompt-dismissed", "1");

    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        toast.error("Permissão de notificação negada. Ative nas configurações do dispositivo.");
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }

      // Persist if user is logged in
      if (user) {
        const json = subscription.toJSON();
        if (json.endpoint && json.keys?.p256dh && json.keys?.auth) {
          await supabase.from("push_subscriptions").upsert(
            {
              user_id: user.id,
              endpoint: json.endpoint,
              p256dh: json.keys.p256dh,
              auth: json.keys.auth,
            },
            { onConflict: "user_id,endpoint" }
          );
        }
      }

      toast.success("🔔 Notificações ativadas!");
    } catch (err: any) {
      console.error("Push permission error:", err);
    }
  }, [user]);

  const handleDismiss = () => {
    setShow(false);
    sessionStorage.setItem("push-prompt-dismissed", "1");
  };

  if (!show) return null;

  const color = primaryColor || "#6d28d9";
  const name = storeName || "esta loja";

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
                🔔 Ative as notificações
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Receba promoções, novidades e ofertas exclusivas de {name} em tempo real!
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
              Ativar Notificações
            </Button>
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={handleDismiss}>
              Agora não
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
