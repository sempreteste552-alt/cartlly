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
        body: { messages },
      });
      if (error) throw error;
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

  const processAIActions = (content: string, msgIndex: number) => {
    const actions: any[] = [];
    
    // 1. Agendar Tarefa
    const taskRegex = /\[ACTION_SCHEDULE_TASK\]([\s\S]*?)\[\/ACTION_SCHEDULE_TASK\]/g;
    let match;
    while ((match = taskRegex.exec(content)) !== null) {
      try {
        const payload = JSON.parse(match[1]);
        actions.push({ type: "schedule_task", label: `📅 Agendar Push: ${payload.payload?.title || "Sem título"}`, payload });
      } catch (e) {}
    }

    // 2. Criar Cupom
    const couponRegex = /\[ACTION_CREATE_COUPON\]([\s\S]*?)\[\/ACTION_CREATE_COUPON\]/g;
    while ((match = couponRegex.exec(content)) !== null) {
      try {
        const payload = JSON.parse(match[1]);
        actions.push({ type: "create_coupon", label: `🎟️ Criar Cupom: ${payload.code} (${payload.discount_type === 'percentage' ? payload.discount_value + '%' : 'R$' + payload.discount_value})`, payload });
      } catch (e) {}
    }

    // 3. Atualizar Configurações da Loja (Letreiro, etc)
    const storeSettingsRegex = /\[ACTION_UPDATE_STORE_SETTINGS\]([\s\S]*?)\[\/ACTION_UPDATE_STORE_SETTINGS\]/g;
    while ((match = storeSettingsRegex.exec(content)) !== null) {
      try {
        const payload = JSON.parse(match[1]);
        const fields = Object.keys(payload).join(", ");
        actions.push({ type: "update_store_settings", label: `⚙️ Atualizar Loja: ${fields}`, payload });
      } catch (e) {}
    }

    // 4. Atualizar Marketing (Faixa, Frete Grátis, Countdown)
    const marketingRegex = /\[ACTION_UPDATE_MARKETING_CONFIG\]([\s\S]*?)\[\/ACTION_UPDATE_MARKETING_CONFIG\]/g;
    while ((match = marketingRegex.exec(content)) !== null) {
      try {
        const payload = JSON.parse(match[1]);
        const fields = Object.keys(payload).join(", ");
        actions.push({ type: "update_marketing_config", label: `📢 Atualizar Marketing: ${fields}`, payload });
      } catch (e) {}
    }

    // 5. Atualizar Estoque
    const stockRegex = /\[ACTION_UPDATE_STOCK\]([\s\S]*?)\[\/ACTION_UPDATE_STOCK\]/g;
    while ((match = stockRegex.exec(content)) !== null) {
      try {
        const payload = JSON.parse(match[1]);
        actions.push({ type: "update_stock", label: `📦 Atualizar Estoque: ${payload.product_name} → ${payload.new_stock}`, payload });
      } catch (e) {}
    }

    if (actions.length > 0) setPendingActions(prev => ({ ...prev, [msgIndex]: actions }));
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

  const handleSend = () => {
    if (!input.trim() || sendMessage.isPending) return;
    sendMessage.mutate(input);
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
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 overflow-hidden">
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
                        Você pode me perguntar sobre vendas, agendar notificações ou analisar erros.
                      </p>
                    </div>
                  </div>
                )}
                {chatHistory.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                      msg.role === 'user' ? 'bg-primary text-primary-foreground rounded-tr-none' : 'bg-card border shadow-sm rounded-tl-none'
                    }`}>
                        {msg.content}
                        {pendingActions[i]?.map((action, aidx) => (
                          <div key={aidx} className="mt-3 bg-muted/50 p-2 rounded-lg border border-border/50">
                            <span className="text-[11px] font-medium leading-tight text-foreground block mb-1">{action.label}</span>
                            <Button size="sm" className="h-7 w-full text-[10px]" disabled={action.confirmed} onClick={() => confirmAction(i, aidx)}>
                              {action.confirmed ? "✅ Confirmado" : "Confirmar e Executar"}
                            </Button>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
                {sendMessage.isPending && <div className="flex justify-start"><div className="bg-card border shadow-sm rounded-2xl px-4 py-3 flex gap-1"><span className="h-1.5 w-1.5 bg-primary rounded-full animate-bounce"></span><span className="h-1.5 w-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]"></span><span className="h-1.5 w-1.5 bg-primary rounded-full animate-bounce"></span></div></div>}
                <div ref={scrollRef} />
              </div>
            </ScrollArea>
          </CardContent>
          <CardFooter className="p-3 border-t bg-card">
            <div className="flex w-full gap-2">
              <Input placeholder="Fale com a IA..." value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()} className="flex-1" />
              <Button size="icon" onClick={handleSend} disabled={sendMessage.isPending || !input.trim()}><Send className="h-4 w-4" /></Button>
            </div>
          </CardFooter>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader className="py-3"><CardTitle className="text-sm flex items-center gap-2"><Clock className="h-4 w-4 text-primary" /> Tarefas IA</CardTitle></CardHeader>
            <CardContent className="px-3 pb-3">
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
        </div>
      </div>
    </div>
    </PlanGate>
  );
}
