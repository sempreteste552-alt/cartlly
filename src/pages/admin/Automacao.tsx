import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Bot, ShoppingCart, Bell, History, Zap, RefreshCw, Send, Users, BellRing, Heart, Clock, TrendingUp, AlertTriangle } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

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

interface AbandonedCart {
  id: string;
  customer_id: string | null;
  items: any;
  total: number;
  abandoned_at: string;
  reminder_sent_count: number;
  last_reminder_at: string | null;
  recovered: boolean;
}

export default function Automacao() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // === DATA QUERIES ===

  const { data: rules = [], isLoading: loadingRules } = useQuery({
    queryKey: ["automation-rules", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("automation_rules").select("*").eq("user_id", user!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data as AutomationRule[];
    },
    enabled: !!user,
  });

  const { data: executions = [], isLoading: loadingExecs } = useQuery({
    queryKey: ["automation-executions", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("automation_executions").select("*").eq("user_id", user!.id).order("sent_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data as AutomationExecution[];
    },
    enabled: !!user,
  });

  // Total customers
  const { data: totalCustomers = 0 } = useQuery({
    queryKey: ["automation-total-customers", user?.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("customers").select("*", { count: "exact", head: true }).eq("store_user_id", user!.id);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!user,
  });

  // Customers with push subscriptions
  const { data: pushCustomerCount = 0 } = useQuery({
    queryKey: ["automation-push-customers", user?.id],
    queryFn: async () => {
      // Get customer auth_user_ids, then check push_subscriptions
      const { data: customers } = await supabase
        .from("customers").select("auth_user_id").eq("store_user_id", user!.id);
      if (!customers || customers.length === 0) return 0;
      const ids = customers.map(c => c.auth_user_id).filter(Boolean);
      if (ids.length === 0) return 0;
      const { count } = await supabase
        .from("push_subscriptions").select("user_id", { count: "exact", head: true }).in("user_id", ids);
      return count || 0;
    },
    enabled: !!user,
  });

  // Wishlist count
  const { data: wishlistCount = 0 } = useQuery({
    queryKey: ["automation-wishlist-count", user?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("customer_wishlist").select("*", { count: "exact", head: true }).eq("store_user_id", user!.id);
      return count || 0;
    },
    enabled: !!user,
  });

  // Abandoned carts (detailed)
  const { data: abandonedCarts = [] } = useQuery({
    queryKey: ["abandoned-carts-detail", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("abandoned_carts").select("*").eq("user_id", user!.id).eq("recovered", false)
        .order("abandoned_at", { ascending: false }).limit(50);
      if (error) throw error;
      return (data || []) as AbandonedCart[];
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  // Customer names map for abandoned carts
  const customerIds = [...new Set(abandonedCarts.map(c => c.customer_id).filter(Boolean))];
  const { data: customerNames = {} } = useQuery({
    queryKey: ["automation-customer-names", customerIds.join(",")],
    queryFn: async () => {
      if (customerIds.length === 0) return {};
      const { data } = await supabase
        .from("customers").select("id, name, email").in("id", customerIds as string[]);
      const map: Record<string, { name: string; email: string }> = {};
      (data || []).forEach((c: any) => { map[c.id] = { name: c.name, email: c.email }; });
      return map;
    },
    enabled: customerIds.length > 0,
  });

  // Execution stats
  const sentToday = executions.filter(e => {
    const d = new Date(e.sent_at);
    const now = new Date();
    return d.toDateString() === now.toDateString() && e.status === "sent";
  }).length;

  const failedToday = executions.filter(e => {
    const d = new Date(e.sent_at);
    const now = new Date();
    return d.toDateString() === now.toDateString() && e.status === "failed";
  }).length;

  const totalAbandoned = abandonedCarts.length;
  const totalAbandonedValue = abandonedCarts.reduce((s, c) => s + (c.total || 0), 0);
  const pendingReminder = abandonedCarts.filter(c => c.reminder_sent_count === 0).length;

  // === MUTATIONS ===

  const toggleRule = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await supabase.from("automation_rules").update({ enabled }).eq("id", id).eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automation-rules"] });
      toast.success("Regra atualizada!");
    },
  });

  const createDefaults = useMutation({
    mutationFn: async () => {
      const defaults = [
        { user_id: user!.id, name: "Recuperar Carrinho Abandonado", trigger_type: "abandoned_cart", channel: "push", wait_minutes: 30, cooldown_minutes: 60, max_sends_per_day: 3, ai_generated: true, ai_tone: "friendly", enabled: true, message_template: "Olá {customer_name}! Você deixou itens no carrinho. Volte e finalize sua compra! 🛒" },
        { user_id: user!.id, name: "Alerta Diário de Promoções", trigger_type: "daily_promo", channel: "push", wait_minutes: 0, cooldown_minutes: 1440, max_sends_per_day: 1, ai_generated: true, ai_tone: "exciting", enabled: true, message_template: "🔥 Confira as novidades e ofertas do dia na nossa loja!" },
        { user_id: user!.id, name: "Lembrete de Wishlist", trigger_type: "wishlist_reminder", channel: "push", wait_minutes: 1440, cooldown_minutes: 4320, max_sends_per_day: 1, ai_generated: true, ai_tone: "friendly", enabled: false, message_template: "💜 Os produtos da sua lista de desejos ainda estão disponíveis!" },
      ];
      const { error } = await supabase.from("automation_rules").insert(defaults);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automation-rules"] });
      toast.success("Regras padrão criadas!");
    },
  });

  const triggerRecovery = useMutation({
    mutationFn: async (triggerType: string = "abandoned_cart") => {
      const resp = await supabase.functions.invoke("recover-abandoned-carts", {
        body: { trigger_type: triggerType, store_user_id: user?.id },
      });
      if (resp.error) throw resp.error;
      return resp.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["automation-executions"] });
      queryClient.invalidateQueries({ queryKey: ["abandoned-carts-detail"] });
      toast.success(`Automação executada! Enviados: ${data?.sent || 0}, Processados: ${data?.processed || 0}`);
    },
    onError: (err: any) => {
      toast.error("Erro ao executar: " + (err.message || "Erro desconhecido"));
    },
  });

  // === HELPERS ===

  const statusColor = (s: string) => s === "sent" ? "default" : s === "failed" ? "destructive" : "secondary";
  const triggerLabel = (t: string) => ({ abandoned_cart: "Carrinho Abandonado", daily_promo: "Promoção Diária", wishlist_reminder: "Lembrete Wishlist", restock: "Reposição" }[t] || t);
  const pushCoverage = totalCustomers > 0 ? Math.round((pushCustomerCount / totalCustomers) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Bot className="h-6 w-6 text-primary" /> Automação IA
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          IA comandando 100% das mensagens automáticas para seus clientes.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
              <Users className="h-3.5 w-3.5" /> Total de Clientes
            </div>
            <p className="text-2xl font-bold">{totalCustomers}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
              <BellRing className="h-3.5 w-3.5" /> Com Push Ativo
            </div>
            <p className="text-2xl font-bold">{pushCustomerCount}</p>
            <Progress value={pushCoverage} className="mt-2 h-1.5" />
            <p className="text-[10px] text-muted-foreground mt-1">{pushCoverage}% cobertura push</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
              <ShoppingCart className="h-3.5 w-3.5" /> Carrinhos Abandonados
            </div>
            <p className="text-2xl font-bold">{totalAbandoned}</p>
            <p className="text-xs text-muted-foreground">R$ {totalAbandonedValue.toFixed(2)} em vendas potenciais</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
              <TrendingUp className="h-3.5 w-3.5" /> Envios Hoje
            </div>
            <p className="text-2xl font-bold text-primary">{sentToday}</p>
            {failedToday > 0 && (
              <p className="text-xs text-destructive flex items-center gap-1"><AlertTriangle className="h-3 w-3" />{failedToday} falhos</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Extra stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-500/10 text-orange-600"><Clock className="h-5 w-5" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Aguardando 1º lembrete</p>
              <p className="text-lg font-bold">{pendingReminder} clientes</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-pink-500/10 text-pink-600"><Heart className="h-5 w-5" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Itens na Wishlist</p>
              <p className="text-lg font-bold">{wishlistCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-2 lg:col-span-1">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Disparar IA agora</p>
                <p className="text-[11px] text-muted-foreground">Recuperar carrinhos abandonados</p>
              </div>
              <Button size="sm" onClick={() => triggerRecovery.mutate()} disabled={triggerRecovery.isPending}>
                {triggerRecovery.isPending ? <RefreshCw className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
                Executar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="carts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="carts" className="gap-1.5"><ShoppingCart className="h-4 w-4" /> Carrinhos ({totalAbandoned})</TabsTrigger>
          <TabsTrigger value="rules" className="gap-1.5"><Zap className="h-4 w-4" /> Regras</TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5"><History className="h-4 w-4" /> Histórico</TabsTrigger>
        </TabsList>

        {/* === CARRINHOS ABANDONADOS === */}
        <TabsContent value="carts">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Carrinhos Abandonados em Tempo Real</CardTitle>
              <CardDescription>Clientes que adicionaram produtos e não finalizaram a compra</CardDescription>
            </CardHeader>
            <CardContent>
              {abandonedCarts.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhum carrinho abandonado no momento 🎉</p>
              ) : (
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Itens</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Abandonado há</TableHead>
                        <TableHead>Lembretes</TableHead>
                        <TableHead>Status IA</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {abandonedCarts.map((cart) => {
                        const customer = cart.customer_id ? (customerNames as any)[cart.customer_id] : null;
                        const items = Array.isArray(cart.items) ? cart.items : [];
                        const timeSince = formatDistanceToNow(new Date(cart.abandoned_at), { locale: ptBR, addSuffix: true });
                        const minutesSince = (Date.now() - new Date(cart.abandoned_at).getTime()) / 60000;
                        const isUrgent = minutesSince > 60 && cart.reminder_sent_count === 0;

                        return (
                          <TableRow key={cart.id} className={isUrgent ? "bg-destructive/5" : ""}>
                            <TableCell>
                              <p className="text-sm font-medium">{customer?.name || "Cliente"}</p>
                              <p className="text-[10px] text-muted-foreground">{customer?.email || "—"}</p>
                            </TableCell>
                            <TableCell>
                              <p className="text-sm">{items.length} produto(s)</p>
                              <p className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                                {items.slice(0, 2).map((i: any) => i.name).join(", ")}
                              </p>
                            </TableCell>
                            <TableCell className="font-medium text-sm">R$ {Number(cart.total).toFixed(2)}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                {isUrgent && <AlertTriangle className="h-3 w-3 text-destructive" />}
                                <span className={`text-xs ${isUrgent ? "text-destructive font-medium" : ""}`}>{timeSince}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={cart.reminder_sent_count > 0 ? "default" : "outline"} className="text-[10px]">
                                {cart.reminder_sent_count}/{3}
                              </Badge>
                              {cart.last_reminder_at && (
                                <p className="text-[9px] text-muted-foreground mt-0.5">
                                  Último: {format(new Date(cart.last_reminder_at), "dd/MM HH:mm")}
                                </p>
                              )}
                            </TableCell>
                            <TableCell>
                              {cart.reminder_sent_count >= 3 ? (
                                <Badge variant="secondary" className="text-[10px]">Completo</Badge>
                              ) : cart.reminder_sent_count > 0 ? (
                                <Badge className="text-[10px] bg-primary/80">Seguindo</Badge>
                              ) : minutesSince >= 30 ? (
                                <Badge variant="destructive" className="text-[10px]">Pendente</Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px]">
                                  <Clock className="h-2.5 w-2.5 mr-0.5" />
                                  Aguardando {Math.max(0, Math.ceil(30 - minutesSince))}min
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* === REGRAS === */}
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
                  <Switch checked={rule.enabled} onCheckedChange={(v) => toggleRule.mutate({ id: rule.id, enabled: v })} disabled={toggleRule.isPending} />
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <div><span className="text-muted-foreground text-xs">Aguardar</span><p className="font-medium">{rule.wait_minutes} min</p></div>
                  <div><span className="text-muted-foreground text-xs">Cooldown</span><p className="font-medium">{rule.cooldown_minutes || 60} min</p></div>
                  <div><span className="text-muted-foreground text-xs">Máx/dia</span><p className="font-medium">{rule.max_sends_per_day || 3}</p></div>
                  <div><span className="text-muted-foreground text-xs">Tom IA</span><p className="font-medium capitalize">{rule.ai_tone || "amigável"}</p></div>
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
        </TabsContent>

        {/* === HISTÓRICO === */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Histórico de Envios</CardTitle>
              <CardDescription>Últimos 100 envios automáticos da IA</CardDescription>
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
                          <TableCell className="text-xs whitespace-nowrap">{format(new Date(exec.sent_at), "dd/MM HH:mm")}</TableCell>
                          <TableCell className="text-xs">{triggerLabel(exec.trigger_type)}</TableCell>
                          <TableCell><Badge variant="outline" className="text-[10px]">{exec.channel}</Badge></TableCell>
                          <TableCell className="max-w-[200px] truncate text-xs">{exec.message_text || "—"}</TableCell>
                          <TableCell>{exec.ai_generated ? "✅" : "—"}</TableCell>
                          <TableCell>
                            <Badge variant={statusColor(exec.status)} className="text-[10px]">{exec.status}</Badge>
                            {exec.error_message && <p className="text-[10px] text-destructive mt-0.5 max-w-[150px] truncate">{exec.error_message}</p>}
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
