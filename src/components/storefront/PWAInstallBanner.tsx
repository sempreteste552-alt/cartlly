import { useState, useEffect, useCallback } from "react";
import { X, Download, Share, Plus, MoreVertical, Bell, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { ensureCurrentPushSubscription } from "@/lib/pushSubscription";
import { toast } from "sonner";

type Platform = "ios" | "android" | "desktop" | null;

function detectPlatform(): Platform {
  const ua = navigator.userAgent || "";
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as any).standalone === true
  );
}

interface PWAInstallBannerProps {
  storeName?: string;
  logoUrl?: string;
  primaryColor?: string;
  storeUserId?: string;
}

async function autoEnablePushAfterInstall(storeUserId?: string) {
  try {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return;
    if (Notification.permission === "denied") return;

    const perm = await Notification.requestPermission();
    if (perm !== "granted") return;

    const registration = await navigator.serviceWorker.ready;
    const subscription = await ensureCurrentPushSubscription(registration);
    const json = subscription.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

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

    toast.success("🔔 Notificações ativadas automaticamente!");
  } catch (err) {
    console.warn("Auto push after install failed:", err);
  }
}

export function PWAInstallBanner({ storeName, logoUrl, primaryColor, storeUserId }: PWAInstallBannerProps) {
  const [show, setShow] = useState(false);
  const [platform, setPlatform] = useState<Platform>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstructions, setShowInstructions] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    setPlatform(detectPlatform());
    setShow(true);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const dismissBanner = useCallback(() => {
    setShow(false);
    window.dispatchEvent(new CustomEvent("pwa-install-dismissed"));
  }, []);

  useEffect(() => {
    const onInstalled = () => {
      dismissBanner();
      autoEnablePushAfterInstall(storeUserId);
    };
    window.addEventListener("appinstalled", onInstalled);
    return () => window.removeEventListener("appinstalled", onInstalled);
  }, [storeUserId, dismissBanner]);

  const handleInstall = async () => {
    if (platform === "android" || platform === "desktop") {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const result = await deferredPrompt.userChoice;
        if (result.outcome === "accepted") {
          dismissBanner();
        }
        setDeferredPrompt(null);
      } else {
        try {
          if ("Notification" in window && Notification.permission === "default") {
            await Notification.requestPermission();
          }
        } catch {}
        setShowInstructions(true);
      }
    } else {
      setShowInstructions(true);
    }
  };

  if (!show) return null;

  const name = storeName || "nossa loja";
  const bgColor = primaryColor || "#6d28d9";

  return (
    <>
      {/* Inline sticky install card — stays at top until installed */}
      <div className="w-full bg-card border-b border-border shadow-sm">
        <div className="max-w-md mx-auto flex items-center gap-3 p-2.5">
          <div className="relative shrink-0">
            {logoUrl ? (
              <img src={logoUrl} alt={name} className="h-10 w-10 rounded-xl object-cover border border-border" />
            ) : (
              <div
                className="h-10 w-10 rounded-xl flex items-center justify-center"
                style={{ background: `linear-gradient(135deg, ${bgColor}, ${adjustColor(bgColor, -20)})` }}
              >
                <Gift className="h-5 w-5 text-white" />
              </div>
            )}
            <span
              className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-card flex items-center justify-center"
              style={{ backgroundColor: bgColor }}
            >
              <Download className="h-2 w-2 text-white" strokeWidth={3} />
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground truncate leading-tight">
              Instalar {name}
            </p>
            <p className="text-[11px] text-muted-foreground truncate mt-0.5">
              Acesso rápido • Notificações • Offline
            </p>
          </div>

          <Button
            size="sm"
            className="h-8 px-3.5 text-xs font-semibold rounded-lg shrink-0 text-white"
            style={{ backgroundColor: bgColor }}
            onClick={handleInstall}
          >
            Instalar
          </Button>
        </div>
      </div>

      {/* Instructions modal */}
      {showInstructions && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShowInstructions(false)}>
          <div
            className="bg-card w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] space-y-5 animate-in slide-in-from-bottom duration-300 max-h-[90vh] overflow-y-auto overscroll-contain"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {logoUrl && <img src={logoUrl} alt={name} className="h-10 w-10 rounded-xl object-contain" />}
                <div>
                  <h3 className="text-lg font-bold text-card-foreground">
                    Instalar {name}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {platform === "ios" ? "iPhone / iPad" : "Android"}
                  </p>
                </div>
              </div>
              <button onClick={() => setShowInstructions(false)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800">
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="rounded-xl p-4 space-y-2" style={{ backgroundColor: `${bgColor}10` }}>
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4" style={{ color: bgColor }} />
                <p className="text-sm font-medium" style={{ color: bgColor }}>Por que instalar?</p>
              </div>
              <ul className="text-xs text-muted-foreground space-y-1 pl-6 list-disc">
                <li>Receba notificações de promoções exclusivas</li>
                <li>Acesso rápido direto da tela inicial</li>
                <li>Experiência de app nativo</li>
              </ul>
            </div>

            {platform === "ios" ? (
              <div className="space-y-4">
                <Step number={1} color={bgColor} icon={<Share className="h-5 w-5" style={{ color: bgColor }} />}>
                  Toque no botão <strong>Compartilhar</strong> <Share className="inline h-3.5 w-3.5" style={{ color: bgColor }} /> na barra do Safari
                </Step>
                <Step number={2} color={bgColor} icon={<Plus className="h-5 w-5" style={{ color: bgColor }} />}>
                  Toque em <strong>"Adicionar à Tela de Início"</strong>
                </Step>
                <Step number={3} color={bgColor} icon={<Download className="h-5 w-5" style={{ color: bgColor }} />}>
                  Confirme tocando em <strong>"Adicionar"</strong>
                </Step>
                <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 p-3 rounded-lg">
                  ⚠️ Use o <strong>Safari</strong> para instalar. Outros navegadores não suportam no iOS.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <Step number={1} color={bgColor} icon={<MoreVertical className="h-5 w-5" style={{ color: bgColor }} />}>
                  Toque no menu <strong>⋮</strong> (três pontos) no navegador
                </Step>
                <Step number={2} color={bgColor} icon={<Download className="h-5 w-5" style={{ color: bgColor }} />}>
                  Toque em <strong>"Instalar aplicativo"</strong> ou <strong>"Adicionar à tela inicial"</strong>
                </Step>
                <Step number={3} color={bgColor} icon={<Plus className="h-5 w-5" style={{ color: bgColor }} />}>
                  Confirme tocando em <strong>"Instalar"</strong>
                </Step>
              </div>
            )}

            <Button
              className="w-full text-white"
              style={{ backgroundColor: bgColor }}
              onClick={() => setShowInstructions(false)}
            >
              Entendi! 🎉
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

function Step({ number, icon, children, color }: { number: number; icon: React.ReactNode; children: React.ReactNode; color: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex items-center justify-center h-8 w-8 rounded-full shrink-0" style={{ backgroundColor: `${color}15` }}>
        <span className="text-sm font-bold" style={{ color }}>{number}</span>
      </div>
      <div className="flex items-start gap-2 pt-1">
        {icon}
        <p className="text-sm text-muted-foreground">{children}</p>
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
