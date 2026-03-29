import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from "react";
import { pt } from "./locales/pt";
import { en } from "./locales/en";
import { es } from "./locales/es";

export type Locale = "pt" | "en" | "es";
export type TranslationKey = keyof typeof pt;

const locales: Record<Locale, Record<string, string>> = { pt, en, es };

const STORAGE_KEY = "app_language";

function getInitialLocale(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as Locale;
    if (saved && locales[saved]) return saved;
  } catch {}
  const browserLang = navigator.language?.slice(0, 2);
  if (browserLang === "es") return "es";
  if (browserLang === "en") return "en";
  return "pt";
}

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getInitialLocale);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try { localStorage.setItem(STORAGE_KEY, l); } catch {}
  }, []);

  const t = useCallback((key: TranslationKey, params?: Record<string, string | number>): string => {
    let text = locales[locale]?.[key] || locales.pt[key] || key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, String(v));
      });
    }
    return text;
  }, [locale]);

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

export const localeLabels: Record<Locale, string> = {
  pt: "🇧🇷 Português",
  en: "🇺🇸 English",
  es: "🇪🇸 Español",
};
