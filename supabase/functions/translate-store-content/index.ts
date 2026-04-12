import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { texts, targetLocale = "pt", sourceLocale = "pt" } = await req.json();

    if (!Array.isArray(texts)) {
      return new Response(JSON.stringify({ error: "texts must be an array" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sanitizedTexts = texts.map((text) => (typeof text === "string" ? text : ""));

    if (targetLocale === "pt" || sanitizedTexts.every((text) => !text.trim())) {
      return new Response(JSON.stringify({ translations: sanitizedTexts }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ translations: sanitizedTexts }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content: `Translate each input text from ${LOCALE_LABELS[sourceLocale] || sourceLocale} to ${LOCALE_LABELS[targetLocale] || targetLocale}. Preserve tone, HTML tags, markdown, line breaks, placeholders, emojis, URLs, coupon codes and brand/product names when appropriate. Return ONLY valid JSON in the format {"translations":["..."]} with exactly the same number of items as received.`,
          },
          {
            role: "user",
            content: JSON.stringify({ texts: sanitizedTexts }),
          },
        ],
      }),
    });

    if (!response.ok) {
      return new Response(JSON.stringify({ translations: sanitizedTexts }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    const content = result?.choices?.[0]?.message?.content || "";
    const translations = extractTranslations(content, sanitizedTexts);

    return new Response(JSON.stringify({ translations }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("translate-store-content error:", error);
    return new Response(JSON.stringify({ error: "Unexpected translation error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});