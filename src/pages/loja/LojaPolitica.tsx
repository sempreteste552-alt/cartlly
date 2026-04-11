import { useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useLojaContext } from "@/pages/loja/LojaLayout";
import { usePublicStorePolicies } from "@/hooks/useStorePolicies";
import { useTranslation } from "@/i18n";
import { useLocalizedText } from "@/hooks/useLocalizedStoreText";

const POLICY_MAP: Record<string, { key: "privacy_policy" | "terms_of_service" | "cookie_policy" }> = {
  "politica-de-privacidade": { key: "privacy_policy" },
  "termos-de-uso": { key: "terms_of_service" },
  "cookies": { key: "cookie_policy" },
};

export default function LojaPolitica() {
  const { locale } = useTranslation();
  const { policySlug } = useParams<{ policySlug: string }>();
  const { settings } = useLojaContext();
  const { data: policies, isLoading } = usePublicStorePolicies(settings?.user_id);

  const meta = policySlug ? POLICY_MAP[policySlug] : null;
  const content = meta && policies ? (policies as any)[meta.key] : null;
  const localizedContent = useLocalizedText(content);
  const policyTitleMap = {
    privacy_policy: locale === "pt" ? "Política de Privacidade" : locale === "en" ? "Privacy Policy" : locale === "es" ? "Política de Privacidad" : "Politique de confidentialité",
    terms_of_service: locale === "pt" ? "Termos de Uso" : locale === "en" ? "Terms of Use" : locale === "es" ? "Términos de Uso" : "Conditions d'utilisation",
    cookie_policy: locale === "pt" ? "Política de Cookies" : locale === "en" ? "Cookie Policy" : locale === "es" ? "Política de Cookies" : "Politique de cookies",
  };
  const uiText = {
    notFound: locale === "pt" ? "Página não encontrada" : locale === "en" ? "Page not found" : locale === "es" ? "Página no encontrada" : "Page introuvable",
    empty: locale === "pt" ? "Esta política ainda não foi definida pelo lojista." : locale === "en" ? "This policy has not been defined by the store owner yet." : locale === "es" ? "Esta política aún no fue definida por la tienda." : "Cette politique n'a pas encore été définie par la boutique.",
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!meta) {
    return (
      <div className="max-w-3xl mx-auto py-16 px-4 text-center">
        <h1 className="text-2xl font-bold text-foreground">{uiText.notFound}</h1>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-8 sm:py-12 px-4">
      <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-6">{policyTitleMap[meta.key]}</h1>
      <div className="prose prose-sm dark:prose-invert max-w-none">
        <ReactMarkdown>{localizedContent || uiText.empty}</ReactMarkdown>
      </div>
    </div>
  );
}
