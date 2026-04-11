import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { pt, type TranslationKeys } from "./translations/pt";
import { en } from "./translations/en";
import { es } from "./translations/es";
import { fr } from "./translations/fr";

export type Locale = "pt" | "en" | "es" | "fr";

export const LOCALE_OPTIONS: { value: Locale; label: string; flag: string }[] = [
  { value: "pt", label: "Português", flag: "🇧🇷" },
  { value: "en", label: "English", flag: "🇺🇸" },
  { value: "es", label: "Español", flag: "🇪🇸" },
  { value: "fr", label: "Français", flag: "🇫🇷" },
];

const translations: Record<Locale, TranslationKeys> = { pt, en, es, fr };

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: TranslationKeys;
}

const I18nContext = createContext<I18nContextType>({
  locale: "pt",
  setLocale: () => {},
  t: pt,
});

export function I18nProvider({ children, defaultLocale }: { children: ReactNode; defaultLocale?: Locale }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (defaultLocale) return defaultLocale;
    const stored = localStorage.getItem("app_language") as Locale | null;
    return stored && translations[stored] ? stored : "pt";
  });

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem("app_language", newLocale);
    document.documentElement.lang = newLocale === "pt" ? "pt-BR" : newLocale;
  }, []);

  // Sync with external changes (e.g. store settings)
  useEffect(() => {
    if (defaultLocale && defaultLocale !== locale) {
      setLocaleState(defaultLocale);
    }
  }, [defaultLocale]);

  useEffect(() => {
    document.documentElement.lang = locale === "pt" ? "pt-BR" : locale;
  }, [locale]);

  const t = translations[locale] || pt;

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  return useContext(I18nContext);
}

export type { TranslationKeys };
