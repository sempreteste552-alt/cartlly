import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Settings2, Sparkles, Brain, Bot, Image as ImageIcon, BookOpen,
  Megaphone, Ticket, Languages, Database, ShoppingBag, MessageSquare,
  Lock, Check, Crown, ArrowUpCircle,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { AINav } from "@/components/admin/AINav";
import { AITrainingGuide } from "@/components/admin/AITrainingGuide";
import { useTenantContext } from "@/hooks/useTenantContext";
import { planLevel, type PlanSlug } from "@/lib/planPermissions";

type AIFeature = {
  key: string;
  label: string;
  desc: string;
  icon: any;
  minPlan: PlanSlug;
};

const FEATURES: AIFeature[] = [
  { key: "is_ai_enabled",            label: "IA Geral",                    desc: "Núcleo de inteligência artificial da sua loja.",          icon: Sparkles,      minPlan: "STARTER" },
  { key: "product_ai_enabled",       label: "IA para produtos",            desc: "Geração de descrição, SEO e análise de imagem.",          icon: ShoppingBag,   minPlan: "STARTER" },
  { key: "catalog_ai_enabled",       label: "Importação por catálogo",     desc: "IA lê seu catálogo e cadastra produtos.",                 icon: BookOpen,      minPlan: "PRO" },
  { key: "storefront_chat_enabled",  label: "Chat IA na vitrine",          desc: "Atendimento automatizado para seus clientes.",            icon: MessageSquare, minPlan: "PREMIUM" },
  { key: "admin_assistant_enabled",  label: "Assistente do painel",        desc: "IA que te ajuda a configurar e operar a loja.",           icon: Bot,           minPlan: "STARTER" },
  { key: "ceo_brain_enabled",        label: "CEO Brain",                   desc: "Análise diária com sugestões estratégicas.",              icon: Brain,         minPlan: "PREMIUM" },
  { key: "push_ai_enabled",          label: "Push notifications com IA",   desc: "Mensagens personalizadas geradas por IA.",                icon: Megaphone,     minPlan: "PRO" },
  { key: "coupons_ai_enabled",       label: "Cupons inteligentes",         desc: "Sugestão e disparo automático de cupons.",                icon: Ticket,        minPlan: "PRO" },
  { key: "translation_ai_enabled",   label: "Tradução automática",         desc: "Conteúdo da loja em múltiplos idiomas.",                  icon: Languages,     minPlan: "PREMIUM" },
  { key: "is_image_gen_enabled",     label: "Geração de imagens",          desc: "Banners, fotos de produto e arte com IA.",                icon: ImageIcon,     minPlan: "PRO" },
  { key: "rag_memory_enabled",       label: "Memória RAG",                 desc: "IA aprende com sua loja para respostas melhores.",        icon: Database,      minPlan: "PREMIUM" },
];

const PLAN_LABEL: Record<PlanSlug, string> = {
  FREE: "Free", STARTER: "Starter", PRO: "Pro", PREMIUM: "Premium",
};

export default function AdminAIFeatures() {
  const { slug } = useParams();
  const { ctx, plan: currentPlan } = useTenantContext();
  const planSlug = (ctx?.planSlug ?? "FREE") as PlanSlug;
  const planUrl = slug ? `/painel/${slug}/plano` : "#";
  const usageUrl = slug ? `/painel/${slug}/ai/usage` : "#";

  const { data: settings, isLoading } = useQuery({
    queryKey: ["ai-tenant-settings-self"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("not authenticated");
      const { data } = await supabase
        .from("tenant_ai_settings")
        .select("*")
        .eq("tenant_id", user.id)
        .maybeSingle();
      return data;
    },
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <AINav current="features" />

      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
          <Settings2 className="h-7 w-7 text-primary" />
          Recursos de IA
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Veja quais inteligências estão disponíveis no seu plano. A ativação é gerenciada pelo time da plataforma.
        </p>
      </div>

      {/* Plano atual */}
      <Card className="border-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
        <CardContent className="p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/15">
              <Crown className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Seu plano atual</div>
              <div className="font-bold text-base">{currentPlan?.name || PLAN_LABEL[planSlug]}</div>
            </div>
          </div>
          {planSlug !== "PREMIUM" && (
            <Button asChild size="sm" className="gap-2">
              <Link to={planUrl}>
                <ArrowUpCircle className="h-4 w-4" />
                Fazer upgrade
              </Link>
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Treinamento */}
      <AITrainingGuide />

      {/* Lista de recursos (somente leitura) */}
      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            const inPlan = planLevel(planSlug) >= planLevel(f.minPlan);
            const enabled = (settings as any)?.[f.key] ?? inPlan;
            const active = inPlan && enabled;

            return (
              <Card
                key={f.key}
                className={
                  active
                    ? "border-primary/30"
                    : inPlan
                      ? "opacity-80"
                      : "opacity-70 border-dashed"
                }
              >
                <CardContent className="p-4 flex items-start justify-between gap-3">
                  <div className="flex gap-3 min-w-0">
                    <div className={`p-2 rounded-lg shrink-0 ${active ? "bg-primary/10" : "bg-muted"}`}>
                      {inPlan ? (
                        <Icon className={`h-5 w-5 ${active ? "text-primary" : "text-muted-foreground"}`} />
                      ) : (
                        <Lock className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-sm flex items-center gap-2 flex-wrap">
                        {f.label}
                        {!inPlan && (
                          <Badge variant="outline" className="text-[10px] gap-1">
                            <Lock className="h-2.5 w-2.5" />
                            {PLAN_LABEL[f.minPlan]}+
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{f.desc}</p>
                    </div>
                  </div>

                  <div className="shrink-0">
                    {active ? (
                      <Badge className="bg-primary/15 text-primary border-primary/30 gap-1">
                        <Check className="h-3 w-3" /> Ativo
                      </Badge>
                    ) : inPlan ? (
                      <Badge variant="secondary" className="text-[10px]">Inativo</Badge>
                    ) : (
                      <Button asChild size="sm" variant="outline" className="h-7 text-xs gap-1">
                        <Link to={`${planUrl}?upgrade=${f.minPlan}`}>
                          <ArrowUpCircle className="h-3 w-3" />
                          Upgrade
                        </Link>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Aviso sobre limites */}
      <Card className="border-muted bg-muted/30">
        <CardHeader>
          <CardTitle className="text-base">Limites e bloqueios</CardTitle>
          <CardDescription>
            Os limites mensais de uso de IA, alertas automáticos e bloqueio rígido são definidos pela
            equipe da plataforma de acordo com o seu plano. Acompanhe o seu consumo na aba{" "}
            <Link to={slug ? `/painel/${slug}/ai/usage` : "/admin/ai/usage"} className="underline font-medium">
              Consumo
            </Link>
            .
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
