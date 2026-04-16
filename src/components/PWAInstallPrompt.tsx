import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Share, Download, Smartphone, Apple, Info, X } from "lucide-react";
import { Badge } from "./ui/badge";

export function PWAInstallPrompt() {
  const [open, setOpen] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    // Detect iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    // Detect if already installed (standalone)
    const isStandaloneMode = window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone;
    setIsStandalone(isStandaloneMode);

    // Capture beforeinstallprompt for Android/Chrome
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Only show after some interaction or delay if not installed
      if (!isStandaloneMode) {
        setTimeout(() => setOpen(true), 3000);
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    const handleShowPrompt = () => setOpen(true);
    window.addEventListener('show_pwa_prompt', handleShowPrompt);

    // If iOS and not standalone, show prompt after delay
    if (isIOSDevice && !isStandaloneMode) {
      const shown = localStorage.getItem("pwa_prompt_shown");
      if (!shown) {
        setTimeout(() => setOpen(true), 5000);
      }
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener('show_pwa_prompt', handleShowPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setDeferredPrompt(null);
        setOpen(false);
      }
    }
  };

  const handleClose = () => {
    setOpen(false);
    localStorage.setItem("pwa_prompt_shown", "true");
  };

  if (isStandalone) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-primary" />
            {isIOS ? "Instalar no seu iPhone" : "Instalar Aplicativo"}
          </DialogTitle>
          <DialogDescription>
            Tenha acesso rápido à sua loja diretamente da tela de início do seu celular.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {isIOS ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 bg-muted/50 p-4 rounded-xl border border-border">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 shrink-0">
                  <span className="font-bold text-primary">1</span>
                </div>
                <div>
                  <p className="text-sm font-medium">Toque no botão de compartilhar</p>
                  <p className="text-xs text-muted-foreground">Localizado na parte inferior do seu Safari.</p>
                  <div className="mt-2 inline-flex items-center justify-center h-8 w-8 bg-blue-500 rounded-md text-white">
                    <Share className="h-4 w-4" />
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-muted/50 p-4 rounded-xl border border-border">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 shrink-0">
                  <span className="font-bold text-primary">2</span>
                </div>
                <div>
                  <p className="text-sm font-medium">Role para baixo e selecione</p>
                  <div className="flex items-center gap-2 my-1">
                    <Badge variant="outline" className="text-xs py-1">
                      Adicionar à Tela de Início
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">Ou "Add to Home Screen".</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4 text-center py-4">
              <div className="flex justify-center mb-4">
                <div className="p-4 bg-primary/10 rounded-full">
                  <Download className="h-10 w-10 text-primary animate-bounce" />
                </div>
              </div>
              <p className="text-sm font-medium">
                Clique no botão abaixo para instalar o WebApp no seu Android.
              </p>
              <Button className="w-full" size="lg" onClick={handleInstallClick}>
                Instalar Agora
              </Button>
            </div>
          )}

          <Button variant="ghost" className="w-full text-xs" onClick={handleClose}>
            Talvez mais tarde
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}