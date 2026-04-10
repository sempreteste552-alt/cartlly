import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
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
  const scrollRef = useRef<HTMLDivElement>(null);

  // === DATA QUERIES ===

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
        body: { messages },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-ai-chats"] });
      queryClient.invalidateQueries({ queryKey: ["ai-scheduled-tasks"] });
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
      toast.success("Chat limpo!");
    }
  });

  // === EFFECTS ===

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatHistory, sendMessage.isPending]);

  const handleSend = () => {
    if (!input.trim() || sendMessage.isPending) return;
    sendMessage.mutate(input);
  };

  return (
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
        <Button variant="outline" size="sm" onClick={() => clearChat.mutate()} disabled={chatHistory.length === 0}>
          <Trash2 className="h-4 w-4 mr-2" /> Limpar Histórico
        </Button>
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
                      {["Como foram as vendas hoje?", "Agende um lembrete de carrinho para amanhã", "Tem algum erro de pagamento?"].map(s => (
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
              <div className="space-y-2">
                {scheduledTasks.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4 italic">Nenhuma tarefa pendente.</p>
                ) : (
                  scheduledTasks.slice(0, 5).map(task => (
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
  );
}
