import { useState, useEffect, useCallback } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useCustomerAuth } from "@/hooks/useCustomerAuth";
import { toast } from "sonner";
import { ensureCurrentPushSubscription, getValidPushSubscription } from "@/lib/pushSubscription";

interface StorePushOptInProps {
  primaryColor?: string;
}

export function StorePushOptIn({ primaryColor }: StorePushOptInProps) {
  const { user } = useCustomerAuth();
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
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
    } catch {
      setIsSubscribed(false);
    }
  }, [user, persistSubscription]);

  useEffect(() => {
    const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setIsSupported(supported);
    if (supported && user) checkSubscription();
  }, [user, checkSubscription]);

  const subscribe = useCallback(async () => {
    if (!user || !isSupported) return;
    setLoading(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        toast.error("Permissão de notificação negada.");
        setLoading(false);
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription = await ensureCurrentPushSubscription(registration);
      await persistSubscription(subscription);
      setIsSubscribed(true);
      toast.success("🔔 Notificações ativadas! Você receberá promoções e atualizações.");
    } catch (err: any) {
      toast.error("Erro ao ativar notificações: " + (err.message || "Erro"));
    } finally {
      setLoading(false);
    }
  }, [user, isSupported, persistSubscription]);

  const unsubscribe = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        await supabase.from("push_subscriptions").delete().eq("user_id", user.id).eq("endpoint", subscription.endpoint);
      }
      setIsSubscribed(false);
      toast.success("Notificações desativadas.");
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  if (!isSupported || !user) return null;

  const color = primaryColor || "#6d28d9";

  return (
    <Button
      variant="ghost"
      size="icon"
      className="relative"
      title={isSubscribed ? "Desativar notificações" : "Ativar notificações"}
      onClick={isSubscribed ? unsubscribe : subscribe}
      disabled={loading}
    >
      {loading ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : isSubscribed ? (
        <Bell className="h-5 w-5" style={{ color }} />
      ) : (
        <BellOff className="h-5 w-5 opacity-60" />
      )}
      {isSubscribed && (
        <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full animate-pulse" style={{ backgroundColor: color }} />
      )}
    </Button>
  );
}
