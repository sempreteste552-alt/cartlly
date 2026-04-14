import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Crown, Sparkles, Clock, ArrowRight, CheckCircle2,
  Package, Palette, CreditCard, Settings, Rocket, Star, X,
} from "lucide-react";
import { useTenantContext } from "@/hooks/useTenantContext";
import { useProducts } from "@/hooks/useProducts";
import { useStoreSettings } from "@/hooks/useStoreSettings";
import { useAuth } from "@/contexts/AuthContext";
import confetti from "canvas-confetti";

const CHECKLIST = [
  { key: "products", label: "Adicionar produtos", icon: Package, check: (p: number) => p > 0 },
  { key: "settings", label: "Configurar loja", icon: Settings, check: (_: number, s: any) => !!s?.store_name && s.store_name !== "Minha Loja" },
  { key: "design", label: "Personalizar visual", icon: Palette, check: (_: number, s: any) => s?.primary_color !== "#6d28d9" },
  { key: "ai", label: "Treinar Cérebro IA", icon: Sparkles, check: (_: number, s: any) => !!s?.ai_trained },
  { key: "payment", label: "Configurar pagamento", icon: CreditCard, check: (_: number, s: any) => !!s?.payment_gateway },
];

const { slug } = useParams();
  const { user } = useAuth();
  const { ctx } = useTenantContext();
  const { data: products } = useProducts();
  const { data: settings } = useStoreSettings();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);
  const [hasConfetti, setHasConfetti] = useState(false);

  const isNewTrial = ctx.isTrial && !ctx.isTrialExpired && ctx.trialDaysLeft >= 5;
  const storageKey = "welcome_trial_dismissed";

  useEffect(() => {
    if (localStorage.getItem(storageKey)) setDismissed(true);
  }, []);

  useEffect(() => {
    if (isNewTrial && !dismissed && !hasConfetti) {
      setHasConfetti(true);
      const end = Date.now() + 1500;
      const frame = () => {
        confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0, y: 0.6 }, colors: ["#6d28d9", "#3b82f6", "#10b981", "#f59e0b"] });
        confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1, y: 0.6 }, colors: ["#6d28d9", "#3b82f6", "#10b981", "#f59e0b"] });
        if (Date.now() < end) requestAnimationFrame(frame);
      };
      frame();
    }
  }, [isNewTrial, dismissed, hasConfetti]);

  if (!isNewTrial || dismissed) return null;

  const pCount = products?.length ?? 0;
  
  // Extend settings with AI training status for checklist
  const { data: aiConfig } = useQuery({
    queryKey: ["tenant-ai-brain-config", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("tenant_ai_brain_config").select("niche").eq("user_id", user!.id).maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  const augmentedSettings = { 
    ...settings, 
    ai_trained: !!aiConfig?.niche 
  };

  const completed = CHECKLIST.filter((c) => c.check(pCount, augmentedSettings)).length;
  const progress = (completed / CHECKLIST.length) * 100;

  const handleDismiss = () => {
    localStorage.setItem(storageKey, "1");
    setDismissed(true);
  };

  return (
    <Card className="relative overflow-hidden border-primary/30 bg-gradient-to-br from-primary/[0.08] via-primary/[0.03] to-transparent shadow-lg">
      {/* Decorative elements */}
      <div className="absolute top-0 right-0 w-40 h-40 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-primary/5 rounded-full translate-y-1/2 -translate-x-1/2" />
      
      <button onClick={handleDismiss} className="absolute top-3 right-3 z-10 p-1 rounded-full hover:bg-muted/50 text-muted-foreground">
        <X className="h-4 w-4" />
      </button>

      <CardContent className="p-5 sm:p-6 relative">
        {/* Header */}
        <div className="flex items-start gap-4 mb-5">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shrink-0">
            <Crown className="h-7 w-7 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-foreground">🎉 Bem-vindo ao Cartlly!</h2>
              <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] border-0 shadow-sm">
                <Sparkles className="h-3 w-3 mr-1" /> PREMIUM
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Você tem <strong className="text-primary">{ctx.trialDaysLeft} dias grátis</strong> com{" "}
              <strong>todos os recursos Premium</strong> desbloqueados!
            </p>
          </div>
        </div>

        {/* Trial countdown */}
        <div className="rounded-xl bg-card border border-border/60 p-4 mb-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-primary" /> Período de Teste Premium
            </span>
            <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">
              {ctx.trialDaysLeft} de 7 dias
            </Badge>
          </div>
          <Progress value={((7 - ctx.trialDaysLeft) / 7) * 100} className="h-2 mb-2" />
          <p className="text-[11px] text-muted-foreground">
            Após o teste, funcionalidades premium serão bloqueadas e o limite volta para 10 produtos.
          </p>
        </div>

        {/* Premium features unlocked */}
        <div className="rounded-xl bg-primary/[0.04] border border-primary/10 p-4 mb-5">
          <p className="text-xs font-semibold text-foreground mb-3 flex items-center gap-1.5">
            <Star className="h-3.5 w-3.5 text-amber-500" /> Recursos desbloqueados durante o teste:
          </p>
          <div className="grid grid-cols-2 gap-2">
            {[
              "Produtos Ilimitados", "Gateway de Pagamento", "Cupons de Desconto",
              "Temas Premium", "Editor da Home", "Domínio Próprio",
              "IA de Conteúdo", "Analytics Avançado",
            ].map((f) => (
              <div key={f} className="flex items-center gap-1.5 text-xs">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                <span className="text-foreground/80">{f}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Checklist */}
        <div className="rounded-xl bg-card border border-border/60 p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Rocket className="h-3.5 w-3.5 text-primary" /> Comece agora:
            </p>
            <Badge variant="outline" className="text-[10px]">{completed}/{CHECKLIST.length}</Badge>
          </div>
          <div className="space-y-2">
            {CHECKLIST.map((item) => {
              const done = item.check(pCount, augmentedSettings);
              return (
                <div key={item.key} className={`flex items-center gap-2.5 text-sm rounded-lg px-2.5 py-1.5 transition-colors ${done ? "bg-green-500/5" : "hover:bg-muted/50 cursor-pointer"}`} onClick={() => !done && navigate(item.key === 'ai' ? '/admin/cerebro' : '/admin/configuracoes')}>
                  {done
                    ? <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                    : <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30 shrink-0" />
                  }
                  <span className={done ? "text-muted-foreground line-through" : "text-foreground"}>{item.label}</span>
                </div>
              );
            })}
          </div>
          {progress === 100 && (
            <p className="text-xs text-green-600 font-semibold mt-2 text-center">✅ Tudo configurado! Sua loja está pronta.</p>
          )}
        </div>

        {/* CTA */}
        <div className="flex gap-3">
          <Button size="sm" onClick={() => navigate(`/painel/${slug}/produtos`)} className="flex-1 gap-1.5">
            <Package className="h-3.5 w-3.5" /> Adicionar Produtos
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate(`/painel/${slug}/plano`)} className="gap-1.5 shrink-0">
            <Crown className="h-3.5 w-3.5" /> Ver Planos
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
