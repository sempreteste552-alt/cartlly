import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Cookie, X } from "lucide-react";
import { useTranslation } from "@/i18n";

interface CookieConsentProps {
  basePath: string;
  storeUserId?: string;
  primaryColor?: string;
  buttonColor?: string;
  buttonTextColor?: string;
}

export function CookieConsent({ basePath, storeUserId, primaryColor, buttonColor, buttonTextColor }: CookieConsentProps) {
  const { locale } = useTranslation();
  const [visible, setVisible] = useState(false);
  const uiText = {
    pt: {
      title: "Utilizamos cookies",
      description: "Este site utiliza cookies para melhorar sua experiência.",
      policy: "política de cookies",
      accept: "Aceitar",
      decline: "Recusar",
      connector: "Ao continuar navegando, você concorda com nossa",
    },
    en: {
      title: "We use cookies",
      description: "This site uses cookies to improve your experience.",
      policy: "cookie policy",
      accept: "Accept",
      decline: "Decline",
      connector: "By continuing to browse, you agree to our",
    },
    es: {
      title: "Usamos cookies",
      description: "Este sitio utiliza cookies para mejorar tu experiencia.",
      policy: "política de cookies",
      accept: "Aceptar",
      decline: "Rechazar",
      connector: "Al continuar navegando, aceptas nuestra",
    },
    fr: {
      title: "Nous utilisons des cookies",
      description: "Ce site utilise des cookies pour améliorer votre expérience.",
      policy: "politique de cookies",
      accept: "Accepter",
      decline: "Refuser",
      connector: "En continuant votre navigation, vous acceptez notre",
    },
  }[locale];

  const storageKey = `cookie_consent_${storeUserId || "default"}`;

  useEffect(() => {
    const accepted = localStorage.getItem(storageKey);
    if (!accepted) {
      const timer = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [storageKey]);

  const handleAccept = () => {
    localStorage.setItem(storageKey, "true");
    setVisible(false);
  };

  const handleDismiss = () => {
    setVisible(false);
  };

  if (!visible) return null;

  const resolvedPrimary = primaryColor || "hsl(var(--primary))";
  const resolvedBtnBg = buttonColor || primaryColor || "hsl(var(--primary))";
  const resolvedBtnText = buttonTextColor || "#ffffff";

  return (
    <div className="fixed bottom-16 md:bottom-4 left-0 right-0 z-[60] p-3 sm:p-4 animate-in slide-in-from-bottom-4 duration-500">
      <div className="max-w-xl mx-auto bg-card border border-border rounded-xl shadow-2xl p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-lg shrink-0 mt-0.5"
            style={{ backgroundColor: `${resolvedPrimary}18` }}
          >
            <Cookie className="h-4 w-4" style={{ color: resolvedPrimary }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">{uiText.title}</p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              {uiText.description} {uiText.connector}{" "}
              <Link
                to={`${basePath}/legal/cookies`}
                className="underline hover:text-foreground"
                style={{ color: resolvedPrimary }}
              >
                {uiText.policy}
              </Link>.
            </p>
            <div className="flex items-center gap-2 mt-3">
              <Button
                size="sm"
                onClick={handleAccept}
                className="text-xs h-8 px-4 border-0"
                style={{ backgroundColor: resolvedBtnBg, color: resolvedBtnText }}
              >
                {uiText.accept}
              </Button>
              <Button size="sm" variant="ghost" onClick={handleDismiss} className="text-xs h-8 px-3 text-muted-foreground">
                {uiText.decline}
              </Button>
            </div>
          </div>
          <button onClick={handleDismiss} className="shrink-0 p-1 rounded-md hover:bg-muted transition-colors text-muted-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
