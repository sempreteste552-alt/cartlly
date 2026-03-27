import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, FileText, Ban, Unlock, ShieldOff, ShieldCheck, Trash2, CheckCircle, XCircle, Store, CreditCard, UserCog } from "lucide-react";
import { useState } from "react";

const ACTION_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  approve_tenant: { label: "Aprovar Tenant", icon: CheckCircle, color: "text-green-600" },
  reject_tenant: { label: "Rejeitar Tenant", icon: XCircle, color: "text-red-600" },
  block_tenant: { label: "Bloquear Tenant", icon: Ban, color: "text-red-600" },
  unblock_tenant: { label: "Desbloquear Tenant", icon: Unlock, color: "text-green-600" },
  block_store: { label: "Bloquear Loja", icon: Store, color: "text-orange-600" },
  unblock_store: { label: "Desbloquear Loja", icon: Store, color: "text-green-600" },
  block_admin_panel: { label: "Bloquear Painel", icon: ShieldOff, color: "text-red-600" },
  unblock_admin_panel: { label: "Desbloquear Painel", icon: ShieldCheck, color: "text-green-600" },
  delete_tenant: { label: "Excluir Tenant", icon: Trash2, color: "text-red-700" },
  assign_plan: { label: "Atribuir Plano", icon: CreditCard, color: "text-blue-600" },
  remove_plan: { label: "Remover Plano", icon: CreditCard, color: "text-orange-600" },
};

export default function SuperAdminAuditLogs() {
  const [search, setSearch] = useState("");

  const { data: logs, isLoading } = useQuery({
    queryKey: ["audit_logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  const filtered = logs?.filter((log: any) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      log.action?.toLowerCase().includes(s) ||
      log.target_name?.toLowerCase().includes(s) ||
      log.target_type?.toLowerCase().includes(s)
    );
  }) ?? [];

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-96" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <FileText className="h-6 w-6 text-primary" /> Logs de Auditoria
        </h1>
        <p className="text-muted-foreground">Histórico de todas as ações administrativas ({logs?.length || 0} registros)</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por ação ou tenant..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Últimas Ações</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[600px]">
            {filtered.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">Nenhum log encontrado</div>
            ) : (
              <div className="divide-y divide-border">
                {filtered.map((log: any) => {
                  const config = ACTION_CONFIG[log.action] || { label: log.action, icon: FileText, color: "text-muted-foreground" };
                  const Icon = config.icon;
                  return (
                    <div key={log.id} className="flex items-start gap-3 px-4 py-3 hover:bg-muted/50 transition-colors">
                      <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted ${config.color}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{config.label}</span>
                          <Badge variant="outline" className="text-xs">{log.target_type}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {log.target_name || "—"}
                        </p>
                        {log.details && Object.keys(log.details).length > 0 && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {Object.entries(log.details).map(([k, v]) => `${k}: ${v}`).join(" • ")}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(log.created_at).toLocaleDateString("pt-BR")} {new Date(log.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
