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

export const isLocale = (value: string | null | undefined): value is Locale =>
  !!value && value in translations;

export const getLocaleTag = (locale: Locale) => {
  switch (locale) {
    case "en":
      return "en-US";
    case "es":
      return "es-ES";
    case "fr":
      return "fr-FR";
    default:
      return "pt-BR";
  }
};

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
    if (defaultLocale && isLocale(defaultLocale)) return defaultLocale;
    const stored = localStorage.getItem("app_language") as Locale | null;
    return isLocale(stored) ? stored : "pt";
  });

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem("app_language", newLocale);
    document.documentElement.lang = getLocaleTag(newLocale);
  }, []);

  // Sync with external changes (e.g. store settings)
  useEffect(() => {
    if (defaultLocale && defaultLocale !== locale) {
      setLocale(defaultLocale);
    }
  }, [defaultLocale, locale, setLocale]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== "app_language") return;
      if (!isLocale(event.newValue)) return;
      setLocaleState(event.newValue);
      document.documentElement.lang = getLocaleTag(event.newValue);
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    document.documentElement.lang = getLocaleTag(locale);
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
