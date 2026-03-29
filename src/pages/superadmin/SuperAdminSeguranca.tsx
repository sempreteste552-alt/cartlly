import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, Mail, Smartphone, MessageCircle, Clock, Lock, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface SecurityConfig {
  otp_email_enabled: boolean;
  otp_sms_enabled: boolean;
  otp_whatsapp_enabled: boolean;
  otp_default_method: string;
  otp_code_length: number;
  otp_expiration_minutes: number;
  otp_max_attempts: number;
  require_otp_new_device: boolean;
  require_otp_new_ip: boolean;
  lockout_duration_minutes: number;
  max_failed_logins: number;
}

export default function SuperAdminSeguranca() {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<SecurityConfig>({
    otp_email_enabled: true,
    otp_sms_enabled: false,
    otp_whatsapp_enabled: false,
    otp_default_method: "email",
    otp_code_length: 6,
    otp_expiration_minutes: 5,
    otp_max_attempts: 5,
    require_otp_new_device: true,
    require_otp_new_ip: true,
    lockout_duration_minutes: 30,
    max_failed_logins: 5,
  });

  const { isLoading } = useQuery({
    queryKey: ["security_settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("security_settings")
        .select("*")
        .limit(1)
        .single();
      if (error) throw error;
      if (data) {
        setConfig({
          otp_email_enabled: data.otp_email_enabled,
          otp_sms_enabled: data.otp_sms_enabled,
          otp_whatsapp_enabled: data.otp_whatsapp_enabled,
          otp_default_method: data.otp_default_method,
          otp_code_length: data.otp_code_length,
          otp_expiration_minutes: data.otp_expiration_minutes,
          otp_max_attempts: data.otp_max_attempts,
          require_otp_new_device: data.require_otp_new_device,
          require_otp_new_ip: data.require_otp_new_ip,
          lockout_duration_minutes: data.lockout_duration_minutes,
          max_failed_logins: data.max_failed_logins,
        });
      }
      return data;
    },
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("security_settings")
        .update({
          ...config,
          updated_at: new Date().toISOString(),
        })
        .not("id", "is", null);

      if (error) throw error;
      toast.success("Configurações de segurança salvas!");
      queryClient.invalidateQueries({ queryKey: ["security_settings"] });
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Segurança</h1>
          <p className="text-muted-foreground">Configurações de verificação e proteção da plataforma</p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Salvar
        </Button>
      </div>

      {/* OTP Methods */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="h-5 w-5 text-primary" /> Métodos de Verificação (OTP)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-blue-500" />
              <div>
                <Label>E-mail</Label>
                <p className="text-xs text-muted-foreground">Enviar código por e-mail</p>
              </div>
            </div>
            <Switch
              checked={config.otp_email_enabled}
              onCheckedChange={(v) => setConfig((p) => ({ ...p, otp_email_enabled: v }))}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div className="flex items-center gap-3">
              <Smartphone className="h-5 w-5 text-green-500" />
              <div>
                <Label>SMS</Label>
                <p className="text-xs text-muted-foreground">Enviar código por SMS (requer Twilio)</p>
              </div>
            </div>
            <Switch
              checked={config.otp_sms_enabled}
              onCheckedChange={(v) => setConfig((p) => ({ ...p, otp_sms_enabled: v }))}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div className="flex items-center gap-3">
              <MessageCircle className="h-5 w-5 text-emerald-500" />
              <div>
                <Label>WhatsApp</Label>
                <p className="text-xs text-muted-foreground">Enviar código por WhatsApp (requer Twilio)</p>
              </div>
            </div>
            <Switch
              checked={config.otp_whatsapp_enabled}
              onCheckedChange={(v) => setConfig((p) => ({ ...p, otp_whatsapp_enabled: v }))}
            />
          </div>

          <div className="space-y-2">
            <Label>Método Padrão</Label>
            <Select
              value={config.otp_default_method}
              onValueChange={(v) => setConfig((p) => ({ ...p, otp_default_method: v }))}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="email">E-mail</SelectItem>
                <SelectItem value="sms" disabled={!config.otp_sms_enabled}>SMS</SelectItem>
                <SelectItem value="whatsapp" disabled={!config.otp_whatsapp_enabled}>WhatsApp</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* OTP Configuration */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5 text-primary" /> Configuração do Código
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Tamanho do Código</Label>
              <Select
                value={String(config.otp_code_length)}
                onValueChange={(v) => setConfig((p) => ({ ...p, otp_code_length: parseInt(v) }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="4">4 dígitos</SelectItem>
                  <SelectItem value="6">6 dígitos</SelectItem>
                  <SelectItem value="8">8 dígitos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Expiração (minutos)</Label>
              <Input
                type="number"
                min={1}
                max={30}
                value={config.otp_expiration_minutes}
                onChange={(e) =>
                  setConfig((p) => ({
                    ...p,
                    otp_expiration_minutes: parseInt(e.target.value) || 5,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Max Tentativas</Label>
              <Input
                type="number"
                min={1}
                max={10}
                value={config.otp_max_attempts}
                onChange={(e) =>
                  setConfig((p) => ({
                    ...p,
                    otp_max_attempts: parseInt(e.target.value) || 5,
                  }))
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Device & IP Security */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Lock className="h-5 w-5 text-primary" /> Segurança de Dispositivo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <Label>Verificar Novo Dispositivo</Label>
              <p className="text-xs text-muted-foreground">Exigir OTP ao detectar dispositivo desconhecido</p>
            </div>
            <Switch
              checked={config.require_otp_new_device}
              onCheckedChange={(v) => setConfig((p) => ({ ...p, require_otp_new_device: v }))}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <Label>Verificar Novo IP</Label>
              <p className="text-xs text-muted-foreground">Exigir OTP ao detectar IP diferente</p>
            </div>
            <Switch
              checked={config.require_otp_new_ip}
              onCheckedChange={(v) => setConfig((p) => ({ ...p, require_otp_new_ip: v }))}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Max Logins Falhos</Label>
              <Input
                type="number"
                min={3}
                max={20}
                value={config.max_failed_logins}
                onChange={(e) =>
                  setConfig((p) => ({
                    ...p,
                    max_failed_logins: parseInt(e.target.value) || 5,
                  }))
                }
              />
              <p className="text-xs text-muted-foreground">Bloquear após X tentativas erradas</p>
            </div>
            <div className="space-y-2">
              <Label>Duração do Bloqueio (min)</Label>
              <Input
                type="number"
                min={5}
                max={120}
                value={config.lockout_duration_minutes}
                onChange={(e) =>
                  setConfig((p) => ({
                    ...p,
                    lockout_duration_minutes: parseInt(e.target.value) || 30,
                  }))
                }
              />
              <p className="text-xs text-muted-foreground">Tempo de bloqueio após exceder tentativas</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
