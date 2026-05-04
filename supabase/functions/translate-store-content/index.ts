import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAI, aiErrorToResponse } from "../_shared/ai-service.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOCALE_LABELS: Record<string, string> = {
  pt: "Português do Brasil",
  en: "English",
  es: "Español",
  fr: "Français",
};

function extractTranslations(content: string, fallback: string[]) {
  const cleaned = content
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  const candidates = [cleaned];
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) candidates.push(jsonMatch[0]);

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (Array.isArray(parsed?.translations)) {
        return fallback.map((text, index) => parsed.translations[index] || text);
      }
    } catch {
      continue;
    }
  }
  return fallback;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { texts, targetLocale = "pt", sourceLocale = "pt", store_user_id } = await req.json();

    if (!Array.isArray(texts)) {
      return new Response(JSON.stringify({ error: "texts must be an array" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sanitizedTexts = texts.map((t) => (typeof t === "string" ? t : ""));
    if (targetLocale === "pt" || sanitizedTexts.every((t) => !t.trim())) {
      return new Response(JSON.stringify({ translations: sanitizedTexts }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await callAI({
      model: "google/gemini-2.5-flash-lite",
      temperature: 0.2,
      feature: "translate_content",
      store_user_id,
      messages: [
        {
          role: "system",
          content: `Translate each input text from ${LOCALE_LABELS[sourceLocale] || sourceLocale} to ${LOCALE_LABELS[targetLocale] || targetLocale}. Preserve tone, HTML tags, markdown, line breaks, placeholders, emojis, URLs, coupon codes and brand/product names when appropriate. Return ONLY valid JSON in the format {"translations":["..."]} with exactly the same number of items as received.`,
        },
        { role: "user", content: JSON.stringify({ texts: sanitizedTexts }) },
      ],
    });

    if (result instanceof Response) {
      return new Response(JSON.stringify({ translations: sanitizedTexts }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const translations = extractTranslations(result.content, sanitizedTexts);
    return new Response(JSON.stringify({ translations }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("translate-store-content error:", error);
    // Sempre retorna fallback para não quebrar a UI
    try {
      const body = await req.clone().json().catch(() => ({}));
      return new Response(JSON.stringify({ translations: body.texts || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch {
      return aiErrorToResponse(error, corsHeaders);
    }
  }
});
