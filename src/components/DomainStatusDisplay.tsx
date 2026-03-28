import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle2, Clock, XCircle, Loader2, RefreshCw, ExternalLink } from "lucide-react";

interface DomainStatusDisplayProps {
  domain: string;
  status: string;
  lastCheck: string | null;
  settingsId?: string;
  storeSlug?: string;
}

export default function DomainStatusDisplay({ domain, status, lastCheck, settingsId, storeSlug }: DomainStatusDisplayProps) {
  const [checking, setChecking] = useState(false);

  const handleVerify = async () => {
    if (!settingsId) return;
    setChecking(true);
    try {
      // Call edge function to verify domain DNS
      const { data, error } = await supabase.functions.invoke("verify-domain", {
        body: { settingsId, domain },
      });
      if (error) throw error;
      if (data?.status === "verified") {
        toast.success("Domínio verificado com sucesso! ✅");
      } else if (data?.status === "pending") {
        toast.info("DNS ainda não propagado. Tente novamente em algumas horas.");
      } else {
        toast.error("Falha na verificação. Verifique os registros DNS.");
      }
      // Reload page to reflect updated status
      window.location.reload();
    } catch (err: any) {
      toast.error(err.message || "Erro ao verificar domínio");
    } finally {
      setChecking(false);
    }
  };

  const statusConfig = {
    none: { label: "Não configurado", color: "secondary" as const, icon: Clock, description: "Configure os registros DNS abaixo para ativar." },
    pending: { label: "Pendente", color: "secondary" as const, icon: Clock, description: "Aguardando verificação DNS. Pode levar até 72h." },
    verified: { label: "Aprovado", color: "default" as const, icon: CheckCircle2, description: "Domínio verificado e ativo!" },
    failed: { label: "Falhou", color: "destructive" as const, icon: XCircle, description: "Falha na verificação. Verifique seus registros DNS." },
  };

  const current = statusConfig[status as keyof typeof statusConfig] || statusConfig.none;
  const StatusIcon = current.icon;

  return (
    <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-3">
      {/* Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusIcon className={`h-5 w-5 ${status === "verified" ? "text-green-500" : status === "failed" ? "text-destructive" : "text-muted-foreground"}`} />
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-foreground">Status do Domínio</p>
              <Badge variant={current.color}>{current.label}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">{current.description}</p>
          </div>
        </div>
      </div>

      {lastCheck && (
        <p className="text-xs text-muted-foreground">
          Última verificação: {new Date(lastCheck).toLocaleString("pt-BR")}
        </p>
      )}

      {/* DNS Instructions - show when not verified */}
      {status !== "verified" && (
        <div className="space-y-2 pt-2 border-t border-border">
          <p className="text-sm font-medium text-foreground">📋 Registros DNS necessários</p>
          <p className="text-xs text-muted-foreground">
            Configure no painel do seu provedor de domínio:
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 pr-3 text-muted-foreground font-medium">Tipo</th>
                  <th className="text-left py-2 pr-3 text-muted-foreground font-medium">Nome</th>
                  <th className="text-left py-2 text-muted-foreground font-medium">Valor</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-3"><Badge variant="outline" className="text-xs">A</Badge></td>
                  <td className="py-2 pr-3">@</td>
                  <td className="py-2 text-primary font-medium">185.158.133.1</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-3"><Badge variant="outline" className="text-xs">A</Badge></td>
                  <td className="py-2 pr-3">www</td>
                  <td className="py-2 text-primary font-medium">185.158.133.1</td>
                </tr>
                <tr>
                  <td className="py-2 pr-3"><Badge variant="outline" className="text-xs">TXT</Badge></td>
                  <td className="py-2 pr-3">_lovable</td>
                  <td className="py-2 text-primary font-medium break-all">lovable_verify={settingsId?.slice(0, 12) || "..."}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="space-y-1 pt-1">
            <p className="text-xs text-muted-foreground">⏳ A propagação DNS pode levar até <strong>72 horas</strong>.</p>
            <p className="text-xs text-muted-foreground">🔒 O certificado SSL será provisionado automaticamente.</p>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-2">
        <Button variant="outline" size="sm" onClick={handleVerify} disabled={checking}>
          {checking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Verificar Domínio
        </Button>
        {status === "verified" && (
          <Button variant="default" size="sm" asChild>
            <a href={`https://${domain}`} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" />
              Abrir Loja
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}
