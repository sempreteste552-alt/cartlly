import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation, type Locale } from "@/i18n";

type NullableText = string | null | undefined;

const CACHE_PREFIX = "store-translation";

const buildCacheKey = (locale: Locale, text: string) => `${CACHE_PREFIX}:${locale}:${encodeURIComponent(text).slice(0, 240)}`;

async function translateTexts(texts: string[], locale: Locale) {
  if (!texts.length || locale === "pt") {
    return texts;
  }

  const { data, error } = await supabase.functions.invoke("translate-store-content", {
    body: {
      texts,
      targetLocale: locale,
      sourceLocale: "pt",
    },
  });

  if (error) throw error;

  const translations = Array.isArray(data?.translations) ? data.translations : [];
  return texts.map((text, index) => translations[index] || text);
}

export function useLocalizedTextList(texts: NullableText[]) {
  const { locale } = useTranslation();
  const signature = JSON.stringify(texts);

  const normalizedTexts = useMemo(
    () => texts.map((text) => (typeof text === "string" ? text : "")),
    [signature]
  );

  const translatableTexts = useMemo(
    () => normalizedTexts.map((text) => text.trim()).filter(Boolean),
    [normalizedTexts]
  );

  const { data } = useQuery({
    queryKey: ["store-content-translation", locale, translatableTexts],
    enabled: locale !== "pt" && translatableTexts.length > 0,
    staleTime: 1000 * 60 * 60 * 12,
    queryFn: async () => {
      const uniqueTexts = [...new Set(translatableTexts)];
      const translationMap = new Map<string, string>();
      const pendingTexts: string[] = [];

      uniqueTexts.forEach((text) => {
        const cached = localStorage.getItem(buildCacheKey(locale, text));
        if (cached) {
          translationMap.set(text, cached);
        } else {
          pendingTexts.push(text);
        }
      });

      if (pendingTexts.length > 0) {
        const translated = await translateTexts(pendingTexts, locale);
        pendingTexts.forEach((text, index) => {
          const value = translated[index] || text;
          translationMap.set(text, value);
          localStorage.setItem(buildCacheKey(locale, text), value);
        });
      }

      return normalizedTexts.map((text) => {
        const trimmed = text.trim();
        return trimmed ? translationMap.get(trimmed) || text : text;
      });
    },
  });

  return locale === "pt" ? normalizedTexts : data || normalizedTexts;
}

export function useLocalizedText(text: NullableText) {
  const [translated] = useLocalizedTextList([text]);
  return translated || "";
}