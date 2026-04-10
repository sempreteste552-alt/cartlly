import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X, Download, Smartphone, Sparkles } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface PWAInstallPromptProps {
  storeName?: string;
  storeIcon?: string;
  dismissKey?: string;
}

export function PWAInstallPrompt({ storeName, storeIcon, dismissKey = "pwa_install" }: PWAInstallPromptProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
      return;
    }

    // Check dismissed
    const dismissed = localStorage.getItem(dismissKey);
    if (dismissed) {
      const dismissedAt = new Date(dismissed).getTime();
      const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;
      if (dismissedAt > threeDaysAgo) return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Show after 5 seconds for better UX
      setTimeout(() => setShowBanner(true), 5000);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, [dismissKey]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
    setShowBanner(false);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem(dismissKey, new Date().toISOString());
  };

  if (!showBanner || isInstalled) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[60] p-3 animate-in slide-in-from-bottom-4 duration-500">
      <div className="max-w-md mx-auto bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
        {/* Gradient top bar */}
        <div className="h-1 bg-gradient-to-r from-primary via-primary/70 to-primary/40" />
        
        <div className="p-4">
          <div className="flex items-start gap-3">
            {/* App Icon */}
            <div className="shrink-0">
              {storeIcon ? (
                <img src={storeIcon} alt={storeName} className="h-14 w-14 rounded-2xl shadow-md object-cover" />
              ) : (
                <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center shadow-md">
                  <Smartphone className="h-7 w-7 text-primary" />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-foreground text-sm leading-tight">
                    Instalar {storeName || "App"}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                    <Sparkles className="h-3 w-3 text-primary" />
                    Acesse direto da tela inicial
                  </p>
                </div>
                <button onClick={handleDismiss} className="text-muted-foreground hover:text-foreground p-1 -mt-1 -mr-1">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex items-center gap-2 mt-3">
                <Button onClick={handleInstall} size="sm" className="gap-1.5 rounded-full flex-1 h-9 text-xs font-semibold">
                  <Download className="h-3.5 w-3.5" />
                  Instalar Grátis
                </Button>
                <Button onClick={handleDismiss} variant="ghost" size="sm" className="rounded-full h-9 text-xs text-muted-foreground">
                  Agora não
                </Button>
              </div>
            </div>
          </div>

          {/* Features mini */}
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/50">
            {["⚡ Mais rápido", "📱 Tela cheia", "🔔 Notificações"].map((feat) => (
              <span key={feat} className="text-[10px] text-muted-foreground">{feat}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
