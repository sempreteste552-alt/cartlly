import { useState, useEffect } from "react";
import { X, Download, Share, Plus, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";

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

export function PWAInstallBanner() {
  const [show, setShow] = useState(false);
  const [platform, setPlatform] = useState<Platform>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstructions, setShowInstructions] = useState(false);

  useEffect(() => {
    // Don't show if already installed or dismissed recently
    if (isStandalone()) return;

    const dismissed = sessionStorage.getItem("pwa-banner-dismissed");
    if (dismissed) return;

    const plat = detectPlatform();
    setPlatform(plat);
    setShow(true);

    // Listen for beforeinstallprompt (Android/Chrome)
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const dismiss = () => {
    setShow(false);
    sessionStorage.setItem("pwa-banner-dismissed", "1");
  };

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;
      if (result.outcome === "accepted") dismiss();
      setDeferredPrompt(null);
    } else {
      setShowInstructions(true);
    }
  };

  if (!show) return null;

  return (
    <>
      {/* Banner */}
      <div className="relative z-[60] bg-gradient-to-r from-violet-600 to-purple-700 text-white">
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Download className="h-4 w-4 shrink-0 animate-bounce" />
            <p className="text-xs sm:text-sm font-medium truncate">
              {platform === "ios"
                ? "Adicione à tela de início para receber notificações!"
                : platform === "android"
                ? "Baixe o app para receber notificações em tempo real!"
                : "Instale o app para notificações em tempo real!"}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant="secondary"
              className="h-7 text-xs font-bold bg-white text-purple-700 hover:bg-purple-50 px-3"
              onClick={handleInstall}
            >
              {platform === "ios" ? "Como fazer" : "Instalar"}
            </Button>
            <button onClick={dismiss} className="p-1 hover:bg-white/20 rounded">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Instructions modal */}
      {showInstructions && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShowInstructions(false)}>
          <div
            className="bg-white dark:bg-gray-900 w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-6 space-y-5 animate-in slide-in-from-bottom duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                {platform === "ios" ? "Instalar no iPhone/iPad" : "Instalar no Android"}
              </h3>
              <button onClick={() => setShowInstructions(false)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800">
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            {platform === "ios" ? (
              <div className="space-y-4">
                <Step number={1} icon={<Share className="h-5 w-5 text-blue-500" />}>
                  Toque no botão <strong>Compartilhar</strong> <Share className="inline h-4 w-4 text-blue-500" /> na barra inferior do Safari
                </Step>
                <Step number={2} icon={<Plus className="h-5 w-5 text-green-500" />}>
                  Role para baixo e toque em <strong>"Adicionar à Tela de Início"</strong>
                </Step>
                <Step number={3} icon={<Download className="h-5 w-5 text-purple-500" />}>
                  Toque em <strong>"Adicionar"</strong> no canto superior direito
                </Step>
                <p className="text-xs text-gray-500 dark:text-gray-400 bg-amber-50 dark:bg-amber-900/30 p-3 rounded-lg">
                  ⚠️ Use o <strong>Safari</strong> para instalar. Outros navegadores não suportam essa função no iOS.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <Step number={1} icon={<MoreVertical className="h-5 w-5 text-gray-600" />}>
                  Toque no menu <strong>⋮</strong> (três pontos) no canto superior do navegador
                </Step>
                <Step number={2} icon={<Download className="h-5 w-5 text-blue-500" />}>
                  Toque em <strong>"Instalar aplicativo"</strong> ou <strong>"Adicionar à tela inicial"</strong>
                </Step>
                <Step number={3} icon={<Plus className="h-5 w-5 text-green-500" />}>
                  Confirme tocando em <strong>"Instalar"</strong>
                </Step>
              </div>
            )}

            <Button
              className="w-full bg-purple-600 hover:bg-purple-700 text-white"
              onClick={() => setShowInstructions(false)}
            >
              Entendi!
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

function Step({ number, icon, children }: { number: number; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex items-center justify-center h-8 w-8 rounded-full bg-purple-100 dark:bg-purple-900/50 shrink-0">
        <span className="text-sm font-bold text-purple-700 dark:text-purple-300">{number}</span>
      </div>
      <div className="flex items-start gap-2 pt-1">
        {icon}
        <p className="text-sm text-gray-700 dark:text-gray-300">{children}</p>
      </div>
    </div>
  );
}
