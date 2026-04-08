// Push notifications hook v2
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { ensureCurrentPushSubscription, getValidPushSubscription } from "@/lib/pushSubscription";

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
    if (!user || !("serviceWorker" in navigator)) return;

    try {
      const registration = await navigator.serviceWorker.ready;

      if (!registration) {
        setIsSubscribed(false);
        return;
      }

      const subscription = Notification.permission === "granted"
        ? await ensureCurrentPushSubscription(registration)
        : await getValidPushSubscription(registration);

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
        toast.error("Permissão de notificação negada. Ative nas configurações do dispositivo.");
        setLoading(false);
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await ensureCurrentPushSubscription(registration);

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
      const registration = await navigator.serviceWorker.ready;
      
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
