import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Cookie, X } from "lucide-react";

const COOKIE_KEY = "cookie_consent_accepted";

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const accepted = localStorage.getItem(COOKIE_KEY);
    if (!accepted) {
      // Small delay so it doesn't compete with page load
      const timer = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem(COOKIE_KEY, "true");
    setVisible(false);
  };

  const handleDismiss = () => {
    // Dismiss for this session only
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[60] p-3 sm:p-4 animate-in slide-in-from-bottom-4 duration-500">
      <div className="max-w-xl mx-auto bg-card border border-border rounded-xl shadow-2xl p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 shrink-0 mt-0.5">
            <Cookie className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">Utilizamos cookies</p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Este site utiliza cookies para melhorar sua experiência de navegação, 
              personalizar conteúdo e analisar o tráfego. Ao continuar navegando, 
              você concorda com o uso de cookies.
            </p>
            <div className="flex items-center gap-2 mt-3">
              <Button size="sm" onClick={handleAccept} className="text-xs h-8 px-4">
                Aceitar cookies
              </Button>
              <Button size="sm" variant="ghost" onClick={handleDismiss} className="text-xs h-8 px-3 text-muted-foreground">
                Recusar
              </Button>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="shrink-0 p-1 rounded-md hover:bg-muted transition-colors text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
