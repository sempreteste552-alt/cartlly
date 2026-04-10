import { useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useLojaContext } from "@/pages/loja/LojaLayout";
import { usePublicStorePolicies } from "@/hooks/useStorePolicies";

const POLICY_MAP: Record<string, { key: "privacy_policy" | "terms_of_service" | "cookie_policy"; title: string }> = {
  "politica-de-privacidade": { key: "privacy_policy", title: "Política de Privacidade" },
  "termos-de-uso": { key: "terms_of_service", title: "Termos de Uso" },
  "cookies": { key: "cookie_policy", title: "Política de Cookies" },
};

export default function LojaPolitica() {
  const { policySlug } = useParams<{ policySlug: string }>();
  const { settings } = useLojaContext();
  const { data: policies, isLoading } = usePublicStorePolicies(settings?.user_id);

  const meta = policySlug ? POLICY_MAP[policySlug] : null;
  const content = meta && policies ? (policies as any)[meta.key] : null;
  const storeName = settings?.store_name || "Loja";

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
        <h1 className="text-2xl font-bold text-foreground">Página não encontrada</h1>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-8 sm:py-12 px-4">
      <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-6">{meta.title}</h1>
      <div className="prose prose-sm dark:prose-invert max-w-none">
        <ReactMarkdown>{content || "Esta política ainda não foi definida pelo lojista."}</ReactMarkdown>
      </div>
    </div>
  );
}
