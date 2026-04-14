import { useState, useEffect } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Bot, ShoppingCart, Bell, History, Zap, RefreshCw, Send, Users, BellRing, Heart,
  Clock, TrendingUp, AlertTriangle, Settings2, Timer, CheckCircle2, XCircle, Eye,
  Sparkles, MessageCircle, Gift, UserPlus, Hourglass
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PlanGate } from "@/components/PlanGate";
import { AITrainingAlert } from "@/components/admin/AITrainingAlert";
import { useTenantContext } from "@/hooks/useTenantContext";
import { useStoreSettings } from "@/hooks/useStoreSettings";
import { canAccess } from "@/lib/planPermissions";

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
  allowed_hours_start: number | null;
  allowed_hours_end: number | null;
  target_segment: string | null;
  offer_discount: boolean;
  discount_code: string | null;
  discount_percentage: number | null;
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

function LiveCountdown({ targetMinutes, abandonedAt }: { targetMinutes: number; abandonedAt: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const elapsedMs = now - new Date(abandonedAt).getTime();
  const targetMs = targetMinutes * 60 * 1000;
  const remainMs = targetMs - elapsedMs;

  if (remainMs <= 0) return null;

  const mins = Math.floor(remainMs / 60000);
  const secs = Math.floor((remainMs % 60000) / 1000);
  const pct = Math.min(100, (elapsedMs / targetMs) * 100);

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-xs">
        <Hourglass className="h-3 w-3 text-amber-500 animate-pulse" />
        <span className="font-mono font-medium text-amber-600">{mins}:{secs.toString().padStart(2, "0")}</span>
      </div>
      <Progress value={pct} className="h-1" />
    </div>
  );
}

function CartStatusBadge({ cart, waitMinutes }: { cart: AbandonedCart; waitMinutes: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);

  const minutesSince = (now - new Date(cart.abandoned_at).getTime()) / 60000;

  if (cart.recovered) {
    return <Badge variant="secondary" className="text-[10px] gap-1"><CheckCircle2 className="h-2.5 w-2.5" /> Comprou</Badge>;
  }
  if (cart.reminder_sent_count >= 5) {
    return <Badge variant="outline" className="text-[10px] gap-1"><CheckCircle2 className="h-2.5 w-2.5" /> Completo</Badge>;
  }
  if (cart.reminder_sent_count > 0) {
    return (
      <div className="space-y-0.5">
        <Badge className="text-[10px] bg-primary/80 gap-1"><MessageCircle className="h-2.5 w-2.5" /> Enviado {cart.reminder_sent_count}x</Badge>
        {cart.last_reminder_at && (
          <p className="text-[9px] text-muted-foreground">
            Último: {format(new Date(cart.last_reminder_at), "dd/MM HH:mm")}
          </p>
        )}
      </div>
    );
  }
  if (minutesSince >= waitMinutes) {
    return <Badge variant="destructive" className="text-[10px] gap-1"><AlertTriangle className="h-2.5 w-2.5" /> Pronto p/ envio</Badge>;
  }

  return (
    <div className="space-y-1">
      <Badge variant="outline" className="text-[10px] gap-1">
        <Clock className="h-2.5 w-2.5 animate-pulse" /> Aguardando
      </Badge>
      <LiveCountdown targetMinutes={waitMinutes} abandonedAt={cart.abandoned_at} />
    </div>
  );
}

export default function Automacao() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { ctx } = useTenantContext();
  const { data: storeSettings } = useStoreSettings();
  const hasAiTools = canAccess("ai_tools", ctx);
  const [editingRule, setEditingRule] = useState<string | null>(null);
  const [ruleEdits, setRuleEdits] = useState<Record<string, Partial<AutomationRule>>>({});

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

  const waitMinutes = rules.find(r => r.trigger_type === "abandoned_cart")?.wait_minutes ?? 20;

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

  const { data: totalCustomers = 0 } = useQuery({
    queryKey: ["automation-total-customers", user?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("customers").select("*", { count: "exact", head: true }).eq("store_user_id", user!.id);
      return count || 0;
    },
    enabled: !!user,
  });

  const { data: pushCustomerCount = 0 } = useQuery({
    queryKey: ["automation-push-customers", user?.id],
    queryFn: async () => {
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

  const { data: wishlistCount = 0 } = useQuery({
    queryKey: ["automation-wishlist-count", user?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("customer_wishlist").select("*", { count: "exact", head: true }).eq("store_user_id", user!.id);
      return count || 0;
    },
    enabled: !!user,
  });

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
    refetchInterval: 15000,
  });

  const { data: aiConfig } = useQuery({
    queryKey: ["tenant-ai-brain-config", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("tenant_ai_brain_config").select("niche").eq("user_id", user!.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const customerIds = [...new Set(abandonedCarts.map(c => c.customer_id).filter(Boolean))];
  const { data: customerNames = {} } = useQuery({
    queryKey: ["automation-customer-names", customerIds.join(",")],
    queryFn: async () => {
      if (customerIds.length === 0) return {};
      const { data } = await supabase
        .from("customers").select("id, name, email, phone").in("id", customerIds as string[]);
      const map: Record<string, { name: string; email: string; phone: string }> = {};
      (data || []).forEach((c: any) => { map[c.id] = { name: c.name, email: c.email, phone: c.phone }; });
      return map;
    },
    enabled: customerIds.length > 0,
  });

  // Stats
  const sentToday = executions.filter(e => {
    const d = new Date(e.sent_at);
    return d.toDateString() === new Date().toDateString() && e.status === "sent";
  }).length;

  const failedToday = executions.filter(e => {
    const d = new Date(e.sent_at);
    return d.toDateString() === new Date().toDateString() && e.status === "failed";
  }).length;

  const totalAbandoned = abandonedCarts.length;
  const totalAbandonedValue = abandonedCarts.reduce((s, c) => s + (c.total || 0), 0);
  const pendingReminder = abandonedCarts.filter(c => c.reminder_sent_count === 0).length;
  const activelyTracking = abandonedCarts.filter(c => {
    const mins = (Date.now() - new Date(c.abandoned_at).getTime()) / 60000;
    return mins < waitMinutes && c.reminder_sent_count === 0;
  }).length;
  const readyToSend = abandonedCarts.filter(c => {
    const mins = (Date.now() - new Date(c.abandoned_at).getTime()) / 60000;
    return mins >= waitMinutes && c.reminder_sent_count === 0;
  }).length;

  const pushCoverage = totalCustomers > 0 ? Math.round((pushCustomerCount / totalCustomers) * 100) : 0;

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

  const updateRule = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<AutomationRule> }) => {
      const { error } = await supabase.from("automation_rules").update(updates).eq("id", id).eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automation-rules"] });
      setEditingRule(null);
      setRuleEdits({});
      toast.success("Regra salva!");
    },
  });

  const createDefaults = useMutation({
    mutationFn: async () => {
      const defaults = [
        { user_id: user!.id, name: "Recuperar Carrinho Abandonado", trigger_type: "abandoned_cart", channel: "push", wait_minutes: 20, cooldown_minutes: 60, max_sends_per_day: 6, ai_generated: true, ai_tone: "friendly", enabled: true, message_template: "Olá {customer_name}! Você deixou itens no carrinho. Volte e finalize!", offer_discount: false, discount_code: "", discount_percentage: 0 },
        { user_id: user!.id, name: "Boas-vindas Novo Cliente", trigger_type: "new_customer", channel: "push", wait_minutes: 0, cooldown_minutes: 0, max_sends_per_day: 50, ai_generated: true, ai_tone: "joyful", enabled: true, message_template: "Bem-vindo(a) à nossa loja! 🎉" },
        { user_id: user!.id, name: "Campanhas Promocionais", trigger_type: "daily_promo", channel: "push", wait_minutes: 0, cooldown_minutes: 180, max_sends_per_day: 6, ai_generated: true, ai_tone: "exciting", enabled: true, message_template: "🔥 Confira as novidades e ofertas!" },
        { user_id: user!.id, name: "Lembrete de Wishlist", trigger_type: "wishlist_reminder", channel: "push", wait_minutes: 1440, cooldown_minutes: 4320, max_sends_per_day: 1, ai_generated: true, ai_tone: "friendly", enabled: false, message_template: "💜 Os produtos da sua lista de desejos estão disponíveis!" },
        { user_id: user!.id, name: "Novo Produto Adicionado", trigger_type: "new_product", channel: "push", wait_minutes: 10, cooldown_minutes: 0, max_sends_per_day: 10, ai_generated: true, ai_tone: "exciting", enabled: true, message_template: "🆕 Acabou de chegar: {product_name}! Confira!" },
      ];
      // Insert one by one to avoid partial failures
      for (const rule of defaults) {
        const { error } = await supabase.from("automation_rules").insert(rule);
        if (error) {
          console.error("Error creating rule:", rule.name, error);
          // Skip duplicates, throw on other errors
          if (!error.message?.includes("duplicate")) throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automation-rules"] });
      toast.success("Regras padrão criadas com sucesso! ✅");
    },
    onError: (err: any) => {
      console.error("createDefaults error:", err);
      toast.error("Erro ao criar regras: " + (err.message || "Erro desconhecido"));
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
      toast.success(`✅ IA executou! Enviados: ${data?.sent || 0}, Processados: ${data?.processed || 0}`);
    },
    onError: (err: any) => {
      toast.error("Erro ao executar: " + (err.message || "Erro desconhecido"));
    },
  });

  // === HELPERS ===

  const statusColor = (s: string) => s === "sent" ? "default" : s === "failed" ? "destructive" : s === "skipped" ? "outline" : "secondary";
  const triggerLabel = (t: string) => ({
    abandoned_cart: "🛒 Carrinho Abandonado",
    daily_promo: "📢 Promoção Diária",
    promo_campaign: "🎯 Campanha Promo",
    wishlist_reminder: "💜 Lembrete Wishlist",
    new_customer: "🎉 Novo Cliente",
    review_thankyou: "⭐ Avaliação",
    restock: "📦 Reposição",
    new_product: "🆕 Novo Produto",
    product_view: "👀 Retargeting Produto",
    inactivity: "💤 Reengajamento",
  }[t] || t);

  const triggerIcon = (t: string) => {
    const map: Record<string, React.ReactNode> = {
      abandoned_cart: <ShoppingCart className="h-5 w-5" />,
      daily_promo: <Gift className="h-5 w-5" />,
      new_customer: <UserPlus className="h-5 w-5" />,
      wishlist_reminder: <Heart className="h-5 w-5" />,
      new_product: <Sparkles className="h-5 w-5" />,
    };
    return map[t] || <Zap className="h-5 w-5" />;
  };

  const getRuleEdit = (ruleId: string) => ruleEdits[ruleId] || {};
  const setRuleEdit = (ruleId: string, field: string, value: any) => {
    setRuleEdits(prev => ({ ...prev, [ruleId]: { ...prev[ruleId], [field]: value } }));
  };

  return (
    <PlanGate feature="automation">
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bot className="h-6 w-6 text-primary" /> Automação IA
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            IA comandando 100% das mensagens automáticas para seus clientes.
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => {
            queryClient.invalidateQueries({ queryKey: ["abandoned-carts-detail"] });
            queryClient.invalidateQueries({ queryKey: ["automation-executions"] });
          }}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Atualizar
          </Button>
        </div>
      </div>

      {hasAiTools && !aiConfig?.niche && (
        <AITrainingAlert />
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
              <Users className="h-3.5 w-3.5" /> Total Clientes
            </div>
            <p className="text-2xl font-bold">{totalCustomers}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
              <BellRing className="h-3.5 w-3.5" /> Push Ativo
            </div>
            <p className="text-2xl font-bold">{pushCustomerCount}</p>
            <Progress value={pushCoverage} className="mt-1.5 h-1.5" />
            <p className="text-[10px] text-muted-foreground mt-0.5">{pushCoverage}% cobertura</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
              <ShoppingCart className="h-3.5 w-3.5" /> Carrinhos
            </div>
            <p className="text-2xl font-bold">{totalAbandoned}</p>
            <p className="text-[10px] text-muted-foreground">R$ {totalAbandonedValue.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
              <TrendingUp className="h-3.5 w-3.5" /> Enviados Hoje
            </div>
            <p className="text-2xl font-bold text-primary">{sentToday}</p>
            {failedToday > 0 && (
              <p className="text-[10px] text-destructive flex items-center gap-1"><XCircle className="h-3 w-3" />{failedToday} falhos</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
              <Heart className="h-3.5 w-3.5" /> Wishlist
            </div>
            <p className="text-2xl font-bold">{wishlistCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Live status row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600"><Hourglass className="h-5 w-5 animate-pulse" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Aguardando ({waitMinutes}min)</p>
              <p className="text-lg font-bold">{activelyTracking}</p>
              <p className="text-[10px] text-muted-foreground">Contagem regressiva ativa</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/10 text-red-600"><AlertTriangle className="h-5 w-5" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Pronto p/ envio</p>
              <p className="text-lg font-bold">{readyToSend}</p>
              <p className="text-[10px] text-muted-foreground">Sem lembrete enviado</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary"><MessageCircle className="h-5 w-5" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Em seguimento</p>
              <p className="text-lg font-bold">{abandonedCarts.filter(c => c.reminder_sent_count > 0 && c.reminder_sent_count < 5).length}</p>
              <p className="text-[10px] text-muted-foreground">IA enviando a cada 1h</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 space-y-2">
            <p className="font-medium text-sm flex items-center gap-1.5"><Sparkles className="h-4 w-4 text-primary" /> Disparar IA</p>
            <div className="flex flex-wrap gap-1.5">
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => triggerRecovery.mutate("abandoned_cart")} disabled={triggerRecovery.isPending}>
                {triggerRecovery.isPending ? <RefreshCw className="h-3 w-3 animate-spin mr-1" /> : <ShoppingCart className="h-3 w-3 mr-1" />}
                Carrinhos
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => triggerRecovery.mutate("new_customer")} disabled={triggerRecovery.isPending}>
                <UserPlus className="h-3 w-3 mr-1" /> Boas-vindas
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => triggerRecovery.mutate("daily_promo")} disabled={triggerRecovery.isPending}>
                <Send className="h-3 w-3 mr-1" /> Promo
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="carts" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="carts" className="gap-1.5"><ShoppingCart className="h-4 w-4" /> Carrinhos ({totalAbandoned})</TabsTrigger>
          <TabsTrigger value="rules" className="gap-1.5"><Settings2 className="h-4 w-4" /> Configuração</TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5"><History className="h-4 w-4" /> Histórico ({executions.length})</TabsTrigger>
        </TabsList>

        {/* === CARRINHOS ABANDONADOS === */}
        <TabsContent value="carts">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Eye className="h-4 w-4 text-primary" /> Monitoramento em Tempo Real
              </CardTitle>
              <CardDescription>
                Carrinhos são rastreados automaticamente. A IA envia a 1ª mensagem após {waitMinutes}min de abandono, depois a cada 1h (até 5 envios).
              </CardDescription>
            </CardHeader>
            <CardContent>
              {abandonedCarts.length === 0 ? (
                <div className="text-center py-12 space-y-2">
                  <CheckCircle2 className="h-10 w-10 mx-auto text-green-500" />
                  <p className="text-muted-foreground">Nenhum carrinho abandonado no momento 🎉</p>
                  <p className="text-xs text-muted-foreground">Quando um cliente adicionar produtos e não finalizar, aparecerá aqui automaticamente.</p>
                </div>
              ) : (
                <ScrollArea className="h-[450px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Itens</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Abandonado há</TableHead>
                        <TableHead>Status IA</TableHead>
                        <TableHead>Lembretes</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {abandonedCarts.map((cart) => {
                        const customer = cart.customer_id ? (customerNames as any)[cart.customer_id] : null;
                        const items = Array.isArray(cart.items) ? cart.items : [];
                        const timeSince = formatDistanceToNow(new Date(cart.abandoned_at), { locale: ptBR, addSuffix: true });
                        const minutesSince = (Date.now() - new Date(cart.abandoned_at).getTime()) / 60000;

                        return (
                          <TableRow key={cart.id} className={minutesSince >= waitMinutes && cart.reminder_sent_count === 0 ? "bg-destructive/5" : minutesSince < waitMinutes ? "bg-amber-500/5" : ""}>
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
                              <span className="text-xs">{timeSince}</span>
                            </TableCell>
                            <TableCell>
                              <CartStatusBadge cart={cart} waitMinutes={waitMinutes} />
                            </TableCell>
                            <TableCell>
                              <Badge variant={cart.reminder_sent_count > 0 ? "default" : "outline"} className="text-[10px]">
                                {cart.reminder_sent_count}/5
                              </Badge>
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

        {/* === CONFIGURAÇÃO DE REGRAS === */}
        <TabsContent value="rules" className="space-y-4">
          {rules.length === 0 && !loadingRules && (
            <Card>
              <CardContent className="py-12 text-center space-y-4">
                <Bot className="h-12 w-12 mx-auto text-muted-foreground/50" />
                <p className="text-muted-foreground">Nenhuma regra de automação configurada.</p>
                <Button onClick={() => createDefaults.mutate()} disabled={createDefaults.isPending}>
                  <Zap className="h-4 w-4 mr-2" /> Criar Regras Padrão com IA
                </Button>
              </CardContent>
            </Card>
          )}

          {rules.map((rule) => {
            const isEditing = editingRule === rule.id;
            const edits = getRuleEdit(rule.id);
            const currentWait = edits.wait_minutes ?? rule.wait_minutes;
            const currentCooldown = edits.cooldown_minutes ?? rule.cooldown_minutes ?? 60;
            const currentMaxSends = edits.max_sends_per_day ?? rule.max_sends_per_day ?? 6;
            const currentTone = edits.ai_tone ?? rule.ai_tone ?? "friendly";
            const currentTemplate = edits.message_template ?? rule.message_template ?? "";
            const currentHoursStart = edits.allowed_hours_start ?? rule.allowed_hours_start;
            const currentHoursEnd = edits.allowed_hours_end ?? rule.allowed_hours_end;
            const currentOfferDiscount = edits.offer_discount ?? (rule as any).offer_discount ?? false;
            const currentDiscountCode = edits.discount_code ?? (rule as any).discount_code ?? "";
            const currentDiscountPercentage = edits.discount_percentage ?? (rule as any).discount_percentage ?? 0;
            const isAbandonedCart = rule.trigger_type === "abandoned_cart";

            return (
              <Card key={rule.id} className={`transition-all ${rule.enabled ? "border-primary/20" : "opacity-60"}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${rule.enabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                        {triggerIcon(rule.trigger_type)}
                      </div>
                      <div>
                        <CardTitle className="text-base">{rule.name}</CardTitle>
                        <CardDescription className="text-xs mt-0.5">
                          {triggerLabel(rule.trigger_type)} · Canal: {rule.channel.toUpperCase()}
                          {rule.ai_generated && <Badge variant="secondary" className="ml-2 text-[10px] px-1.5 py-0">🤖 IA</Badge>}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => {
                        if (isEditing) { setEditingRule(null); setRuleEdits(prev => { const n = { ...prev }; delete n[rule.id]; return n; }); }
                        else setEditingRule(rule.id);
                      }}>
                        <Settings2 className="h-3.5 w-3.5 mr-1" /> {isEditing ? "Fechar" : "Editar"}
                      </Button>
                      <Switch checked={rule.enabled} onCheckedChange={(v) => toggleRule.mutate({ id: rule.id, enabled: v })} disabled={toggleRule.isPending} />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {!isEditing ? (
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
                      <div><span className="text-muted-foreground text-xs">Aguardar</span><p className="font-medium">{rule.wait_minutes} min</p></div>
                      <div><span className="text-muted-foreground text-xs">Cooldown</span><p className="font-medium">{rule.cooldown_minutes || 60} min</p></div>
                      <div>
                        <span className="text-muted-foreground text-xs">Frequência</span>
                        <p className="font-medium">
                          {(rule.max_sends_per_day || 6) <= 4 ? "🟢 Baixa" : (rule.max_sends_per_day || 6) <= 7 ? "🟡 Média" : "🔴 Agressiva"}
                          <span className="text-xs text-muted-foreground ml-1">({rule.max_sends_per_day || 6}/dia)</span>
                        </p>
                      </div>
                      <div><span className="text-muted-foreground text-xs">Tom IA</span><p className="font-medium capitalize">{rule.ai_tone || "amigável"}</p></div>
                      <div>
                        <span className="text-muted-foreground text-xs">Horário</span>
                        <p className="font-medium">
                          {rule.allowed_hours_start != null && rule.allowed_hours_end != null
                            ? `${rule.allowed_hours_start}h - ${rule.allowed_hours_end}h`
                            : "24h"}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4 border-t pt-4">
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Aguardar (min)</Label>
                          <Input type="number" min={0} value={currentWait} onChange={e => setRuleEdit(rule.id, "wait_minutes", parseInt(e.target.value) || 0)} className="h-8 text-sm" />
                          <p className="text-[10px] text-muted-foreground">Tempo antes do 1º envio</p>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Cooldown (min)</Label>
                          <Input type="number" min={0} value={currentCooldown} onChange={e => setRuleEdit(rule.id, "cooldown_minutes", parseInt(e.target.value) || 0)} className="h-8 text-sm" />
                          <p className="text-[10px] text-muted-foreground">Intervalo entre envios</p>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Nível de frequência</Label>
                          <Select value={currentMaxSends <= 4 ? "low" : currentMaxSends <= 7 ? "medium" : "aggressive"} onValueChange={v => {
                            const presets: Record<string, number> = { low: 4, medium: 6, aggressive: 10 };
                            setRuleEdit(rule.id, "max_sends_per_day", presets[v] || 6);
                          }}>
                            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="low">🟢 Baixa (4/dia)</SelectItem>
                              <SelectItem value="medium">🟡 Média (6/dia)</SelectItem>
                              <SelectItem value="aggressive">🔴 Agressiva (10/dia)</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-[10px] text-muted-foreground">Controla limite diário + cooldown entre envios</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Tom da IA</Label>
                          <Select value={currentTone} onValueChange={v => setRuleEdit(rule.id, "ai_tone", v)}>
                            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="friendly">😊 Amigável</SelectItem>
                              <SelectItem value="joyful">🎉 Alegre</SelectItem>
                              <SelectItem value="exciting">🔥 Empolgante</SelectItem>
                              <SelectItem value="elegant">✨ Elegante</SelectItem>
                              <SelectItem value="urgent">⚡ Urgente</SelectItem>
                              <SelectItem value="funny">😄 Divertido</SelectItem>
                              <SelectItem value="romantic">💕 Romântico</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Horário início</Label>
                          <Input type="number" min={0} max={23} placeholder="Ex: 8" value={currentHoursStart ?? ""} onChange={e => setRuleEdit(rule.id, "allowed_hours_start", e.target.value ? parseInt(e.target.value) : null)} className="h-8 text-sm" />
                          <p className="text-[10px] text-muted-foreground">Vazio = 24h</p>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Horário fim</Label>
                          <Input type="number" min={0} max={23} placeholder="Ex: 22" value={currentHoursEnd ?? ""} onChange={e => setRuleEdit(rule.id, "allowed_hours_end", e.target.value ? parseInt(e.target.value) : null)} className="h-8 text-sm" />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs">Template base (a IA usará como referência)</Label>
                        <Textarea value={currentTemplate} onChange={e => setRuleEdit(rule.id, "message_template", e.target.value)} className="text-sm min-h-[60px]" placeholder="Ex: Olá {customer_name}! Volte e finalize sua compra 🛒" />
                        <p className="text-[10px] text-muted-foreground">Variáveis: {"{customer_name}"}, {"{store_name}"}, {"{item_count}"}, {"{total_value}"}</p>
                      </div>

                      {isAbandonedCart && (
                        <div className="space-y-3 p-3 rounded-lg border border-border bg-muted/30">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium flex items-center gap-1.5"><Gift className="h-4 w-4 text-primary" /> Oferecer desconto na recuperação</p>
                              <p className="text-[10px] text-muted-foreground">A IA incluirá o cupom na mensagem de recuperação</p>
                            </div>
                            <Switch
                              checked={currentOfferDiscount}
                              onCheckedChange={(v) => setRuleEdit(rule.id, "offer_discount", v)}
                            />
                          </div>
                          {currentOfferDiscount && (
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <Label className="text-xs">Código do cupom</Label>
                                <Input value={currentDiscountCode} onChange={e => setRuleEdit(rule.id, "discount_code", e.target.value.toUpperCase())} className="h-8 text-sm" placeholder="Ex: VOLTA10" />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">% de desconto</Label>
                                <Input type="number" min={1} max={100} value={currentDiscountPercentage} onChange={e => setRuleEdit(rule.id, "discount_percentage", parseInt(e.target.value) || 0)} className="h-8 text-sm" placeholder="10" />
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => { setEditingRule(null); setRuleEdits(prev => { const n = { ...prev }; delete n[rule.id]; return n; }); }}>
                          Cancelar
                        </Button>
                        <Button size="sm" onClick={() => updateRule.mutate({ id: rule.id, updates: edits })} disabled={updateRule.isPending || Object.keys(edits).length === 0}>
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Salvar
                        </Button>
                      </div>
                    </div>
                  )}

                  {!isEditing && rule.message_template && (
                    <div className="mt-3 p-3 bg-muted/50 rounded-md text-sm text-muted-foreground">
                      <span className="text-xs font-medium text-foreground">Template:</span>
                      <p className="mt-1">{rule.message_template}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}

          {rules.length > 0 && (
            <Card className="border-dashed">
              <CardContent className="py-6 text-center">
                <p className="text-sm text-muted-foreground mb-2">Quer mais regras? Adicione as regras padrão que ainda não existem.</p>
                <Button size="sm" variant="outline" onClick={() => createDefaults.mutate()} disabled={createDefaults.isPending}>
                  <Zap className="h-3.5 w-3.5 mr-1" /> Adicionar Regras Padrão
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* === HISTÓRICO === */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <History className="h-4 w-4 text-primary" /> Histórico de Envios da IA
              </CardTitle>
              <CardDescription>Últimos 100 envios automáticos — veja o que a IA mandou para seus clientes</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingExecs ? (
                <p className="text-center text-muted-foreground py-8">Carregando...</p>
              ) : executions.length === 0 ? (
                <div className="text-center py-12 space-y-2">
                  <Timer className="h-10 w-10 mx-auto text-muted-foreground/30" />
                  <p className="text-muted-foreground">Nenhum envio registrado.</p>
                  <p className="text-xs text-muted-foreground">Quando a IA enviar mensagens, aparecerá aqui.</p>
                </div>
              ) : (
                <ScrollArea className="h-[450px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Canal</TableHead>
                        <TableHead>Mensagem da IA</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {executions.map((exec) => (
                        <TableRow key={exec.id}>
                          <TableCell className="text-xs whitespace-nowrap">{format(new Date(exec.sent_at), "dd/MM HH:mm")}</TableCell>
                          <TableCell className="text-xs">{triggerLabel(exec.trigger_type)}</TableCell>
                          <TableCell><Badge variant="outline" className="text-[10px]">{exec.channel}</Badge></TableCell>
                          <TableCell className="max-w-[250px]">
                            <p className="text-xs truncate">{exec.message_text || "—"}</p>
                            {exec.ai_generated && <span className="text-[10px] text-primary">🤖 Gerada por IA</span>}
                          </TableCell>
                          <TableCell>
                            <Badge variant={statusColor(exec.status)} className="text-[10px] gap-1">
                              {exec.status === "sent" ? <CheckCircle2 className="h-2.5 w-2.5" /> : <XCircle className="h-2.5 w-2.5" />}
                              {exec.status}
                            </Badge>
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
    </PlanGate>
  );
}
