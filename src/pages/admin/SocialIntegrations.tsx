import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { PlanGate } from "@/components/PlanGate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Instagram, Facebook, RefreshCw, Unplug, Settings2, History, Sparkles, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  useSocialConnections, useSocialSettings, useSocialSuggestions, useSocialAnalytics,
  startSocialConnect, disconnectSocial, syncSocialNow, type SocialProvider,
} from "@/hooks/useSocialIntegrations";

const PROVIDERS: { id: SocialProvider; label: string; icon: typeof Instagram; color: string }[] = [
  { id: "instagram", label: "Instagram", icon: Instagram, color: "text-pink-500" },
  { id: "facebook", label: "Facebook", icon: Facebook, color: "text-blue-500" },
];

export default function SocialIntegrations() {
  return (
    <PlanGate feature="social_product_import">
      <SocialIntegrationsInner />
    </PlanGate>
  );
}

function SocialIntegrationsInner() {
  const { slug } = useParams();
  const base = slug ? `/painel/${slug}` : "/admin";
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { data: connections = [], refetch } = useSocialConnections();
  const { settings, save } = useSocialSettings();
  const { data: pending = [] } = useSocialSuggestions("PENDING");
  const { data: stats } = useSocialAnalytics();
  const [busy, setBusy] = useState<string | null>(null);
  const [toDisconnect, setToDisconnect] = useState<string | null>(null);

  useEffect(() => {
    if (params.get("social_connected")) {
      toast.success("Conta conectada com sucesso!");
      refetch();
      params.delete("social_connected");
      setParams(params, { replace: true });
    }
    if (params.get("social_error")) {
      toast.error(params.get("social_error")!);
      params.delete("social_error");
      setParams(params, { replace: true });
    }
  }, [params, refetch, setParams]);

  const connect = async (provider: SocialProvider) => {
    setBusy(provider);
    try {
      await startSocialConnect(provider);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  const sync = async (id: string) => {
    setBusy(id);
    try {
      const r = await syncSocialNow(id);
      toast.success(r?.new_posts ? `${r.new_posts} nova(s) publicação(ões) em análise.` : "Nenhuma publicação nova.");
    } catch (e: any) {
      toast.error(e.message || "Não conseguimos sincronizar agora.");
    } finally {
      setBusy(null);
    }
  };

  const doDisconnect = async () => {
    if (!toDisconnect) return;
    try {
      await disconnectSocial(toDisconnect);
      toast.success("Conta desconectada. Os produtos já importados foram mantidos.");
      refetch();
    } catch (e: any) {
      toast.error(e.message || "Erro ao desconectar");
    }
    setToDisconnect(null);
  };

  const setting = (k: string, fallback = true) => (settings ? settings[k] : fallback);

  return (
    <div className="space-y-6 max-w-full">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Redes Sociais</h1>
        <p className="text-muted-foreground text-sm">
          Conecte suas redes sociais e transforme publicações em oportunidades para sua loja.
        </p>
      </div>

      {pending.length > 0 && (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="flex flex-wrap items-center gap-3 p-4">
            <Sparkles className="h-5 w-5 text-primary shrink-0" />
            <p className="text-sm flex-1 min-w-0">
              <strong>{pending.length}</strong> possível(is) produto(s) aguardando sua revisão.
            </p>
            <Button size="sm" onClick={() => navigate(`${base}/social/produtos/${pending[0].id}`)}>
              Revisar agora
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {PROVIDERS.map(({ id, label, icon: Icon, color }) => {
          const conn = connections.find((c) => c.provider === id);
          const expiring = conn?.token_expires_at && new Date(conn.token_expires_at).getTime() - Date.now() < 7 * 864e5;
          return (
            <Card key={id}>
              <CardHeader className="flex flex-row items-center gap-3 space-y-0">
                <Icon className={`h-6 w-6 ${color}`} />
                <CardTitle className="text-base flex-1 min-w-0">{label}</CardTitle>
                <Badge variant={conn ? "default" : "secondary"}>{conn ? "Conectado" : "Não conectado"}</Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                {conn ? (
                  <>
                    <p className="text-sm text-muted-foreground break-words">
                      🟢 {conn.account_username ? `@${conn.account_username}` : conn.account_name}
                    </p>
                    {expiring && (
                      <p className="text-xs flex items-center gap-1.5 text-amber-600">
                        <AlertTriangle className="h-3.5 w-3.5" /> Sua conexão precisa ser renovada.
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" disabled={busy === conn.id} onClick={() => sync(conn.id)}>
                        <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${busy === conn.id ? "animate-spin" : ""}`} /> Sincronizar
                      </Button>
                      {expiring && (
                        <Button size="sm" variant="outline" onClick={() => connect(id)}>Reconectar</Button>
                      )}
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setToDisconnect(conn.id)}>
                        <Unplug className="h-3.5 w-3.5 mr-1.5" /> Desconectar
                      </Button>
                    </div>
                  </>
                ) : (
                  <Button size="sm" disabled={busy === id} onClick={() => connect(id)}>
                    Conectar {label}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2 space-y-0">
          <Settings2 className="h-4 w-4" />
          <CardTitle className="text-base">Configurações</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            ["auto_detect_products", "Detectar produtos automaticamente", "Analisa novas publicações com IA."],
            ["auto_generate_description", "Gerar descrição com IA", "Cria descrição no tom da sua marca."],
            ["auto_notify", "Notificar no painel", "Aviso quando um produto for detectado."],
            ["require_approval", "Exigir minha aprovação", "Nada é publicado sem você revisar."],
            ["auto_import_products", "Adicionar automaticamente (avançado)", "Só publica com preço e dados obrigatórios."],
          ].map(([key, title, desc]) => (
            <div key={key} className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <Label className="text-sm">{title}</Label>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
              <Switch
                checked={Boolean(setting(key as string, key !== "auto_import_products"))}
                onCheckedChange={(v) => save.mutate({ [key as string]: v })}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {[
          ["Posts detectados", stats?.posts_detected ?? 0],
          ["Produtos encontrados", stats?.products_detected ?? 0],
          ["Produtos importados", stats?.products_imported ?? 0],
          ["Ignorados", stats?.products_ignored ?? 0],
        ].map(([label, value]) => (
          <Card key={label as string}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-2xl font-bold">{value as number}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Button variant="outline" onClick={() => navigate(`${base}/social/historico`)}>
        <History className="h-4 w-4 mr-2" /> Ver histórico
      </Button>

      <AlertDialog open={!!toDisconnect} onOpenChange={(o) => !o && setToDisconnect(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desconectar esta conta?</AlertDialogTitle>
            <AlertDialogDescription>
              Novos posts deixarão de ser processados. Os produtos já importados serão mantidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={doDisconnect}>Desconectar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
