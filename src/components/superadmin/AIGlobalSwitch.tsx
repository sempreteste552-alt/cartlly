import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Power, AlertTriangle, Save, KeyRound } from "lucide-react";
import { toast } from "sonner";

/**
 * Controle global (suporte / super admin) que libera a IA para toda a plataforma.
 * Enquanto estiver desligado — ou sem provedor com chave ativa —
 * todos os tenants veem a mensagem de "fale com o suporte".
 */
export function AIGlobalSwitch() {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["ai-global-settings"],
    queryFn: async () => {
      const { data: settings } = await supabase
        .from("ai_global_settings")
        .select("*")
        .limit(1)
        .maybeSingle();
      const { count } = await supabase
        .from("ai_providers")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true);
      return { settings: settings as any, activeProviders: count ?? 0 };
    },
  });

  useEffect(() => {
    if (data?.settings) {
      setMessage(data.settings.disabled_message ?? "");
      setContact(data.settings.support_contact ?? "");
    }
  }, [data?.settings]);

  const save = useMutation({
    mutationFn: async (updates: Record<string, any>) => {
      if (data?.settings?.id) {
        const { error } = await supabase
          .from("ai_global_settings")
          .update(updates)
          .eq("id", data.settings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("ai_global_settings").insert(updates as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-global-settings"] });
      queryClient.invalidateQueries({ queryKey: ["ai-platform-status"] });
      toast.success("Configuração global de IA atualizada");
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-10 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const isOn = !!data?.settings?.is_ai_enabled_globally;
  const hasProvider = (data?.activeProviders ?? 0) > 0;
  const liveForTenants = isOn && hasProvider;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Power className="h-5 w-5 text-primary" />
              Liberação global da IA
            </CardTitle>
            <CardDescription>
              Com o switch desligado, todos os recursos de IA ficam OFF nos tenants e na vitrine,
              exibindo a mensagem de suporte abaixo.
            </CardDescription>
          </div>
          <Badge variant={liveForTenants ? "default" : "secondary"}>
            {liveForTenants ? "IA LIBERADA" : "IA BLOQUEADA"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label className="text-base">Ativar IA para toda a plataforma</Label>
            <p className="text-sm text-muted-foreground">
              Requer pelo menos um provedor ativo com chave de API cadastrada.
            </p>
          </div>
          <Switch
            checked={isOn}
            onCheckedChange={(v) => save.mutate({ is_ai_enabled_globally: v })}
          />
        </div>

        {!hasProvider && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="flex items-center gap-2">
              <KeyRound className="h-4 w-4" />
              Nenhum provedor de IA ativo. Cadastre as chaves na aba <strong>Provedores</strong> —
              sem isso a IA continua desligada mesmo com o switch ligado.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label>Mensagem exibida quando a IA está bloqueada</Label>
          <Textarea
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Fale com o suporte para liberar os recursos de IA."
          />
        </div>

        <div className="space-y-2">
          <Label>Contato de suporte</Label>
          <Input
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="contato@cartlly.store"
          />
        </div>

        <Button
          onClick={() => save.mutate({ disabled_message: message, support_contact: contact })}
          disabled={save.isPending}
        >
          {save.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Salvar mensagem
        </Button>
      </CardContent>
    </Card>
  );
}

export default AIGlobalSwitch;
