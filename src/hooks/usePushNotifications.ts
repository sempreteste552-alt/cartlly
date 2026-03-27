// Push notifications hook v2
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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

export function usePushNotifications() {
  const { user } = useAuth();
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [loading, setLoading] = useState(false);

  const persistSubscription = useCallback(async (subscription: PushSubscription) => {
    if (!user) throw new Error("Usuário não autenticado");

    const json = subscription.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
      throw new Error("Subscription data incomplete");
    }

    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        user_id: user.id,
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
      },
      { onConflict: "user_id,endpoint" }
    );

    if (error) throw error;
  }, [user]);

  const checkSubscription = useCallback(async () => {
    if (!user) return;

    try {
      const registration = await navigator.serviceWorker.getRegistration("/sw-push.js");
      if (!registration) {
        setIsSubscribed(false);
        return;
      }

      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        setIsSubscribed(false);
        return;
      }

      await persistSubscription(subscription);
      setIsSubscribed(true);
    } catch (err) {
      console.error("Push subscription sync error:", err);
      setIsSubscribed(false);
    }
  }, [user, persistSubscription]);

  useEffect(() => {
    const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setIsSupported(supported);

    if (supported) {
      setPermission(Notification.permission);
      checkSubscription();
    }
  }, [user, checkSubscription]);

  const subscribe = useCallback(async () => {
    if (!user || !isSupported) return;
    setLoading(true);

    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm !== "granted") {
        toast.error("Permissão de notificação negada. Ative nas configurações do navegador.");
        setLoading(false);
        return;
      }

      const registration = await navigator.serviceWorker.register("/sw-push.js");
      await navigator.serviceWorker.ready;

      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }

      await persistSubscription(subscription);

      setIsSubscribed(true);
      toast.success("🔔 Notificações push ativadas!");
    } catch (err: any) {
      console.error("Push subscription error:", err);
      toast.error("Erro ao ativar notificações: " + (err.message || "Erro desconhecido"));
    } finally {
      setLoading(false);
    }
  }, [user, isSupported, persistSubscription]);

  const unsubscribe = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      const registration = await navigator.serviceWorker.getRegistration("/sw-push.js");
      if (registration) {
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          await subscription.unsubscribe();
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq("user_id", user.id)
            .eq("endpoint", subscription.endpoint);
        }
      }

      setIsSubscribed(false);
      toast.success("Notificações push desativadas");
    } catch (err: any) {
      toast.error("Erro ao desativar: " + err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  return {
    isSupported,
    isSubscribed,
    permission,
    loading,
    subscribe,
    unsubscribe,
  };
}
