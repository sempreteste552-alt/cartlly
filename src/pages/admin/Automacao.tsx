import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, ShoppingCart, Bell, Clock, History, Zap, RefreshCw, Send } from "lucide-react";
import { format } from "date-fns";

interface AutomationRule {
  id: string;
  name: string;
  trigger_type: string;
  channel: string;
  enabled: boolean;
  wait_minutes: number;
  cooldown_minutes: number | null;
  max_sends_per_day: number | null;
  ai_generated: boolean;
  ai_tone: string | null;
  message_template: string | null;
  created_at: string;
}

interface AutomationExecution {
  id: string;
  trigger_type: string;
  channel: string;
  message_text: string | null;
  ai_generated: boolean;
  status: string;
  error_message: string | null;
  sent_at: string;
  customer_id: string | null;
}

export default function Automacao() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch automation rules
  const { data: rules = [], isLoading: loadingRules } = useQuery({
    queryKey: ["automation-rules", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("automation_rules")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as AutomationRule[];
    },
    enabled: !!user,
  });

  // Fetch execution history
  const { data: executions = [], isLoading: loadingExecs } = useQuery({
    queryKey: ["automation-executions", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("automation_executions")
        .select("*")
        .eq("user_id", user!.id)
        .order("sent_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as AutomationExecution[];
    },
    enabled: !!user,
  });

  // Fetch abandoned carts count
  const { data: abandonedCount = 0 } = useQuery({
    queryKey: ["abandoned-carts-count", user?.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("abandoned_carts")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .eq("recovered", false);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!user,
  });

  // Toggle rule
  const toggleRule = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await supabase
        .from("automation_rules")
        .update({ enabled })
        .eq("id", id)
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automation-rules"] });
      toast.success("Regra atualizada!");
    },
  });

  // Create default rules if none exist
  const createDefaults = useMutation({
    mutationFn: async () => {
      const defaults = [
        {
          user_id: user!.id,
          name: "Recuperar Carrinho Abandonado",
          trigger_type: "abandoned_cart",
          channel: "push",
          wait_minutes: 30,
          cooldown_minutes: 60,
          max_sends_per_day: 3,
          ai_generated: true,
          ai_tone: "friendly",
          enabled: true,
          message_template: "Olá {customer_name}! Você deixou itens no carrinho. Volte e finalize sua compra! 🛒",
        },
        {
          user_id: user!.id,
          name: "Alerta Diário de Promoções",
          trigger_type: "daily_promo",
          channel: "push",
          wait_minutes: 0,
          cooldown_minutes: 1440,
          max_sends_per_day: 1,
          ai_generated: true,
          ai_tone: "exciting",
          enabled: true,
          message_template: "🔥 Confira as novidades e ofertas do dia na nossa loja!",
        },
        {
          user_id: user!.id,
          name: "Lembrete de Wishlist",
          trigger_type: "wishlist_reminder",
          channel: "push",
          wait_minutes: 1440,
          cooldown_minutes: 4320,
          max_sends_per_day: 1,
          ai_generated: true,
          ai_tone: "friendly",
          enabled: false,
          message_template: "💜 Os produtos da sua lista de desejos ainda estão disponíveis!",
        },
      ];

      const { error } = await supabase.from("automation_rules").insert(defaults);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automation-rules"] });
      toast.success("Regras padrão criadas!");
    },
  });

  // Manual trigger for abandoned cart recovery
  const triggerRecovery = useMutation({
    mutationFn: async () => {
      const resp = await supabase.functions.invoke("recover-abandoned-carts");
      if (resp.error) throw resp.error;
      return resp.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["automation-executions"] });
      toast.success(`Recuperação executada! Enviados: ${data?.sent || 0}, Ignorados: ${data?.skipped || 0}`);
    },
    onError: (err: any) => {
      toast.error("Erro ao executar: " + (err.message || "Erro desconhecido"));
    },
  });

  const statusColor = (status: string) => {
    if (status === "sent") return "default";
    if (status === "failed") return "destructive";
    return "secondary";
  };

  const triggerLabel = (t: string) => {
    const map: Record<string, string> = {
      abandoned_cart: "Carrinho Abandonado",
      daily_promo: "Promoção Diária",
      wishlist_reminder: "Lembrete Wishlist",
      restock: "Reposição",
    };
    return map[t] || t;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bot className="h-6 w-6 text-primary" /> Automação IA
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Configure mensagens automáticas por IA para recuperar vendas e engajar clientes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <ShoppingCart className="h-3 w-3" />
            {abandonedCount} carrinhos abandonados
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="rules" className="space-y-4">
        <TabsList>
          <TabsTrigger value="rules" className="gap-1.5">
            <Zap className="h-4 w-4" /> Regras
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5">
            <History className="h-4 w-4" /> Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rules" className="space-y-4">
          {rules.length === 0 && !loadingRules && (
            <Card>
              <CardContent className="py-12 text-center space-y-4">
                <Bot className="h-12 w-12 mx-auto text-muted-foreground/50" />
                <p className="text-muted-foreground">Nenhuma regra de automação configurada.</p>
                <Button onClick={() => createDefaults.mutate()} disabled={createDefaults.isPending}>
                  <Zap className="h-4 w-4 mr-2" /> Criar Regras Padrão
                </Button>
              </CardContent>
            </Card>
          )}

          {rules.map((rule) => (
            <Card key={rule.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${rule.enabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                      {rule.trigger_type === "abandoned_cart" ? <ShoppingCart className="h-5 w-5" /> :
                       rule.trigger_type === "daily_promo" ? <Bell className="h-5 w-5" /> :
                       <Zap className="h-5 w-5" />}
                    </div>
                    <div>
                      <CardTitle className="text-base">{rule.name}</CardTitle>
                      <CardDescription className="text-xs mt-0.5">
                        {triggerLabel(rule.trigger_type)} · Canal: {rule.channel.toUpperCase()}
                        {rule.ai_generated && <Badge variant="secondary" className="ml-2 text-[10px] px-1.5 py-0">IA</Badge>}
                      </CardDescription>
                    </div>
                  </div>
                  <Switch
                    checked={rule.enabled}
                    onCheckedChange={(v) => toggleRule.mutate({ id: rule.id, enabled: v })}
                    disabled={toggleRule.isPending}
                  />
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground text-xs">Aguardar</span>
                    <p className="font-medium">{rule.wait_minutes} min</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Cooldown</span>
                    <p className="font-medium">{rule.cooldown_minutes || 60} min</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Máx/dia</span>
                    <p className="font-medium">{rule.max_sends_per_day || 3}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Tom IA</span>
                    <p className="font-medium capitalize">{rule.ai_tone || "amigável"}</p>
                  </div>
                </div>
                {rule.message_template && (
                  <div className="mt-3 p-3 bg-muted/50 rounded-md text-sm text-muted-foreground">
                    <span className="text-xs font-medium text-foreground">Template:</span>
                    <p className="mt-1">{rule.message_template}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}

          {rules.length > 0 && (
            <Card>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">Executar recuperação manual</p>
                    <p className="text-xs text-muted-foreground">Dispara agora a IA para carrinhos abandonados</p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => triggerRecovery.mutate()}
                    disabled={triggerRecovery.isPending}
                  >
                    {triggerRecovery.isPending ? <RefreshCw className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
                    Executar Agora
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Histórico de Envios</CardTitle>
              <CardDescription>Últimos 100 envios automáticos</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingExecs ? (
                <p className="text-center text-muted-foreground py-8">Carregando...</p>
              ) : executions.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhum envio registrado ainda.</p>
              ) : (
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Canal</TableHead>
                        <TableHead>Mensagem</TableHead>
                        <TableHead>IA</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {executions.map((exec) => (
                        <TableRow key={exec.id}>
                          <TableCell className="text-xs whitespace-nowrap">
                            {format(new Date(exec.sent_at), "dd/MM HH:mm")}
                          </TableCell>
                          <TableCell className="text-xs">{triggerLabel(exec.trigger_type)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px]">{exec.channel}</Badge>
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate text-xs">{exec.message_text || "—"}</TableCell>
                          <TableCell>{exec.ai_generated ? "✅" : "—"}</TableCell>
                          <TableCell>
                            <Badge variant={statusColor(exec.status)} className="text-[10px]">
                              {exec.status}
                            </Badge>
                            {exec.error_message && (
                              <p className="text-[10px] text-destructive mt-0.5 max-w-[150px] truncate">{exec.error_message}</p>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
