import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTenantContext } from "@/hooks/useTenantContext";
import { PlanGate } from "@/components/PlanGate";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Bot, Send, Trash2, Brain, Sparkles, Clock, AlertTriangle, CheckCircle2, Bell, Users, Megaphone, Settings2, Save } from "lucide-react";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { AITrainingGuide } from "@/components/admin/AITrainingGuide";
import { AITrainingAlert } from "@/components/admin/AITrainingAlert";

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

function PushLogPanel({ userId, eventType, emptyText }: { userId?: string; eventType: string; emptyText: string }) {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["push-logs", userId, eventType],
    queryFn: async () => {
      if (eventType === "ceo_insight") {
        const { data, error } = await supabase
          .from("admin_notifications")
          .select("id, title, message, type, created_at")
          .eq("target_user_id", userId!)
          .eq("type", "ceo_insight")
          .order("created_at", { ascending: false })
          .limit(20);
        if (error) throw error;
        return (data || []).map((n: any) => ({
          id: n.id,
          title: n.title,
          body: n.message,
          status: "sent",
          created_at: n.created_at,
          trigger_type: "ceo_brain",
          event_type: "ceo_insight",
        }));
      }

      if (eventType === "customer") {
        // Customer pushes: all push_logs sent TO customers of this store
        const { data, error } = await supabase
          .from("push_logs")
          .select("id, title, body, status, created_at, customer_id, trigger_type, event_type")
          .eq("store_user_id", userId!)
          .not("customer_id", "is", null)
          .order("created_at", { ascending: false })
          .limit(30);
        if (error) throw error;
        return data as any[];
      }

      let query = supabase
        .from("push_logs")
        .select("id, title, body, status, created_at, customer_id, trigger_type, event_type")
        .order("created_at", { ascending: false })
        .limit(20);

      if (eventType === "motivational_push") {
        query = query.eq("user_id", userId!).eq("event_type", "motivational_push");
      } else {
        query = query.eq("store_user_id", userId!).neq("event_type", "motivational_push");
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as any[];
    },
    enabled: !!userId,
    refetchInterval: 30000,
  });

  return (
    <Card className="h-full">
      <CardContent className="px-3 py-3">
        <ScrollArea className="h-[300px]">
          <div className="space-y-2">
            {isLoading ? (
              <p className="text-xs text-muted-foreground text-center py-4">Carregando...</p>
            ) : logs.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">{emptyText}</p>
            ) : logs.map(log => (
              <div key={log.id} className="p-2 rounded-lg border text-xs space-y-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="font-semibold text-foreground line-clamp-1 flex-1">{log.title}</span>
                  <Badge variant={log.status === "sent" ? "default" : "secondary"} className="text-[8px] shrink-0">
                    {log.status === "sent" ? "✅" : log.status}
                  </Badge>
                </div>
                <p className="text-muted-foreground line-clamp-2">{log.body}</p>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span title={format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}>
                    {format(new Date(log.created_at), "dd/MM HH:mm", { locale: ptBR })} · {formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: ptBR })}
                  </span>
                  {log.trigger_type && <Badge variant="outline" className="text-[8px]">{log.trigger_type}</Badge>}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function ChatPanel({ chatHistory, sendMessage, pendingActions, confirmAction, input, setInput, handleSend, scrollRef }: {
  chatHistory: any[]; sendMessage: any; pendingActions: Record<number, any[]>; confirmAction: (i: number, a: number) => void;
  input: string; setInput: (v: string) => void; handleSend: () => void; scrollRef: React.RefObject<HTMLDivElement>;
}) {
  const formatMessageContent = (content: string) => {
    // Remove action tags for cleaner display
    return content
      .replace(/\[ACTION_SCHEDULE_TASK\][\s\S]*?\[\/ACTION_SCHEDULE_TASK\]/g, "")
      .replace(/\[ACTION_CREATE_COUPON\][\s\S]*?\[\/ACTION_CREATE_COUPON\]/g, "")
      .replace(/\[ACTION_UPDATE_STORE_SETTINGS\][\s\S]*?\[\/ACTION_UPDATE_STORE_SETTINGS\]/g, "")
      .replace(/\[ACTION_UPDATE_MARKETING_CONFIG\][\s\S]*?\[\/ACTION_UPDATE_MARKETING_CONFIG\]/g, "")
      .replace(/\[ACTION_UPDATE_STOCK\][\s\S]*?\[\/ACTION_UPDATE_STOCK\]/g, "")
      .replace(/\[ACTION_UPDATE_PAGE\][\s\S]*?\[\/ACTION_UPDATE_PAGE\]/g, "")
      .replace(/\[ACTION_SCHEDULE_REMINDER\][\s\S]*?\[\/ACTION_SCHEDULE_REMINDER\]/g, "")
      .replace(/\[ACTION_UPDATE_AI_INSTRUCTIONS\][\s\S]*?\[\/ACTION_UPDATE_AI_INSTRUCTIONS\]/g, "")
      .replace(/\[ACTION_GENERATE_PRODUCT_CONTENT\][\s\S]*?\[\/ACTION_GENERATE_PRODUCT_CONTENT\]/g, "")
      .trim();
  };

  return (
    <Card className="flex flex-col border-primary/20 bg-primary/5 h-[450px] sm:h-[500px]">
      <CardHeader className="py-2 border-b bg-card">
        <CardTitle className="text-sm flex items-center gap-2">
          <Bot className="h-4 w-4 text-primary" /> Conversa com Gerente IA
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0 relative">
        <ScrollArea className="h-full p-3">
          <div className="space-y-3">
            {chatHistory.length === 0 && !sendMessage.isPending && (
              <div className="text-center py-8 space-y-3">
                <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Como posso ajudar sua loja?</h3>
                  <p className="text-xs text-muted-foreground max-w-xs mx-auto mt-1">
                    Vendas, notificações, análises e mais.
                  </p>
                </div>
              </div>
            )}
            {chatHistory.map((msg: any, i: number) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
                  msg.role === 'user' ? 'bg-primary text-primary-foreground rounded-tr-none' : 'bg-card border shadow-sm rounded-tl-none'
                }`}>
                  {formatMessageContent(msg.content)}
                  {pendingActions[i]?.map((action: any, aidx: number) => (
                    <div key={aidx} className="mt-2 bg-muted/50 p-2 rounded-lg border border-border/50">
                      <span className="text-[11px] font-medium leading-tight text-foreground block mb-1">{action.label}</span>
                      <Button size="sm" className="h-7 w-full text-[10px]" disabled={action.confirmed} onClick={() => confirmAction(i, aidx)}>
                        {action.confirmed ? "✅ Confirmado" : "Confirmar e Executar"}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {sendMessage.isPending && (
              <div className="flex justify-start">
                <div className="bg-card border shadow-sm rounded-2xl px-4 py-3 flex gap-1">
                  <span className="h-1.5 w-1.5 bg-primary rounded-full animate-bounce"></span>
                  <span className="h-1.5 w-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                  <span className="h-1.5 w-1.5 bg-primary rounded-full animate-bounce"></span>
                </div>
              </div>
            )}
            <div ref={scrollRef} />
          </div>
        </ScrollArea>
      </CardContent>
      <CardFooter className="p-2 border-t bg-card">
        <div className="flex w-full gap-2">
          <Input placeholder="Fale com a IA..." value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()} className="flex-1 h-9 text-sm" />
          <Button size="icon" className="h-9 w-9" onClick={handleSend} disabled={sendMessage.isPending || !input.trim()}><Send className="h-4 w-4" /></Button>
        </div>
      </CardFooter>
    </Card>
  );
}

const NICHE_OPTIONS = [
  "Moda Feminina", "Moda Masculina", "Moda Infantil", "Acessórios",
  "Calçados", "Bolsas", "Joias e Bijuterias",
  "Cosméticos e Beleza", "Perfumaria", "Skincare",
  "Doceria e Confeitaria", "Alimentação Saudável", "Bebidas",
  "Papelaria", "Artesanato", "Decoração",
  "Eletrônicos", "Games", "Informática",
  "Pet Shop", "Fitness", "Esportes",
  "Sex Shop", "Brinquedos", "Livros",
  "Casa e Jardim", "Saúde e Bem-estar", "Outro",
];

const PERSONALITY_OPTIONS = [
  { value: "amigavel", label: "🤗 Amigável" },
  { value: "profissional", label: "💼 Profissional" },
  { value: "divertida", label: "🎉 Divertida" },
  { value: "agressiva", label: "🔥 Agressiva (Alta Conversão)" },
  { value: "educada", label: "🎩 Educada e Formal" },
];

function AITrainingPanel({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  
  const { data: config, isLoading } = useQuery({
    queryKey: ["tenant-ai-brain-config", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_ai_brain_config")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
  });

  const [niche, setNiche] = useState("");
  const [personality, setPersonality] = useState("amigavel");
  const [customInstructions, setCustomInstructions] = useState("");
  const [storeKnowledge, setStoreKnowledge] = useState("");
  
  // New behavioral fields
  const [toneOfVoice, setToneOfVoice] = useState("");
  const [writingStyle, setWritingStyle] = useState("");
  const [approachType, setApproachType] = useState("");
  const [sendingRules, setSendingRules] = useState("");
  const [approvedExamples, setApprovedExamples] = useState("");
  const [prohibitions, setProhibitions] = useState("");
  const [languagePreferences, setLanguagePreferences] = useState("");
  const [formalityLevel, setFormalityLevel] = useState("");
  const [emojiUsage, setEmojiUsage] = useState("");
  const [persuasionStyle, setPersuasionStyle] = useState("");
  const [brandIdentity, setBrandIdentity] = useState("");
  const [newTrainingText, setNewTrainingText] = useState("");
  const [isIngesting, setIsIngesting] = useState(false);
  
  const { data: knowledgeCount = 0 } = useQuery({
    queryKey: ["tenant-ai-knowledge-count", userId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("tenant_ai_knowledge")
        .select("*", { count: 'exact', head: true })
        .eq("tenant_id", userId);
      if (error) throw error;
      return count || 0;
    }
  });

  const { data: insightsCount = 0 } = useQuery({
    queryKey: ["customer-ai-insights-count", userId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("customer_ai_insights")
        .select("*", { count: 'exact', head: true })
        .eq("tenant_id", userId);
      if (error) throw error;
      return count || 0;
    }
  });

  const handleIngestTraining = async () => {
    if (!newTrainingText.trim()) {
      toast.error("Digite o texto do treinamento");
      return;
    }

    setIsIngesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-memory-manager", {
        body: {
          action: "ingest-tenant",
          tenantId: userId,
          content: newTrainingText,
          category: "training"
        }
      });

      if (error) throw error;
      toast.success("🧠 Treinamento memorizado com sucesso!");
      setNewTrainingText("");
      queryClient.invalidateQueries({ queryKey: ["tenant-ai-knowledge-count"] });
    } catch (e: any) {
      toast.error("Erro ao memorizar: " + e.message);
    } finally {
      setIsIngesting(false);
    }
  };

  useEffect(() => {
    if (config) {
      setNiche(config.niche || "");
      setPersonality(config.personality || "amigavel");
      setCustomInstructions(config.custom_instructions || "");
      
      setToneOfVoice(config.tone_of_voice || "");
      setWritingStyle(config.writing_style || "");
      setApproachType(config.approach_type || "");
      setSendingRules(config.sending_rules || "");
      setApprovedExamples(config.approved_examples || "");
      setProhibitions(config.prohibitions || "");
      setLanguagePreferences(config.language_preferences || "");
      setFormalityLevel(config.formality_level || "");
      setEmojiUsage(config.emoji_usage || "");
      setPersuasionStyle(config.persuasion_style || "");
      setBrandIdentity(config.brand_identity || "");

      const knowledge = config.store_knowledge;
      if (typeof knowledge === "string") {
        setStoreKnowledge(knowledge);
      } else if (knowledge && typeof knowledge === "object") {
        setStoreKnowledge((knowledge as any).description || JSON.stringify(knowledge));
      } else {
        setStoreKnowledge("");
      }
    }
  }, [config]);

  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [aiResponding, setAiResponding] = useState(false);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("tenant_ai_brain_config")
        .upsert({
          user_id: userId,
          niche,
          personality,
          custom_instructions: customInstructions,
          store_knowledge: { description: storeKnowledge } as any,
          tone_of_voice: toneOfVoice,
          writing_style: writingStyle,
          approach_type: approachType,
          sending_rules: sendingRules,
          approved_examples: approvedExamples,
          prohibitions: prohibitions,
          language_preferences: languagePreferences,
          formality_level: formalityLevel,
          emoji_usage: emojiUsage,
          persuasion_style: persuasionStyle,
          brand_identity: brandIdentity,
        }, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("✅ Treinamento salvo! Gerando apresentação da IA...");
      queryClient.invalidateQueries({ queryKey: ["tenant-ai-brain-config"] });

      // Ask the AI to introduce itself based on the new training
      setAiResponding(true);
      setAiResponse(null);
      try {
        const personalityLabel = PERSONALITY_OPTIONS.find(p => p.value === personality)?.label || personality;
        const prompt = `O lojista acabou de salvar o treinamento da IA com as seguintes configurações:
- Nicho: ${niche || "Não definido"}
- Personalidade: ${personalityLabel}
- Conhecimento da loja: ${storeKnowledge || "Nenhum"}
- Instruções extras: ${customInstructions || "Nenhuma"}

Apresente-se brevemente ao lojista mostrando como você vai se comportar a partir de agora. Dê um exemplo curto de como seria uma notificação push para os clientes dele e um exemplo de como você responderia no chat. Seja breve (máximo 4 parágrafos).`;

        const { data, error } = await supabase.functions.invoke("ai-admin-assistant", {
          body: { messages: [{ role: "user", content: prompt }], clientTime: new Date().toISOString() },
        });

        if (error) throw error;
        setAiResponse(data?.content || "Treinamento salvo com sucesso!");
      } catch {
        setAiResponse("✅ Treinamento salvo! A IA já está configurada com suas preferências.");
      } finally {
        setAiResponding(false);
      }
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  if (isLoading) return <p className="text-xs text-muted-foreground text-center py-4">Carregando...</p>;

  return (
    <Card>
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-sm flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-primary" /> Treinamento da IA
        </CardTitle>
        <CardDescription className="text-[11px]">
          Configure o nicho, personalidade e conhecimentos da sua IA. Isso muda como ela fala com você e seus clientes.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {(!config?.niche || !config?.personality || !config?.store_knowledge) && (
          <div className="mb-4">
            <AITrainingAlert />
          </div>
        )}
        <AITrainingGuide />
        <Tabs defaultValue="base" className="w-full">
          <TabsList className="grid w-full grid-cols-4 h-8 mb-4">
            <TabsTrigger value="base" className="text-[10px]">Identidade</TabsTrigger>
            <TabsTrigger value="comportamento" className="text-[10px]">Comportamento</TabsTrigger>
            <TabsTrigger value="regras" className="text-[10px]">Regras</TabsTrigger>
            <TabsTrigger value="memoria" className="text-[10px]">Memória 🧠</TabsTrigger>
          </TabsList>

          <TabsContent value="base" className="space-y-3 mt-0">
            <div className="space-y-1">
              <Label className="text-xs font-medium">Nicho / Categoria</Label>
              <Select value={niche} onValueChange={setNiche}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Selecione o nicho da loja" />
                </SelectTrigger>
                <SelectContent>
                  {NICHE_OPTIONS.map(n => (
                    <SelectItem key={n} value={n} className="text-xs">{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-medium">Personalidade da IA</Label>
              <Select value={personality} onValueChange={setPersonality}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERSONALITY_OPTIONS.map(p => (
                    <SelectItem key={p.value} value={p.value} className="text-xs">{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-medium">Identidade da Marca</Label>
              <Textarea
                value={brandIdentity}
                onChange={e => setBrandIdentity(e.target.value)}
                placeholder="Ex: Somos uma marca eco-friendly, focada em sustentabilidade e elegância minimalista."
                className="text-xs min-h-[60px] resize-none"
                rows={2}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-medium">O que sua loja oferece? (Conhecimento)</Label>
              <Textarea
                value={storeKnowledge}
                onChange={e => setStoreKnowledge(e.target.value)}
                placeholder="Ex: Vendemos bolos artesanais, doces finos e tortas sob encomenda..."
                className="text-xs min-h-[80px] resize-none"
                rows={4}
              />
              <p className="text-[10px] text-muted-foreground">Quanto mais detalhes, melhor a IA entende seu negócio.</p>
            </div>
          </TabsContent>

          <TabsContent value="comportamento" className="space-y-3 mt-0">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-medium">Tom de Voz</Label>
                <Input value={toneOfVoice} onChange={e => setToneOfVoice(e.target.value)} placeholder="Ex: Entusiasta, Calmo" className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Nível de Formalidade</Label>
                <Input value={formalityLevel} onChange={e => setFormalityLevel(e.target.value)} placeholder="Ex: Informal, Você" className="h-8 text-xs" />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-medium">Estilo de Escrita</Label>
              <Input value={writingStyle} onChange={e => setWritingStyle(e.target.value)} placeholder="Ex: Frases curtas, Poético, Direto" className="h-8 text-xs" />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-medium">Uso de Emojis</Label>
              <Input value={emojiUsage} onChange={e => setEmojiUsage(e.target.value)} placeholder="Ex: Muitos emojis, Apenas um no fim" className="h-8 text-xs" />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-medium">Forma de Persuasão</Label>
              <Textarea
                value={persuasionStyle}
                onChange={e => setPersuasionStyle(e.target.value)}
                placeholder="Ex: Focar em escassez, Focar em benefícios, Focar em prova social"
                className="text-xs min-h-[60px] resize-none"
                rows={2}
              />
            </div>
          </TabsContent>

          <TabsContent value="regras" className="space-y-3 mt-0">
            <div className="space-y-1">
              <Label className="text-xs font-medium">Proibições (O que NÃO fazer)</Label>
              <Textarea
                value={prohibitions}
                onChange={e => setProhibitions(e.target.value)}
                placeholder="Ex: Nunca mencionar concorrentes. Nunca falar de política. Não usar gírias."
                className="text-xs min-h-[60px] resize-none"
                rows={2}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-medium">Regras de Abordagem / Envio</Label>
              <Textarea
                value={sendingRules}
                onChange={e => setSendingRules(e.target.value)}
                placeholder="Ex: Sempre oferecer cupom se o cliente hesitar. Abordar após 2h de abandono."
                className="text-xs min-h-[60px] resize-none"
                rows={2}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-medium">Instruções extras (Prioridade Máxima)</Label>
              <Textarea
                value={customInstructions}
                onChange={e => setCustomInstructions(e.target.value)}
                placeholder="Qualquer outra regra específica..."
                className="text-xs min-h-[60px] resize-none"
                rows={2}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-medium">Exemplos de Mensagens Aprovadas</Label>
              <Textarea
                value={approvedExamples}
                onChange={e => setApprovedExamples(e.target.value)}
                placeholder="Cole aqui exemplos de como você gosta que a IA escreva..."
                className="text-xs min-h-[80px] resize-none"
                rows={3}
              />
            </div>
          </TabsContent>

          <TabsContent value="memoria" className="space-y-4 mt-0">
            <div className="grid grid-cols-2 gap-3 mb-2">
              <div className="bg-primary/5 p-3 rounded-lg border border-primary/10 flex flex-col items-center justify-center text-center">
                <Brain className="h-5 w-5 text-primary mb-1" />
                <span className="text-xl font-bold text-primary">{knowledgeCount}</span>
                <span className="text-[10px] text-muted-foreground uppercase font-semibold">Treinamentos Salvos</span>
              </div>
              <div className="bg-secondary/10 p-3 rounded-lg border border-secondary/20 flex flex-col items-center justify-center text-center">
                <Users className="h-5 w-5 text-secondary-foreground mb-1" />
                <span className="text-xl font-bold text-secondary-foreground">{insightsCount}</span>
                <span className="text-[10px] text-muted-foreground uppercase font-semibold">Memórias de Clientes</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-primary" /> Novo Treinamento Persistente
              </Label>
              <Textarea
                value={newTrainingText}
                onChange={e => setNewTrainingText(e.target.value)}
                placeholder="Ex: No Natal do ano passado vendemos muito panetone trufado. Sempre que um cliente perguntar sobre presentes em dezembro, sugira o kit com 3 unidades."
                className="text-xs min-h-[100px] resize-none bg-muted/30"
                rows={4}
              />
              <p className="text-[10px] text-muted-foreground italic">
                Treinamentos de memória são permanentes e a IA os consulta usando busca vetorial (RAG) antes de cada resposta.
              </p>
              <Button 
                onClick={handleIngestTraining} 
                disabled={isIngesting || !newTrainingText.trim()}
                className="w-full h-8 text-xs gap-2"
              >
                {isIngesting ? <Clock className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                Memorizar Treinamento
              </Button>
            </div>

            <div className="p-3 rounded-lg border bg-amber-50/50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900">
              <div className="flex gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold text-amber-800 dark:text-amber-400">Aprendizado Evolutivo Ativado</p>
                  <p className="text-[10px] text-amber-700 dark:text-amber-500">
                    A IA está aprendendo automaticamente com o comportamento dos seus clientes. Clique em links e compras bem-sucedidas fortalecem a memória da IA.
                  </p>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="w-full h-8 text-xs gap-1 mt-4"
        >
          <Save className="h-3 w-3" />
          {saveMutation.isPending ? "Salvando..." : "Salvar Treinamento e Aplicar à IA"}
        </Button>

        {(aiResponding || aiResponse) && (
          <div className="mt-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
            <p className="text-[11px] font-semibold text-primary mb-1 flex items-center gap-1">
              <Bot className="h-3 w-3" /> Resposta da IA
            </p>
            {aiResponding ? (
              <p className="text-xs text-muted-foreground animate-pulse">Pensando...</p>
            ) : (
              <p className="text-xs whitespace-pre-wrap">{aiResponse}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Cerebro() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const [pendingActions, setPendingActions] = useState<Record<number, any[]>>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  // === DATA QUERIES ===

  const { data: aiSummary } = useQuery({
    queryKey: ["ai_work_summary", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_ai_work_summary", { p_user_id: user!.id });
      if (error) throw error;
      return data as any;
    },
    enabled: !!user,
  });

  const { data: chatHistory = [], isLoading: loadingChat } = useQuery({
    queryKey: ["admin-ai-chats", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_ai_chats")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!user,
  });

  const { data: scheduledTasks = [] } = useQuery({
    queryKey: ["ai-scheduled-tasks", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_scheduled_tasks")
        .select("*")
        .eq("user_id", user!.id)
        .order("scheduled_at", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!user,
  });

  const { data: aiConfig } = useQuery({
    queryKey: ["tenant-ai-brain-config", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_ai_brain_config")
        .select("*")
        .eq("user_id", user!.id)
        .single();
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    enabled: !!user,
  });

  // === MUTATIONS ===

  const sendMessage = useMutation({
    mutationFn: async (content: string) => {
      const messages = chatHistory.map(m => ({ role: m.role, content: m.content }));
      messages.push({ role: "user", content });

      const { data, error } = await supabase.functions.invoke("ai-admin-assistant", {
        body: { messages, userId: user!.id, clientTime: new Date().toISOString() },
      });

      if (error) {
        // Handle 401 specifically - session expired
        const errorBody = typeof error === 'object' && error.message ? error.message : String(error);
        if (errorBody.includes("401") || errorBody.includes("Sessão expirada") || errorBody.includes("Token")) {
          toast.error("Sua sessão expirou. Faça login novamente.");
          return;
        }
        throw error;
      }
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-ai-chats"] });
      queryClient.invalidateQueries({ queryKey: ["ai-scheduled-tasks"] });
      
      if (data?.content) {
        processAIActions(data.content, chatHistory.length + 1);
      }
      setInput("");
    },
    onError: (err: any) => {
      toast.error("Erro ao falar com a IA: " + (err.message || "Erro desconhecido"));
    }
  });

  const clearChat = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("admin_ai_chats").delete().eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-ai-chats"] });
      setPendingActions({});
      toast.success("Chat limpo!");
    }
  });

  const undoLastTurn = useMutation({
    mutationFn: async () => {
      if (chatHistory.length === 0) return;
      const lastId = chatHistory[chatHistory.length - 1].id;
      const secondLastId = chatHistory.length > 1 ? chatHistory[chatHistory.length - 2].id : null;
      const idsToDelete = [lastId];
      if (secondLastId) idsToDelete.push(secondLastId);
      const { error } = await supabase.from("admin_ai_chats").delete().in("id", idsToDelete);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-ai-chats"] });
      toast.success("Última interação removida!");
    }
  });

  const processAIActions = (content: string, msgIndex: number, silent = false) => {
    const actions: any[] = [];
    
    const taskRegex = /\[ACTION_SCHEDULE_TASK\]([\s\S]*?)\[\/ACTION_SCHEDULE_TASK\]/g;
    let match;
    while ((match = taskRegex.exec(content)) !== null) {
      try {
        const payload = JSON.parse(match[1]);
        actions.push({ type: "schedule_task", label: `📅 Agendar Push: ${payload.payload?.title || "Sem título"}`, payload });
      } catch (e) {}
    }

    const couponRegex = /\[ACTION_CREATE_COUPON\]([\s\S]*?)\[\/ACTION_CREATE_COUPON\]/g;
    while ((match = couponRegex.exec(content)) !== null) {
      try {
        const payload = JSON.parse(match[1]);
        actions.push({ type: "create_coupon", label: `🎟️ Criar Cupom: ${payload.code} (${payload.discount_type === 'percentage' ? payload.discount_value + '%' : 'R$' + payload.discount_value})`, payload });
      } catch (e) {}
    }

    const storeSettingsRegex = /\[ACTION_UPDATE_STORE_SETTINGS\]([\s\S]*?)\[\/ACTION_UPDATE_STORE_SETTINGS\]/g;
    while ((match = storeSettingsRegex.exec(content)) !== null) {
      try {
        const payload = JSON.parse(match[1]);
        const fields = Object.keys(payload).join(", ");
        actions.push({ type: "update_store_settings", label: `⚙️ Atualizar Loja: ${fields}`, payload });
      } catch (e) {}
    }

    const marketingRegex = /\[ACTION_UPDATE_MARKETING_CONFIG\]([\s\S]*?)\[\/ACTION_UPDATE_MARKETING_CONFIG\]/g;
    while ((match = marketingRegex.exec(content)) !== null) {
      try {
        const payload = JSON.parse(match[1]);
        const fields = Object.keys(payload).join(", ");
        actions.push({ type: "update_marketing_config", label: `📢 Atualizar Marketing: ${fields}`, payload });
      } catch (e) {}
    }

    const stockRegex = /\[ACTION_UPDATE_STOCK\]([\s\S]*?)\[\/ACTION_UPDATE_STOCK\]/g;
    while ((match = stockRegex.exec(content)) !== null) {
      try {
        const payload = JSON.parse(match[1]);
        actions.push({ type: "update_stock", label: `📦 Atualizar Estoque: ${payload.product_name} → ${payload.new_stock}`, payload });
      } catch (e) {}
    }

    const pageRegex = /\[ACTION_UPDATE_PAGE\]([\s\S]*?)\[\/ACTION_UPDATE_PAGE\]/g;
    while ((match = pageRegex.exec(content)) !== null) {
      try {
        const payload = JSON.parse(match[1]);
        actions.push({ type: "update_page", label: `📄 Atualizar Página: ${payload.slug}`, payload });
      } catch (e) {}
    }

    const reminderRegex = /\[ACTION_SCHEDULE_REMINDER\]([\s\S]*?)\[\/ACTION_SCHEDULE_REMINDER\]/g;
    while ((match = reminderRegex.exec(content)) !== null) {
      try {
        const payload = JSON.parse(match[1]);
        actions.push({ type: "schedule_reminder", label: `🔔 Lembrete: ${payload.title}`, payload });
      } catch (e) {}
    }

    const aiInstructionsRegex = /\[ACTION_UPDATE_AI_INSTRUCTIONS\]([\s\S]*?)\[\/ACTION_UPDATE_AI_INSTRUCTIONS\]/g;
    while ((match = aiInstructionsRegex.exec(content)) !== null) {
      try {
        const payload = JSON.parse(match[1]);
        actions.push({ type: "update_ai_instructions", label: `🧠 Atualizar Instruções IA: "${(payload.instructions || "").slice(0, 60)}..."`, payload });
      } catch (e) {}
    }

    if (actions.length > 0) {
      setPendingActions(prev => ({ ...prev, [msgIndex]: actions }));
    }
  };

  const confirmAction = async (msgIndex: number, actionIndex: number) => {
    const action = pendingActions[msgIndex]?.[actionIndex];
    if (!action || !user) return;
    try {
      if (action.type === "schedule_task") {
        await supabase.from("ai_scheduled_tasks").insert({
          user_id: user.id,
          task_type: action.payload.task_type,
          scheduled_at: action.payload.scheduled_at,
          payload: action.payload.payload,
          ai_instruction: action.payload.ai_instruction,
          status: "pending"
        });
        toast.success("✅ Tarefa agendada com sucesso!");
      } else if (action.type === "create_coupon") {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + (action.payload.validity_days || 30));
        
        const { error } = await supabase.from("coupons").insert({
          user_id: user.id,
          code: action.payload.code.toUpperCase(),
          discount_type: action.payload.discount_type,
          discount_value: action.payload.discount_value,
          min_order_value: action.payload.min_order_value || 0,
          expires_at: expiresAt.toISOString(),
          active: true
        });
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ["coupons"] });
        queryClient.invalidateQueries({ queryKey: ["public_coupons"] });
        toast.success("✅ Cupom criado com sucesso!");
      } else if (action.type === "update_store_settings") {
        const { error } = await supabase.from("store_settings").update(action.payload).eq("user_id", user.id);
        if (error) throw error;
        toast.success("✅ Configurações da loja atualizadas!");
        queryClient.invalidateQueries({ queryKey: ["store_settings"] });
        queryClient.invalidateQueries({ queryKey: ["public_store_settings"] });
      } else if (action.type === "update_marketing_config") {
        const { error } = await supabase.from("store_marketing_config").update(action.payload).eq("user_id", user.id);
        if (error) throw error;
        toast.success("✅ Configurações de marketing atualizadas!");
        queryClient.invalidateQueries({ queryKey: ["store_marketing_config"] });
      } else if (action.type === "update_stock") {
        const { error } = await supabase.from("products").update({ stock: action.payload.new_stock }).eq("user_id", user.id).eq("name", action.payload.product_name);
        if (error) throw error;
        toast.success("✅ Estoque atualizado!");
        queryClient.invalidateQueries({ queryKey: ["products"] });
      } else if (action.type === "update_page") {
        const { error } = await supabase.from("store_pages").update({ content: action.payload.content }).eq("user_id", user.id).eq("slug", action.payload.slug);
        if (error) throw error;
        toast.success("✅ Conteúdo da página atualizado!");
        queryClient.invalidateQueries({ queryKey: ["store_pages"] });
      } else if (action.type === "schedule_reminder") {
        const { error } = await supabase.from("ai_scheduled_tasks").insert({
          user_id: user.id,
          task_type: "reminder",
          scheduled_at: action.payload.remind_at,
          payload: { title: action.payload.title, description: action.payload.description },
          ai_instruction: action.payload.title,
          status: "pending"
        });
        if (error) throw error;
        toast.success("✅ Lembrete agendado!");
      } else if (action.type === "update_ai_instructions") {
        const { data: existing } = await supabase
          .from("tenant_ai_brain_config")
          .select("custom_instructions")
          .eq("user_id", user.id)
          .maybeSingle();
        
        const currentInstructions = existing?.custom_instructions || "";
        const newInstructions = currentInstructions 
          ? `${currentInstructions}\n- ${action.payload.instructions}` 
          : `- ${action.payload.instructions}`;
        
        const { error } = await supabase
          .from("tenant_ai_brain_config")
          .upsert({ 
            user_id: user.id, 
            custom_instructions: newInstructions 
          }, { onConflict: "user_id" });
        if (error) throw error;
        toast.success("✅ Instruções da IA atualizadas! A IA vai seguir suas correções.");
        queryClient.invalidateQueries({ queryKey: ["tenant-ai-brain-config"] });
      }

      setPendingActions(prev => {
        const newActions = [...(prev[msgIndex] || [])];
        newActions[actionIndex] = { ...newActions[actionIndex], confirmed: true };
        return { ...prev, [msgIndex]: newActions };
      });
      queryClient.invalidateQueries({ queryKey: ["ai-scheduled-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["coupons"] });
    } catch (e: any) {
      toast.error("Erro ao executar: " + e.message);
    }
  };

  const sendAiWorkSummary = async () => {
    if (!aiSummary || !user) return;
    const summaryText = `Resumo de Atividades IA (${aiSummary.period}):
    - Interações: ${aiSummary.recent_chats}
    - Tarefas Agendadas: ${aiSummary.pending_tasks}
    - Tarefas Concluídas: ${aiSummary.completed_tasks}
    - Insights CEO: ${aiSummary.recent_insights}`;

    try {
      const { error } = await supabase.from("admin_notifications").insert({
        sender_user_id: user.id,
        target_user_id: user.id,
        title: "📊 Resumo de Trabalho da IA",
        message: summaryText,
        type: "ceo_insight"
      });
      if (error) throw error;
      toast.success("Resumo enviado para suas notificações!");
    } catch (e: any) {
      toast.error("Erro ao enviar resumo: " + e.message);
    }
  };

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, sendMessage.isPending]);

  // Scan history for actions on load
  useEffect(() => {
    if (chatHistory.length > 0) {
      chatHistory.forEach((msg, i) => {
        if (msg.role === 'assistant' && !pendingActions[i]) {
          processAIActions(msg.content, i);
        }
      });
    }
  }, [chatHistory]);

  const handleSend = () => {
    if (!input.trim() || sendMessage.isPending) return;
    const content = input;
    setInput("");
    sendMessage.mutate(content);
  };

  return (
    <PlanGate feature="ai_tools">
      <div className="flex flex-col gap-4 p-1">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
            <Brain className="h-5 w-5 md:h-6 md:w-6 text-primary" /> Cérebro da Loja
          </h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <p className="text-muted-foreground text-xs md:text-sm">Sua IA estratégica para gestão, alertas e automação.</p>
            {aiConfig?.niche && (
              <Badge variant="outline" className="text-[10px] bg-primary/10 border-primary/20 text-primary">
                {aiConfig.niche}
              </Badge>
            )}
            {aiConfig?.personality && (
              <Badge variant="outline" className="text-[10px]">
                {PERSONALITY_OPTIONS.find(p => p.value === aiConfig.personality)?.label || aiConfig.personality}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Mobile: Tabs for Chat vs Logs. Desktop: Side by side */}
      <Tabs defaultValue="chat" className="flex flex-col lg:hidden">
        <TabsList className="w-full grid grid-cols-5">
          <TabsTrigger value="chat" className="text-[10px] gap-1"><Bot className="h-3 w-3" /> Chat</TabsTrigger>
          <TabsTrigger value="training" className="text-[10px] gap-1"><Settings2 className="h-3 w-3" /> Treinar</TabsTrigger>
          <TabsTrigger value="ceo" className="text-[10px] gap-1"><Brain className="h-3 w-3" /> CEO</TabsTrigger>
          <TabsTrigger value="my-pushes" className="text-[10px] gap-1"><Bell className="h-3 w-3" /> Pushes</TabsTrigger>
          <TabsTrigger value="client-pushes" className="text-[10px] gap-1"><Users className="h-3 w-3" /> Clientes</TabsTrigger>
        </TabsList>
        <TabsContent value="chat" className="mt-2">
          <ChatPanel
            chatHistory={chatHistory}
            sendMessage={sendMessage}
            pendingActions={pendingActions}
            confirmAction={confirmAction}
            input={input}
            setInput={setInput}
            handleSend={handleSend}
            scrollRef={scrollRef}
          />
        </TabsContent>
        <TabsContent value="training" className="mt-2">
          {user && <AITrainingPanel userId={user.id} />}
        </TabsContent>
        <TabsContent value="ceo" className="mt-2">
          <PushLogPanel userId={user?.id} eventType="ceo_insight" emptyText="Nenhum insight CEO enviado ainda." />
        </TabsContent>
        <TabsContent value="my-pushes" className="mt-2">
          <PushLogPanel userId={user?.id} eventType="motivational_push" emptyText="Nenhum push motivacional enviado." />
        </TabsContent>
        <TabsContent value="client-pushes" className="mt-2">
          <PushLogPanel userId={user?.id} eventType="customer" emptyText="Nenhuma notificação enviada para clientes." />
        </TabsContent>
      </Tabs>

      {/* Desktop layout */}
      <div className="hidden lg:grid lg:grid-cols-3 gap-4 flex-1" style={{ minHeight: "calc(100vh - 14rem)" }}>
        <div className="lg:col-span-2 flex flex-col gap-4">
          <ChatPanel
            chatHistory={chatHistory}
            sendMessage={sendMessage}
            pendingActions={pendingActions}
            confirmAction={confirmAction}
            input={input}
            setInput={setInput}
            handleSend={handleSend}
            scrollRef={scrollRef}
          />
        </div>

        <div className="flex flex-col gap-4 overflow-hidden">
          <Tabs defaultValue="training" className="flex flex-col overflow-hidden">
            <TabsList className="w-full grid grid-cols-5">
              <TabsTrigger value="training" className="text-[10px] gap-1"><Settings2 className="h-3 w-3" /> Treinar</TabsTrigger>
              <TabsTrigger value="ceo" className="text-[10px] gap-1"><Brain className="h-3 w-3" /> CEO</TabsTrigger>
              <TabsTrigger value="tasks" className="text-[10px] gap-1"><Clock className="h-3 w-3" /> Tarefas</TabsTrigger>
              <TabsTrigger value="my-pushes" className="text-[10px] gap-1"><Bell className="h-3 w-3" /> Push</TabsTrigger>
              <TabsTrigger value="client-pushes" className="text-[10px] gap-1"><Users className="h-3 w-3" /> Clientes</TabsTrigger>
            </TabsList>

            <TabsContent value="training" className="flex-1 overflow-auto mt-2">
              {user && <AITrainingPanel userId={user.id} />}
            </TabsContent>

            <TabsContent value="ceo" className="flex-1 overflow-hidden mt-2">
              <PushLogPanel userId={user?.id} eventType="ceo_insight" emptyText="Nenhum insight CEO enviado ainda." />
            </TabsContent>

            <TabsContent value="tasks" className="flex-1 overflow-hidden mt-2">
              <Card className="h-full">
                <CardContent className="px-3 py-3">
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-2">
                      {scheduledTasks.length === 0 ? <p className="text-xs text-muted-foreground text-center py-4">Sem tarefas.</p> : scheduledTasks.map(task => (
                        <div key={task.id} className="p-2 rounded-lg border text-xs space-y-1">
                          <div className="flex justify-between"><Badge variant="outline" className="text-[9px]">{task.status}</Badge></div>
                          <p className="line-clamp-2 italic">"{task.ai_instruction}"</p>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="my-pushes" className="flex-1 overflow-hidden mt-2">
              <PushLogPanel userId={user?.id} eventType="motivational_push" emptyText="Nenhum push motivacional enviado." />
            </TabsContent>

            <TabsContent value="client-pushes" className="flex-1 overflow-hidden mt-2">
              <PushLogPanel userId={user?.id} eventType="customer" emptyText="Nenhuma notificação enviada para clientes." />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
    </PlanGate>
  );
}
