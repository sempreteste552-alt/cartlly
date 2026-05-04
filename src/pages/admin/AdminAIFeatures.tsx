import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Settings2, Sparkles, Brain, Bot, Image as ImageIcon, BookOpen, Megaphone, Ticket, Languages, Database, ShoppingBag, MessageSquare, Bell, Mail, Smartphone, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { AINav } from "@/components/admin/AINav";

const FEATURES: { key: string; label: string; desc: string; icon: any }[] = [
  { key: "is_ai_enabled", label: "IA Geral", desc: "Liga ou desliga TODA a inteligência artificial da sua loja.", icon: Sparkles },
  { key: "product_ai_enabled", label: "IA para produtos", desc: "Geração de descrição, SEO, análise de imagem.", icon: ShoppingBag },
  { key: "catalog_ai_enabled", label: "Importação por catálogo", desc: "IA lê seu catálogo e cadastra produtos.", icon: BookOpen },
  { key: "storefront_chat_enabled", label: "Chat IA na vitrine", desc: "Atendimento automatizado para seus clientes.", icon: MessageSquare },
  { key: "admin_assistant_enabled", label: "Assistente do painel", desc: "IA que te ajuda a configurar e operar a loja.", icon: Bot },
  { key: "ceo_brain_enabled", label: "CEO Brain", desc: "Análise diária com sugestões estratégicas.", icon: Brain },
  { key: "push_ai_enabled", label: "Push notifications com IA", desc: "Mensagens personalizadas geradas por IA.", icon: Megaphone },
  { key: "coupons_ai_enabled", label: "Cupons inteligentes", desc: "Sugestão e disparo automático de cupons.", icon: Ticket },
  { key: "translation_ai_enabled", label: "Tradução automática", desc: "Conteúdo da loja em múltiplos idiomas.", icon: Languages },
  { key: "is_image_gen_enabled", label: "Geração de imagens", desc: "Banners, fotos de produto e arte com IA.", icon: ImageIcon },
  { key: "rag_memory_enabled", label: "Memória RAG", desc: "IA aprende com sua loja para respostas melhores.", icon: Database },
];

export default function AdminAIFeatures() {
  const qc = useQueryClient();
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
      if (data) return data;
      const { data: created } = await supabase
        .from("tenant_ai_settings")
        .insert({ tenant_id: user.id })
        .select()
        .single();
      return created;
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("not authenticated");
      const { error } = await supabase
        .from("tenant_ai_settings")
        .update({ [key]: value })
        .eq("tenant_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai-tenant-settings-self"] });
      toast.success("Configuração atualizada");
    },
    onError: (e: any) => toast.error(e.message),
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
          Ative ou desative cada inteligência da sua loja. Desligar reduz consumo de créditos.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            const value = (settings as any)?.[f.key] ?? true;
            return (
              <Card key={f.key} className={value ? "border-primary/30" : "opacity-70"}>
                <CardContent className="p-4 flex items-start justify-between gap-3">
                  <div className="flex gap-3">
                    <div className={`p-2 rounded-lg shrink-0 ${value ? "bg-primary/10" : "bg-muted"}`}>
                      <Icon className={`h-5 w-5 ${value ? "text-primary" : "text-muted-foreground"}`} />
                    </div>
                    <div>
                      <div className="font-semibold text-sm">{f.label}</div>
                      <p className="text-xs text-muted-foreground mt-0.5">{f.desc}</p>
                    </div>
                  </div>
                  <Switch
                    checked={!!value}
                    onCheckedChange={(v) => toggle.mutate({ key: f.key, value: v })}
                    disabled={toggle.isPending}
                  />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardHeader>
          <CardTitle className="text-base">Limites e bloqueio progressivo</CardTitle>
          <CardDescription>
            Quando seu uso de IA chegar perto do limite mensal, alertas serão exibidos. Aos 100%,
            se "limite rígido" estiver ligado, novas chamadas são bloqueadas até o próximo período ou upgrade.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <ToggleRow
            label="Limite rígido (bloquear ao atingir 100%)"
            description="Se desativado, chamadas excedentes são permitidas e podem gerar custo extra."
            value={(settings as any)?.hard_limit_enabled ?? false}
            onChange={(v) => toggle.mutate({ key: "hard_limit_enabled", value: v })}
          />
          <ToggleRow
            label="Receber alertas de uso (50%, 75%, 90%, 100%)"
            description="Avisos no painel quando se aproximar do limite."
            value={(settings as any)?.soft_limit_alerts_enabled ?? true}
            onChange={(v) => toggle.mutate({ key: "soft_limit_alerts_enabled", value: v })}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function ToggleRow({ label, description, value, onChange }: { label: string; description: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-3 p-3 rounded-lg border bg-background">
      <div>
        <div className="font-medium text-sm">{label}</div>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <Switch checked={value} onCheckedChange={onChange} />
    </div>
  );
}
