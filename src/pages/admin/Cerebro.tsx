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
import { Bot, Send, Trash2, Brain, Sparkles, Clock, AlertTriangle, CheckCircle2, Bell, Users, Megaphone } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

function PushLogPanel({ userId, eventType, emptyText }: { userId?: string; eventType: string; emptyText: string }) {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["push-logs", userId, eventType],
    queryFn: async () => {
      let query = supabase
        .from("push_logs")
        .select("id, title, body, status, created_at, customer_id, trigger_type, event_type")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false })
        .limit(20);

      if (eventType === "motivational_push") {
        query = query.eq("event_type", "motivational_push");
      } else {
        query = query.neq("event_type", "motivational_push");
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
                  <span>{formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: ptBR })}</span>
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

    // 6. Atualizar Página
    const pageRegex = /\[ACTION_UPDATE_PAGE\]([\s\S]*?)\[\/ACTION_UPDATE_PAGE\]/g;
    while ((match = pageRegex.exec(content)) !== null) {
      try {
        const payload = JSON.parse(match[1]);
        actions.push({ type: "update_page", label: `📄 Atualizar Página: ${payload.slug}`, payload });
      } catch (e) {}
    }

    // 7. Lembrete Pessoal
    const reminderRegex = /\[ACTION_SCHEDULE_REMINDER\]([\s\S]*?)\[\/ACTION_SCHEDULE_REMINDER\]/g;
    while ((match = reminderRegex.exec(content)) !== null) {
      try {
        const payload = JSON.parse(match[1]);
        actions.push({ type: "schedule_reminder", label: `🔔 Lembrete: ${payload.title}`, payload });
      } catch (e) {}
    }

    // 8. Atualizar Instruções da IA
    const aiInstructionsRegex = /\[ACTION_UPDATE_AI_INSTRUCTIONS\]([\s\S]*?)\[\/ACTION_UPDATE_AI_INSTRUCTIONS\]/g;
    while ((match = aiInstructionsRegex.exec(content)) !== null) {
      try {
        const payload = JSON.parse(match[1]);
        actions.push({ type: "update_ai_instructions", label: `🧠 Atualizar Instruções IA: "${(payload.instructions || "").slice(0, 60)}..."`, payload });
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
        // Append new instructions to existing ones
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
        queryClient.invalidateQueries({ queryKey: ["ai-brain-config"] });
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
          </div>
        </div>
      </div>

      {/* Mobile: Tabs for Chat vs Logs. Desktop: Side by side */}
      <Tabs defaultValue="chat" className="flex flex-col lg:hidden">
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="chat" className="text-xs gap-1"><Bot className="h-3 w-3" /> Chat</TabsTrigger>
          <TabsTrigger value="my-pushes" className="text-xs gap-1"><Bell className="h-3 w-3" /> Pushes</TabsTrigger>
          <TabsTrigger value="client-pushes" className="text-xs gap-1"><Users className="h-3 w-3" /> Clientes</TabsTrigger>
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
        <TabsContent value="my-pushes" className="mt-2">
          <PushLogPanel userId={user?.id} eventType="motivational_push" emptyText="Nenhum push motivacional enviado." />
        </TabsContent>
        <TabsContent value="client-pushes" className="mt-2">
          <PushLogPanel userId={user?.id} eventType="customer" emptyText="Nenhuma notificação enviada para clientes." />
        </TabsContent>
      </Tabs>

      {/* Desktop layout */}
      <div className="hidden lg:grid lg:grid-cols-3 gap-4 flex-1" style={{ minHeight: "calc(100vh - 14rem)" }}>
        <div className="lg:col-span-2">
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
          <Tabs defaultValue="tasks" className="flex flex-col overflow-hidden">
            <TabsList className="w-full grid grid-cols-3">
              <TabsTrigger value="tasks" className="text-[10px] gap-1"><Clock className="h-3 w-3" /> Tarefas</TabsTrigger>
              <TabsTrigger value="my-pushes" className="text-[10px] gap-1"><Bell className="h-3 w-3" /> Meus Pushes</TabsTrigger>
              <TabsTrigger value="client-pushes" className="text-[10px] gap-1"><Users className="h-3 w-3" /> Clientes</TabsTrigger>
            </TabsList>

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
