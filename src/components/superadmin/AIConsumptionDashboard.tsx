import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Loader2, TrendingUp, DollarSign, Image as ImageIcon, FileText, AlertTriangle } from "lucide-react";

export function AIConsumptionDashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["ai-dashboard-stats"],
    queryFn: async () => {
      // Get global usage stats
      const { data: logs, error } = await supabase
        .from("ai_usage_logs")
        .select("estimated_cost, total_tokens, images_count, feature, status")
        .gte("created_at", new Date(new Date().setDate(1)).toISOString()); // Current month
      
      if (error) throw error;

      const totalCost = logs.reduce((acc, log) => acc + (log.estimated_cost || 0), 0);
      const totalTokens = logs.reduce((acc, log) => acc + (log.total_tokens || 0), 0);
      const totalImages = logs.reduce((acc, log) => acc + (log.images_count || 0), 0);
      const errors = logs.filter(l => l.status !== "success").length;

      return {
        totalCost,
        totalTokens,
        totalImages,
        errors,
        count: logs.length
      };
    },
  });

  const { data: globalSettings } = useQuery({
    queryKey: ["ai-global-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ai_global_settings").select("*").single();
      if (error && error.code !== "PGRST116") throw error;
      return data;
    }
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const monthlyLimit = globalSettings?.global_monthly_limit_usd || 100;
  const usagePercentage = stats ? Math.min((stats.totalCost / monthlyLimit) * 100, 100) : 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Custo Total (Mês)</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ {stats?.totalCost.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              Limite global: R$ {monthlyLimit.toFixed(2)}
            </p>
            <Progress value={usagePercentage} className="h-2 mt-3" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tokens Consumidos</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalTokens.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Total de tokens no mês atual
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Imagens Geradas</CardTitle>
            <ImageIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalImages}</div>
            <p className="text-xs text-muted-foreground">
              Mês atual
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Erro</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.count ? ((stats.errors / stats.count) * 100).toFixed(1) : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.errors} falhas de {stats?.count} chamadas
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top Tenants por Consumo</CardTitle>
            <CardDescription>Visualização rápida dos maiores usuários de IA</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Placeholder for actual chart or list */}
            <div className="flex items-center justify-center h-48 bg-muted/20 rounded-lg border border-dashed">
              <p className="text-muted-foreground text-sm">Em breve: Gráfico de consumo por tenant</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Distribuição por Feature</CardTitle>
            <CardDescription>Quais recursos de IA são mais usados</CardDescription>
          </CardHeader>
          <CardContent>
             <div className="flex items-center justify-center h-48 bg-muted/20 rounded-lg border border-dashed">
              <p className="text-muted-foreground text-sm">Em breve: Distribuição de uso por funcionalidade</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
