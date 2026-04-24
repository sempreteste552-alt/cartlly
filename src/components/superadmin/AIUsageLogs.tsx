import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertCircle, Clock } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function AIUsageLogs() {
  const { data: logs, isLoading } = useQuery({
    queryKey: ["ai-usage-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_usage_logs")
        .select(`
          *,
          store_settings:store_user_id (store_name)
        `)
        .order("created_at", { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Data/Hora</TableHead>
            <TableHead>Tenant</TableHead>
            <TableHead>Feature</TableHead>
            <TableHead>Provedor/Modelo</TableHead>
            <TableHead>Tokens/Imgs</TableHead>
            <TableHead>Custo</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs?.map((log) => (
            <TableRow key={log.id}>
              <TableCell className="whitespace-nowrap font-medium">
                <div className="flex items-center gap-2">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  {format(new Date(log.created_at), "dd/MM HH:mm", { locale: ptBR })}
                </div>
              </TableCell>
              <TableCell>
                <span className="font-semibold text-xs">
                  {(log.store_settings as any)?.store_name || "Desconhecido"}
                </span>
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="capitalize text-[10px] py-0">
                  {log.feature?.replace(/_/g, " ")}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="text-[10px]">
                  <p className="font-bold">{log.provider}</p>
                  <p className="text-muted-foreground">{log.model}</p>
                </div>
              </TableCell>
              <TableCell>
                <div className="text-[10px]">
                  {log.total_tokens > 0 && <p>{log.total_tokens} tokens</p>}
                  {log.images_count > 0 && <p>{log.images_count} img</p>}
                </div>
              </TableCell>
              <TableCell className="text-xs font-bold">
                R$ {log.estimated_cost?.toFixed(4) || "0,0000"}
              </TableCell>
              <TableCell>
                {log.status === "success" ? (
                  <Badge className="bg-green-500/10 text-green-500 hover:bg-green-500/20 border-none text-[10px]">OK</Badge>
                ) : (
                  <Badge variant="destructive" className="text-[10px]">ERRO</Badge>
                )}
              </TableCell>
            </TableRow>
          ))}
          {logs?.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                Nenhum log de uso encontrado.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
