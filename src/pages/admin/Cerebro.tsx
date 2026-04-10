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
import { Bot, Send, Trash2, Brain, Sparkles, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export default function Cerebro() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const [pendingActions, setPendingActions] = useState<Record<number, any[]>>({});
  const [showAiSummary, setShowAiSummary] = useState(false);
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
...
  const handleSend = () => {
    if (!input.trim() || sendMessage.isPending) return;
    sendMessage.mutate(input);
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

  return (
    <PlanGate feature="ai_tools">
      <div className="flex flex-col h-[calc(100vh-8rem)] gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" /> Cérebro da Loja
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-muted-foreground text-sm">Sua IA estratégica para gestão, alertas e automação de vendas.</p>
            {aiConfig?.niche && (
              <Badge variant="outline" className="text-[10px] bg-primary/10 border-primary/20 text-primary">
                Nicho: {aiConfig.niche}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={sendAiWorkSummary} className="bg-primary/5 border-primary/20 hover:bg-primary/10">
            <Sparkles className="h-4 w-4 mr-2 text-primary" /> Mande o Resumo do Trabalho
          </Button>
          <Button variant="outline" size="sm" onClick={() => {
            toast.success("Histórico salvo com sucesso!");
          }}>
            <Bot className="h-4 w-4 mr-2" /> Salvar Chat
          </Button>
          <Button variant="outline" size="sm" onClick={() => undoLastTurn.mutate()} disabled={chatHistory.length === 0 || undoLastTurn.isPending}>
             Voltar
          </Button>
          <Button variant="outline" size="sm" onClick={() => clearChat.mutate()} disabled={chatHistory.length === 0}>
            <Trash2 className="h-4 w-4 mr-2" /> Reiniciar Chat
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 overflow-hidden">
        {/* Chat Area */}
        <Card className="lg:col-span-2 flex flex-col overflow-hidden border-primary/20 bg-primary/5">
          <CardHeader className="py-3 border-b bg-card">
            <CardTitle className="text-sm flex items-center gap-2">
              <Bot className="h-4 w-4 text-primary" /> Conversa com Gerente IA
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden p-0 relative">
            <ScrollArea className="h-full p-4">
              <div className="space-y-4">
                {chatHistory.length === 0 && !sendMessage.isPending && (
                  <div className="text-center py-12 space-y-4">
                    <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                      <Sparkles className="h-8 w-8 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Olá! Como posso ajudar sua loja hoje?</h3>
                      <p className="text-sm text-muted-foreground max-w-xs mx-auto mt-1">
                        Você pode me perguntar sobre vendas, pedir para agendar notificações ou analisar erros.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 justify-center max-w-sm mx-auto">
                      {["Como foram as vendas hoje?", "Agende um lembrete de carrinho para amanhã", "Meu nicho é Moda Feminina", "Preciso de ajuda com pagamentos"].map(s => (
                        <Button key={s} variant="outline" size="sm" className="text-[11px]" onClick={() => sendMessage.mutate(s)}>
                          {s}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {chatHistory.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                      msg.role === 'user' 
                        ? 'bg-primary text-primary-foreground rounded-tr-none' 
                        : 'bg-card border shadow-sm rounded-tl-none'
                    }`}>
                        {msg.content.split(/\[ACTION_.*?\]/).map((part, index) => (
                          <span key={index}>{part}</span>
                        ))}
                        
                        {pendingActions[i] && pendingActions[i].length > 0 && (
                          <div className="mt-3 space-y-2 pt-2 border-t border-border/50">
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Ações Sugeridas pela IA:</p>
                            {pendingActions[i].map((action, aidx) => (
                              <div key={aidx} className="flex flex-col gap-1.5 bg-muted/50 p-2 rounded-lg border border-border/50">
                                <span className="text-[11px] font-medium leading-tight text-foreground">{action.label}</span>
                                <Button 
                                  size="sm" 
                                  className="h-7 w-full text-[10px]" 
                                  variant={action.confirmed ? "secondary" : "default"}
                                  disabled={action.confirmed}
                                  onClick={() => confirmAction(i, aidx)}
                                >
                                  {action.confirmed ? "✅ Confirmado e Executado" : "Confirmar e Executar"}
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                    </div>
                  </div>
                ))}

                {sendMessage.isPending && (
                  <div className="flex justify-start">
                    <div className="bg-card border shadow-sm rounded-2xl rounded-tl-none px-4 py-3 flex gap-1">
                      <span className="h-1.5 w-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                      <span className="h-1.5 w-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                      <span className="h-1.5 w-1.5 bg-primary rounded-full animate-bounce"></span>
                    </div>
                  </div>
                )}
                <div ref={scrollRef} />
              </div>
            </ScrollArea>
          </CardContent>
          <CardFooter className="p-3 border-t bg-card">
            <div className="flex w-full gap-2">
              <Input 
                placeholder="Ex: Amanhã às 12h mande um push para todos os clientes..." 
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                className="flex-1"
              />
              <Button size="icon" onClick={handleSend} disabled={sendMessage.isPending || !input.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </CardFooter>
        </Card>

        {/* Sidebar Status */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" /> Tarefas Agendadas
              </CardTitle>
              <CardDescription className="text-xs">Ações que a IA realizará no futuro.</CardDescription>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <ScrollArea className="h-[300px] pr-4 -mr-4">
                <div className="space-y-2">
                  {scheduledTasks.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4 italic">Nenhuma tarefa pendente.</p>
                  ) : (
                    scheduledTasks.map(task => (
                      <div key={task.id} className="p-2 rounded-lg border bg-card/50 text-xs space-y-1">
                        <div className="flex justify-between items-start">
                          <Badge variant="outline" className="text-[9px] uppercase">{task.task_type}</Badge>
                          <span className="text-muted-foreground text-[10px]">
                            {formatDistanceToNow(new Date(task.scheduled_at), { addSuffix: true, locale: ptBR })}
                          </span>
                        </div>
                        <p className="line-clamp-2 text-muted-foreground leading-tight italic">"{task.ai_instruction}"</p>
                        <div className="flex items-center gap-1">
                          {task.status === 'pending' && <Clock className="h-3 w-3 text-amber-500" />}
                          {task.status === 'completed' && <CheckCircle2 className="h-3 w-3 text-green-500" />}
                          {task.status === 'failed' && <AlertTriangle className="h-3 w-3 text-red-500" />}
                          <span className="capitalize text-[10px]">{task.status}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card className="bg-amber-500/10 border-amber-500/20">
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4" /> Alertas Urgentes
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <p className="text-xs text-amber-800 dark:text-amber-300">
                A IA está monitorando erros de pagamento e baixo estoque. Peça um resumo para ver os detalhes.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
    </PlanGate>
  );
}
