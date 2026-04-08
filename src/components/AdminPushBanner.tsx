import { useState, useEffect } from "react";
import { X, Download, Bell, Share, Plus, MoreVertical, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";

type Platform = "ios" | "android" | "desktop";

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

export function AdminPushBanner() {
  const [show, setShow] = useState(false);
  const [platform, setPlatform] = useState<Platform>("desktop");
  const [showInstructions, setShowInstructions] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    // Hide only if already installed as standalone app
    if (isStandalone()) return;

    setPlatform(detectPlatform());
    setShow(true);

    // Capture the native install prompt (Chrome/Edge on desktop & Android)
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleClick = async () => {
    if (deferredPrompt) {
      // Use native browser install prompt
      deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;
      if (result.outcome === "accepted") {
        setShow(false);
      }
      setDeferredPrompt(null);
    } else {
      // Show manual instructions
      setShowInstructions(true);
    }
  };

  if (!show) return null;

  const platformLabel =
    platform === "ios" ? "iPhone / iPad" :
    platform === "android" ? "Android" : "Desktop";

  return (
    <>
      <div className="bg-gradient-to-r from-primary/90 to-primary text-primary-foreground text-sm">
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Bell className="h-4 w-4 shrink-0 animate-pulse" />
            <p className="truncate">
              <span className="font-semibold">📲 Instale o app</span> para receber notificações de vendas, pagamentos e eventos em tempo real!
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant="secondary"
              className="h-7 text-xs font-bold px-3"
              onClick={handleClick}
            >
              <Download className="h-3.5 w-3.5 mr-1" />
              Instalar App
            </Button>
          </div>
        </div>
      </div>

      {/* Instructions modal */}
      {showInstructions && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShowInstructions(false)}>
          <div
            className="bg-card w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-6 space-y-5 animate-in slide-in-from-bottom duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">Instalar App Administrativo</h3>
                <p className="text-xs text-muted-foreground">{platformLabel}</p>
              </div>
              <button onClick={() => setShowInstructions(false)} className="p-1 rounded hover:bg-muted">
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>

            <div className="rounded-xl p-4 bg-primary/10 space-y-2">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-primary" />
                <p className="text-sm font-medium text-primary">Por que instalar?</p>
              </div>
              <ul className="text-xs text-muted-foreground space-y-1 pl-6 list-disc">
                <li>Notificações de novas vendas em tempo real</li>
                <li>Alertas de pagamentos aprovados/recusados</li>
                <li>Novos clientes cadastrados</li>
                <li>Acesso rápido direto da tela inicial</li>
              </ul>
            </div>

            {platform === "ios" && (
              <div className="space-y-4">
                <Step number={1} icon={<Share className="h-5 w-5 text-primary" />}>
                  Toque no botão <strong>Compartilhar</strong> <Share className="inline h-3.5 w-3.5 text-primary" /> na barra inferior do Safari
                </Step>
                <Step number={2} icon={<Plus className="h-5 w-5 text-primary" />}>
                  Role para baixo e toque em <strong>"Adicionar à Tela de Início"</strong>
                </Step>
                <Step number={3} icon={<Bell className="h-5 w-5 text-primary" />}>
                  Abra o app na tela de início e <strong>permita as notificações</strong>
                </Step>
                <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 p-3 rounded-lg">
                  ⚠️ Use o <strong>Safari</strong> para instalar. Chrome e outros navegadores não suportam instalação no iOS.
                </p>
              </div>
            )}

            {platform === "android" && (
              <div className="space-y-4">
                <Step number={1} icon={<MoreVertical className="h-5 w-5 text-primary" />}>
                  Toque no menu <strong>⋮</strong> (três pontos) no canto superior do Chrome
                </Step>
                <Step number={2} icon={<Download className="h-5 w-5 text-primary" />}>
                  Toque em <strong>"Instalar aplicativo"</strong> ou <strong>"Adicionar à tela inicial"</strong>
                </Step>
                <Step number={3} icon={<Bell className="h-5 w-5 text-primary" />}>
                  Abra o app instalado e <strong>permita as notificações</strong> quando solicitado
                </Step>
              </div>
            )}

            {platform === "desktop" && (
              <div className="space-y-4">
                <Step number={1} icon={<Monitor className="h-5 w-5 text-primary" />}>
                  No <strong>Chrome ou Edge</strong>, clique no ícone de <strong>instalação</strong> (⊕) na barra de endereço
                </Step>
                <Step number={2} icon={<Download className="h-5 w-5 text-primary" />}>
                  Clique em <strong>"Instalar"</strong> na janela que aparecer
                </Step>
                <Step number={3} icon={<Bell className="h-5 w-5 text-primary" />}>
                  O app abrirá em uma janela separada. <strong>Permita as notificações</strong> quando solicitado
                </Step>
                <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 p-3 rounded-lg">
                  💡 Se não aparecer o ícone de instalação, acesse o menu <strong>⋮ → "Instalar app"</strong> ou <strong>"Criar atalho"</strong>.
                </p>
              </div>
            )}

            <Button className="w-full" onClick={() => setShowInstructions(false)}>
              Entendi! 🎉
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
      <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 shrink-0">
        <span className="text-sm font-bold text-primary">{number}</span>
      </div>
      <div className="flex items-start gap-2 pt-1">
        {icon}
        <p className="text-sm text-foreground">{children}</p>
      </div>
    </div>
  );
}
