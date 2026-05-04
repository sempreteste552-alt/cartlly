import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity, AlertCircle, Clock, History } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AINav } from "@/components/admin/AINav";

export default function AdminAIUsage() {
  const { data: logs, isLoading } = useQuery({
    queryKey: ["ai-usage-logs-tenant"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase
        .from("ai_usage_logs")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: dailyAgg } = useQuery({
    queryKey: ["ai-daily-agg-self"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const { data } = await supabase
        .from("ai_usage_logs")
        .select("created_at, credits_charged, estimated_cost, total_tokens")
        .eq("user_id", user.id)
        .gte("created_at", since.toISOString());
      const buckets = new Map<string, { credits: number; cost: number; tokens: number; count: number }>();
      (data ?? []).forEach((l) => {
        const day = format(new Date(l.created_at), "dd/MM");
        const cur = buckets.get(day) ?? { credits: 0, cost: 0, tokens: 0, count: 0 };
        cur.credits += Number(l.credits_charged ?? 0);
        cur.cost += Number(l.estimated_cost ?? 0);
        cur.tokens += Number(l.total_tokens ?? 0);
        cur.count += 1;
        buckets.set(day, cur);
      });
      return Array.from(buckets.entries()).map(([day, v]) => ({ day, ...v }));
    },
  });

  const errors = (logs ?? []).filter((l) => l.status !== "success");
  const maxBar = Math.max(1, ...(dailyAgg ?? []).map((d) => d.credits));

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
          <Activity className="h-7 w-7 text-primary" />
          Consumo detalhado de IA
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Últimos 30 dias de atividade — chamadas, custos e erros.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Consumo por dia (créditos)</CardTitle>
          <CardDescription>Últimos 30 dias</CardDescription>
        </CardHeader>
        <CardContent>
          {!dailyAgg || dailyAgg.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-8">Sem dados ainda.</p>
          ) : (
            <div className="flex items-end gap-1 h-40 overflow-x-auto">
              {dailyAgg.map((d) => (
                <div key={d.day} className="flex flex-col items-center gap-1 min-w-[28px]">
                  <div
                    className="w-5 bg-primary/70 hover:bg-primary rounded-t transition-all"
                    style={{ height: `${(d.credits / maxBar) * 100}%`, minHeight: d.credits > 0 ? 4 : 0 }}
                    title={`${d.day}: ${d.credits} créditos`}
                  />
                  <span className="text-[9px] text-muted-foreground">{d.day}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="recent">
        <TabsList>
          <TabsTrigger value="recent" className="gap-2"><History className="h-4 w-4" />Histórico</TabsTrigger>
          <TabsTrigger value="errors" className="gap-2">
            <AlertCircle className="h-4 w-4" />Erros {errors.length > 0 && <Badge variant="destructive" className="h-5">{errors.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="recent">
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-4 space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
              ) : (
                <LogsTable logs={logs ?? []} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="errors">
          <Card>
            <CardContent className="p-0">
              {errors.length === 0 ? (
                <p className="text-center text-muted-foreground text-sm py-8">Nenhum erro nos últimos registros 🎉</p>
              ) : (
                <LogsTable logs={errors} showError />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function LogsTable({ logs, showError = false }: { logs: any[]; showError?: boolean }) {
  if (logs.length === 0) {
    return <p className="text-center text-muted-foreground text-sm py-8">Sem registros.</p>;
  }
  return (
    <div className="overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Quando</TableHead>
            <TableHead>Recurso</TableHead>
            <TableHead>Modelo</TableHead>
            <TableHead className="text-right">Tokens</TableHead>
            <TableHead className="text-right">Créd.</TableHead>
            <TableHead>Status</TableHead>
            {showError && <TableHead>Erro</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((l) => (
            <TableRow key={l.id}>
              <TableCell className="text-xs whitespace-nowrap">
                <Clock className="inline h-3 w-3 mr-1 text-muted-foreground" />
                {format(new Date(l.created_at), "dd/MM HH:mm", { locale: ptBR })}
              </TableCell>
              <TableCell><Badge variant="outline" className="text-[10px] capitalize">{(l.feature || "—").replace(/_/g, " ")}</Badge></TableCell>
              <TableCell className="text-[10px]"><div className="font-medium">{l.provider}</div><div className="text-muted-foreground">{l.model}</div></TableCell>
              <TableCell className="text-right text-xs">{(l.total_tokens ?? 0).toLocaleString("pt-BR")}</TableCell>
              <TableCell className="text-right text-xs font-semibold">{l.credits_charged ?? 0}</TableCell>
              <TableCell>
                {l.status === "success"
                  ? <Badge className="bg-emerald-500/10 text-emerald-600 border-none text-[10px]">OK</Badge>
                  : <Badge variant="destructive" className="text-[10px]">{l.status}</Badge>}
              </TableCell>
              {showError && <TableCell className="text-xs text-destructive max-w-xs truncate" title={l.error_message}>{l.error_message}</TableCell>}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
