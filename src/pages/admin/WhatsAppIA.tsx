import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Bot, Zap, Settings, CheckCircle2, Loader2, ArrowRight, Lock } from "lucide-react";
import { useStoreSettings, useUpdateStoreSettings } from "@/hooks/useStoreSettings";
import { useTenantContext } from "@/hooks/useTenantContext";
import { canAccess } from "@/lib/planPermissions";
import { toast } from "sonner";
import { AITrainingAlert } from "@/components/admin/AITrainingAlert";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const RESPONSE_TEMPLATES = [
  { id: "greeting", label: "Saudação", example: "Olá! 👋 Bem-vindo à {loja}! Como posso te ajudar?" },
  { id: "product_info", label: "Info Produto", example: "O produto {produto} custa R${preco} e temos {estoque} em estoque!" },
  { id: "order_status", label: "Status Pedido", example: "Seu pedido #{pedido} está com status: {status}. Qualquer dúvida é só chamar!" },
  { id: "out_of_hours", label: "Fora do Horário", example: "Obrigado por entrar em contato! Nosso horário é das 9h às 18h. Retornaremos assim que possível! 🕐" },
];

export default function WhatsAppIA() {
  const { slug } = useParams();
  const { data: settings } = useStoreSettings();
  const updateSettings = useUpdateStoreSettings();
  const { ctx } = useTenantContext();
  const locked = !canAccess("ai_tools", ctx);

  const { data: aiConfig } = useQuery({
    queryKey: ["tenant-ai-brain-config", settings?.user_id],
    queryFn: async () => {
      const { data } = await supabase.from("tenant_ai_brain_config").select("niche").eq("user_id", settings!.user_id).maybeSingle();
      return data;
    },
    enabled: !!settings?.user_id,
  });

  const [enabled, setEnabled] = useState(false);
  const [autoReply, setAutoReply] = useState(true);
  const [greetingMsg, setGreetingMsg] = useState("Olá! 👋 Bem-vindo à nossa loja! Como posso te ajudar?");
  const [outOfHoursMsg, setOutOfHoursMsg] = useState("Obrigado por entrar em contato! Retornaremos em breve. 🕐");
  const [workHoursStart, setWorkHoursStart] = useState("09:00");
  const [workHoursEnd, setWorkHoursEnd] = useState("18:00");

  useEffect(() => {
    if (settings) {
      const s = settings as any;
      setEnabled(s.whatsapp_ai_enabled || false);
      setAutoReply(s.whatsapp_auto_reply !== false);
      setGreetingMsg(s.whatsapp_greeting || greetingMsg);
      setOutOfHoursMsg(s.whatsapp_out_of_hours || outOfHoursMsg);
      setWorkHoursStart(s.whatsapp_hours_start || "09:00");
      setWorkHoursEnd(s.whatsapp_hours_end || "18:00");
    }
  }, [settings]);

  const handleSave = async () => {
    if (!settings?.id) return;
    try {
      await updateSettings.mutateAsync({
        id: settings.id,
        whatsapp_ai_enabled: enabled,
        whatsapp_auto_reply: autoReply,
        whatsapp_greeting: greetingMsg,
        whatsapp_out_of_hours: outOfHoursMsg,
        whatsapp_hours_start: workHoursStart,
        whatsapp_hours_end: workHoursEnd,
      } as any);
      toast.success("Configurações do WhatsApp IA salvas!");
    } catch (e) {
      toast.error("Erro ao salvar configurações");
    }
  };

  if (locked) {
    return (
      <div className="p-4 md:p-6 flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Lock className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-xl font-bold text-foreground">WhatsApp IA Bloqueado</h2>
            <p className="text-sm text-muted-foreground">
              Enquanto você responde manual, seus concorrentes vendem no automático 24h. 
              Desbloqueie a IA para nunca mais perder um cliente no WhatsApp.
            </p>
            <Button className="gap-2" onClick={() => window.location.assign(`/painel/${slug}/plano?upgrade=PREMIUM`)}>
              <ArrowRight className="h-4 w-4" /> Desbloquear agora
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <MessageCircle className="h-6 w-6 text-green-500" />
            WhatsApp IA
          </h1>
          <p className="text-sm text-muted-foreground">Configure respostas automáticas inteligentes no WhatsApp</p>
        </div>
        <Badge variant={enabled ? "default" : "secondary"} className="gap-1">
          {enabled ? <CheckCircle2 className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
          {enabled ? "Ativo" : "Inativo"}
        </Badge>
      </div>

      {!aiConfig?.niche && (
        <AITrainingAlert />
      )}

      {/* Status Card */}
      <Card className="border-green-500/20 bg-green-500/5">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-green-500 flex items-center justify-center">
                <MessageCircle className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Atendente IA no WhatsApp</p>
                <p className="text-xs text-muted-foreground">Responde automaticamente sobre produtos, estoque e pedidos</p>
              </div>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>
        </CardContent>
      </Card>

      {/* Config */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              Respostas Automáticas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Auto-resposta ativada</Label>
              <Switch checked={autoReply} onCheckedChange={setAutoReply} />
            </div>
            <div className="space-y-2">
              <Label>Mensagem de Boas-vindas</Label>
              <Textarea
                value={greetingMsg}
                onChange={(e) => setGreetingMsg(e.target.value)}
                placeholder="Olá! 👋 Bem-vindo..."
                rows={3}
              />
              <p className="text-[10px] text-muted-foreground">
                Variáveis: {"{loja}"}, {"{produto}"}, {"{preco}"}, {"{estoque}"}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Mensagem Fora do Horário</Label>
              <Textarea
                value={outOfHoursMsg}
                onChange={(e) => setOutOfHoursMsg(e.target.value)}
                placeholder="Obrigado por entrar em contato..."
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Settings className="h-4 w-4 text-primary" />
              Horário de Atendimento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Início</Label>
                <Input type="time" value={workHoursStart} onChange={(e) => setWorkHoursStart(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Fim</Label>
                <Input type="time" value={workHoursEnd} onChange={(e) => setWorkHoursEnd(e.target.value)} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Fora desse horário, a IA envia a mensagem de "fora do horário" automaticamente.
            </p>

            <div className="border-t pt-4 space-y-3">
              <p className="text-sm font-medium text-foreground">Capacidades da IA:</p>
              <div className="space-y-2">
                {[
                  "Responder sobre produtos e preços",
                  "Informar estoque disponível",
                  "Consultar status de pedidos",
                  "Sugerir produtos similares",
                  "Calcular frete por CEP",
                  "Direcionar para checkout",
                ].map((cap, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                    <span className="text-xs text-muted-foreground">{cap}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Templates Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Templates de Resposta</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            {RESPONSE_TEMPLATES.map((t) => (
              <div key={t.id} className="rounded-lg border border-border p-3 bg-muted/30">
                <p className="text-xs font-medium text-primary mb-1">{t.label}</p>
                <p className="text-sm text-muted-foreground italic">"{t.example}"</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updateSettings.isPending} className="gap-2">
          {updateSettings.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Salvar Configurações
        </Button>
      </div>
    </div>
  );
}
