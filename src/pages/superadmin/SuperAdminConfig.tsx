import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, Globe, Mail, CreditCard, Shield, Save, Loader2, Phone, Megaphone, Bell, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Textarea } from "@/components/ui/textarea";

interface PlatformConfig {
  platform_name: string;
  platform_email: string;
  default_trial_days: number;
  auto_confirm_emails: boolean;
  maintenance_mode: boolean;
  allow_new_registrations: boolean;
  default_plan_id: string;
  support_whatsapp_number: string;
  promo_banner_enabled: boolean;
  promo_banner_text: string;
  promo_banner_link: string;
  promo_banner_color_1: string;
  promo_banner_color_2: string;
  promo_banner_color_3: string;
  mercadopago_global_key: string;
  mercadopago_public_key: string;
  mercadopago_client_id: string;
  mercadopago_client_secret: string;
  pagbank_global_key: string;
  amplopay_public_key: string;
  amplopay_secret_key: string;
  stripe_global_key: string;
  stripe_webhook_secret: string;
  stripe_publishable_key: string;
  mp_webhook_secret: string;
  gateway_test_mode: boolean;
}

const defaultConfig: PlatformConfig = {
  platform_name: "Cartlly",
  platform_email: "",
  default_trial_days: 7,
  auto_confirm_emails: false,
  maintenance_mode: false,
  allow_new_registrations: true,
  default_plan_id: "",
  support_whatsapp_number: "",
  promo_banner_enabled: false,
  promo_banner_text: "",
  promo_banner_link: "",
  promo_banner_color_1: "#1a1a2e",
  promo_banner_color_2: "#533483",
  promo_banner_color_3: "#e94560",
  mercadopago_global_key: "",
  mercadopago_public_key: "",
  mercadopago_client_id: "",
  mercadopago_client_secret: "",
  pagbank_global_key: "",
  amplopay_public_key: "",
  amplopay_secret_key: "",
  stripe_global_key: "",
  stripe_webhook_secret: "",
  stripe_publishable_key: "",
  mp_webhook_secret: "",
  gateway_test_mode: true,
};

export default function SuperAdminConfig() {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<PlatformConfig>(defaultConfig);

  const { isLoading } = useQuery({
    queryKey: ["platform_settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_settings")
        .select("*");
      if (error) throw error;

      const merged = { ...defaultConfig };
      data?.forEach((row: any) => {
        if (row.key in merged) {
          (merged as any)[row.key] = row.value?.value ?? (merged as any)[row.key];
        }
      });
      setConfig(merged);
      return data;
    },
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      const entries = Object.entries(config);
      let errorCount = 0;
      for (const [key, val] of entries) {
        const { error } = await supabase
          .from("platform_settings")
          .upsert(
            { key, value: { value: val } as any, updated_at: new Date().toISOString() },
            { onConflict: "key" }
          );
        if (error) {
          console.error(`Erro ao salvar ${key}:`, error);
          errorCount++;
        }
      }
      if (errorCount > 0) {
        toast.error(`${errorCount} configuração(ões) falharam ao salvar. Verifique se você tem permissão.`);
      } else {
        toast.success("Configurações salvas!");
      }
      queryClient.invalidateQueries({ queryKey: ["platform_settings"] });
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const updateField = (key: keyof PlatformConfig, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  if (isLoading) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Configurações</h1>
          <p className="text-muted-foreground">Configurações globais da plataforma</p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Salvar
        </Button>
      </div>

      {/* General */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Globe className="h-5 w-5 text-primary" /> Geral
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Nome da Plataforma</Label>
              <Input value={config.platform_name} onChange={e => updateField("platform_name", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>E-mail da Plataforma</Label>
              <Input type="email" value={config.platform_email} onChange={e => updateField("platform_email", e.target.value)} placeholder="contato@cartlly.com" />
            </div>
          </div>
          <div className="space-y-2">
              <Label>Dias de Teste Padrão</Label>
              <Input type="number" value={config.default_trial_days} onChange={e => updateField("default_trial_days", parseInt(e.target.value) || 7)} className="max-w-32" />
            </div>
        </CardContent>
      </Card>

      {/* Promotional Banner */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Megaphone className="h-5 w-5 text-pink-500" /> Banner Promocional
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Ativa um banner no topo de todas as lojas (exceto PREMIUM). Cada tenant também pode ativar/desativar individualmente.
          </p>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <Label>Banner Global Ativo</Label>
              <p className="text-xs text-muted-foreground">Exibe o banner em todas as lojas não-premium</p>
            </div>
            <Switch checked={config.promo_banner_enabled} onCheckedChange={v => updateField("promo_banner_enabled", v)} />
          </div>
          <div className="space-y-2">
            <Label>Texto do Banner (deixe vazio para usar padrão)</Label>
            <Input
              placeholder="🚀 Crie sua própria loja online agora mesmo!"
              value={config.promo_banner_text}
              onChange={e => updateField("promo_banner_text", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Link do Botão "Saiba mais"</Label>
            <Input
              placeholder="https://usecartlly.vercel.app/"
              value={config.promo_banner_link}
              onChange={e => updateField("promo_banner_link", e.target.value)}
            />
          </div>
          <Separator />
          <h4 className="font-semibold text-sm">Cores do Gradiente</h4>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Cor 1 (início)</Label>
              <div className="flex gap-2 items-center">
                <input type="color" value={config.promo_banner_color_1} onChange={e => updateField("promo_banner_color_1", e.target.value)} className="h-9 w-12 rounded border border-border cursor-pointer" />
                <Input value={config.promo_banner_color_1} onChange={e => updateField("promo_banner_color_1", e.target.value)} className="flex-1" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Cor 2 (meio)</Label>
              <div className="flex gap-2 items-center">
                <input type="color" value={config.promo_banner_color_2} onChange={e => updateField("promo_banner_color_2", e.target.value)} className="h-9 w-12 rounded border border-border cursor-pointer" />
                <Input value={config.promo_banner_color_2} onChange={e => updateField("promo_banner_color_2", e.target.value)} className="flex-1" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Cor 3 (fim)</Label>
              <div className="flex gap-2 items-center">
                <input type="color" value={config.promo_banner_color_3} onChange={e => updateField("promo_banner_color_3", e.target.value)} className="h-9 w-12 rounded border border-border cursor-pointer" />
                <Input value={config.promo_banner_color_3} onChange={e => updateField("promo_banner_color_3", e.target.value)} className="flex-1" />
              </div>
            </div>
          </div>
          {config.promo_banner_enabled && (
            <div className="rounded-lg overflow-hidden border border-border">
              <div className="text-white text-center py-3 px-4 text-sm font-semibold" style={{ background: `linear-gradient(135deg, ${config.promo_banner_color_1} 0%, ${config.promo_banner_color_2} 50%, ${config.promo_banner_color_3} 100%)` }}>
                {config.promo_banner_text || "🚀 Crie sua própria loja online agora mesmo!"} — <span className="underline">Saiba mais</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Phone className="h-5 w-5 text-green-500" /> Suporte WhatsApp
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Configure um número de WhatsApp de suporte. Um botão flutuante aparecerá no painel de todos os tenants, acima do chat de IA.
          </p>
          <div className="space-y-2">
            <Label>Número do WhatsApp (com DDD)</Label>
            <Input
              value={config.support_whatsapp_number}
              onChange={e => updateField("support_whatsapp_number", e.target.value)}
              placeholder="5511999999999"
            />
            <p className="text-xs text-muted-foreground">Formato: 55 + DDD + número. Ex: 5511999999999. Deixe vazio para desativar.</p>
          </div>
        </CardContent>
      </Card>

      {/* Security */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="h-5 w-5 text-primary" /> Segurança e Acesso
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <Label>Permitir Novos Cadastros</Label>
              <p className="text-xs text-muted-foreground">Permitir que novos lojistas criem contas</p>
            </div>
            <Switch checked={config.allow_new_registrations} onCheckedChange={v => updateField("allow_new_registrations", v)} />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <Label>Auto-confirmar E-mails</Label>
              <p className="text-xs text-muted-foreground">Pular verificação de e-mail no cadastro</p>
            </div>
            <Switch checked={config.auto_confirm_emails} onCheckedChange={v => updateField("auto_confirm_emails", v)} />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-destructive/30 p-3 bg-destructive/5">
            <div>
              <Label className="text-destructive">Modo Manutenção</Label>
              <p className="text-xs text-muted-foreground">Bloqueia acesso de tenants à plataforma</p>
            </div>
            <Switch checked={config.maintenance_mode} onCheckedChange={v => updateField("maintenance_mode", v)} />
          </div>
        </CardContent>
      </Card>

      {/* Payment Gateways */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <CreditCard className="h-5 w-5 text-primary" /> Gateways de Pagamento
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm text-muted-foreground">
            Configure os gateways globais. Tenants sem chaves próprias usarão estas configurações.
          </p>

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <Label>Modo de Teste</Label>
              <p className="text-xs text-muted-foreground">Usar ambiente sandbox para todos os gateways</p>
            </div>
            <Switch checked={config.gateway_test_mode} onCheckedChange={v => updateField("gateway_test_mode", v)} />
          </div>

          <Separator />

          {/* Stripe */}
          <div className="space-y-3">
            <h4 className="font-semibold flex items-center gap-2">
              <span className="h-6 w-6 rounded bg-purple-600 text-white text-xs flex items-center justify-center font-bold">S</span>
              Stripe
            </h4>
            <div className="space-y-2">
              <Label>Publishable Key</Label>
              <Input type="password" value={config.stripe_publishable_key} onChange={e => updateField("stripe_publishable_key", e.target.value)} placeholder="pk_test_..." />
            </div>
            <div className="space-y-2">
              <Label>Secret Key</Label>
              <Input type="password" value={config.stripe_global_key} onChange={e => updateField("stripe_global_key", e.target.value)} placeholder="sk_test_..." />
            </div>
            <div className="space-y-2">
              <Label>Webhook Secret</Label>
              <Input type="password" value={config.stripe_webhook_secret} onChange={e => updateField("stripe_webhook_secret", e.target.value)} placeholder="whsec_..." />
            </div>
          </div>

          <Separator />

          {/* Mercado Pago */}
          <div className="space-y-3">
            <h4 className="font-semibold flex items-center gap-2">
              <span className="h-6 w-6 rounded bg-blue-500 text-white text-xs flex items-center justify-center font-bold">MP</span>
              Mercado Pago
            </h4>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Public Key</Label>
                <Input type="password" value={config.mercadopago_public_key} onChange={e => updateField("mercadopago_public_key", e.target.value)} placeholder="APP_USR-xxxx..." />
              </div>
              <div className="space-y-2">
              <Label>Access Token</Label>
              <Input type="password" value={config.mercadopago_global_key} onChange={e => updateField("mercadopago_global_key", e.target.value)} placeholder="TEST-xxxx..." />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Client ID</Label>
                <Input type="password" value={config.mercadopago_client_id} onChange={e => updateField("mercadopago_client_id", e.target.value)} placeholder="Client ID..." />
              </div>
              <div className="space-y-2">
                <Label>Client Secret</Label>
                <Input type="password" value={config.mercadopago_client_secret} onChange={e => updateField("mercadopago_client_secret", e.target.value)} placeholder="Client Secret..." />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Webhook Secret</Label>
              <Input type="password" value={config.mp_webhook_secret} onChange={e => updateField("mp_webhook_secret", e.target.value)} placeholder="Secret..." />
            </div>
          </div>

          <Separator />

          <div className="pt-2">
            <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Salvar Configurações de Gateway
            </Button>
          </div>

          <Separator />

          {/* Amplopay */}
          <div className="space-y-3">
            <h4 className="font-semibold flex items-center gap-2">
              <span className="h-6 w-6 rounded bg-orange-500 text-white text-xs flex items-center justify-center font-bold">AP</span>
              Amplopay
            </h4>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Public Key</Label>
                <Input type="password" value={config.amplopay_public_key} onChange={e => updateField("amplopay_public_key", e.target.value)} placeholder="Chave pública Amplopay..." />
              </div>
              <div className="space-y-2">
                <Label>Secret Key</Label>
                <Input type="password" value={config.amplopay_secret_key} onChange={e => updateField("amplopay_secret_key", e.target.value)} placeholder="Chave secreta Amplopay..." />
              </div>
            </div>
          </div>

          <Separator />

          {/* PagBank */}
          <div className="space-y-3">
            <h4 className="font-semibold flex items-center gap-2">
              <span className="h-6 w-6 rounded bg-green-600 text-white text-xs flex items-center justify-center font-bold">PB</span>
              PagBank
            </h4>
            <div className="space-y-2">
              <Label>Token</Label>
              <Input type="password" value={config.pagbank_global_key} onChange={e => updateField("pagbank_global_key", e.target.value)} placeholder="Token PagBank..." />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Admin Announcement Banners */}
      <AdminAnnouncementsSection />
    </div>
  );
}

function AdminAnnouncementsSection() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [bannerType, setBannerType] = useState("info");
  const [bgColor, setBgColor] = useState("#1a1a2e");
  const [textColor, setTextColor] = useState("#ffffff");

  const { data: announcements, isLoading } = useQuery({
    queryKey: ["admin_announcements_all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_announcements")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("admin_announcements").insert({
        title,
        body: body || null,
        banner_type: bannerType,
        bg_color: bgColor,
        text_color: textColor,
        created_by: user!.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_announcements_all"] });
      queryClient.invalidateQueries({ queryKey: ["admin_announcements_active"] });
      toast.success("Banner criado!");
      setTitle("");
      setBody("");
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const toggleMut = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("admin_announcements").update({ active } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_announcements_all"] });
      queryClient.invalidateQueries({ queryKey: ["admin_announcements_active"] });
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("admin_announcements").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_announcements_all"] });
      queryClient.invalidateQueries({ queryKey: ["admin_announcements_active"] });
      toast.success("Banner removido!");
    },
  });

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bell className="h-5 w-5 text-primary" /> Banners para Painel dos Tenants
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Crie banners de avisos, promoções ou alertas que aparecerão no topo do painel administrativo de todos os tenants.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Título *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Manutenção programada..." />
          </div>
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={bannerType} onValueChange={setBannerType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="info">ℹ️ Informação</SelectItem>
                <SelectItem value="warning">⚠️ Alerta</SelectItem>
                <SelectItem value="promo">📣 Promoção</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Descrição (opcional)</Label>
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Detalhes adicionais..." rows={2} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Cor de Fundo</Label>
            <div className="flex gap-2 items-center">
              <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="h-9 w-12 rounded border border-border cursor-pointer" />
              <Input value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="flex-1" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Cor do Texto</Label>
            <div className="flex gap-2 items-center">
              <input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} className="h-9 w-12 rounded border border-border cursor-pointer" />
              <Input value={textColor} onChange={(e) => setTextColor(e.target.value)} className="flex-1" />
            </div>
          </div>
        </div>

        {title && (
          <div className="rounded-lg overflow-hidden border border-border">
            <div className="py-2.5 px-4 text-sm font-medium flex items-center gap-2" style={{ backgroundColor: bgColor, color: textColor }}>
              {bannerType === "warning" ? "⚠️" : bannerType === "promo" ? "📣" : "ℹ️"} {title}{body ? ` — ${body}` : ""}
            </div>
          </div>
        )}

        <Button onClick={() => createMut.mutate()} disabled={!title || createMut.isPending}>
          <Plus className="h-4 w-4 mr-2" /> Criar Banner
        </Button>

        <Separator />

        <h4 className="font-semibold text-sm">Banners Ativos</h4>
        {isLoading ? (
          <Skeleton className="h-20" />
        ) : !announcements?.length ? (
          <p className="text-sm text-muted-foreground">Nenhum banner criado.</p>
        ) : (
          <div className="space-y-2">
            {announcements.map((ann: any) => (
              <div key={ann.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: ann.bg_color }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{ann.title}</p>
                  {ann.body && <p className="text-xs text-muted-foreground truncate">{ann.body}</p>}
                </div>
                <Switch checked={ann.active} onCheckedChange={(v) => toggleMut.mutate({ id: ann.id, active: v })} />
                <Button variant="ghost" size="icon" onClick={() => deleteMut.mutate(ann.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
