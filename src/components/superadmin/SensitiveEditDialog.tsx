import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, ShieldCheck, Mail, KeyRound, Globe } from "lucide-react";
import { toast } from "sonner";

interface SensitiveEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenant: any;
  onSuccess?: () => void;
}

type Field = "email" | "password" | "slug";

const FIELD_CONFIG: Record<Field, { action: string; label: string; icon: any; payloadKey: string; type: string; placeholder: string }> = {
  email: { action: "update_user_email", label: "Novo email", icon: Mail, payloadKey: "newEmail", type: "email", placeholder: "novo@email.com" },
  password: { action: "update_user_password", label: "Nova senha (mín 8)", icon: KeyRound, payloadKey: "newPassword", type: "password", placeholder: "••••••••" },
  slug: { action: "update_store_slug", label: "Novo slug da loja", icon: Globe, payloadKey: "newSlug", type: "text", placeholder: "minha-loja" },
};

export function SensitiveEditDialog({ open, onOpenChange, tenant, onSuccess }: SensitiveEditDialogProps) {
  const [field, setField] = useState<Field>("email");
  const [value, setValue] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"input" | "otp">("input");
  const [loading, setLoading] = useState(false);

  const cfg = FIELD_CONFIG[field];
  const Icon = cfg.icon;

  const reset = () => {
    setField("email");
    setValue("");
    setOtp("");
    setStep("input");
    setLoading(false);
  };

  const handleClose = (o: boolean) => {
    if (!o) reset();
    onOpenChange(o);
  };

  const requestOtp = async () => {
    if (!value.trim()) { toast.error("Preencha o novo valor"); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-tenant-actions", {
        body: {
          action: "request_otp",
          sensitiveAction: cfg.action,
          targetUserId: tenant.user_id,
          payload: { [cfg.payloadKey]: value },
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Código enviado para o seu email");
      setStep("otp");
    } catch (e: any) {
      toast.error(e.message || "Erro ao solicitar código");
    } finally {
      setLoading(false);
    }
  };

  const verifyAndExecute = async () => {
    if (otp.length !== 6) { toast.error("Código deve ter 6 dígitos"); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-tenant-actions", {
        body: {
          action: "verify_otp_and_execute",
          sensitiveAction: cfg.action,
          targetUserId: tenant.user_id,
          code: otp,
          payload: { [cfg.payloadKey]: value },
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Alteração aplicada com sucesso!");
      onSuccess?.();
      handleClose(false);
    } catch (e: any) {
      toast.error(e.message || "Falha na verificação");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Edição com dupla aprovação
          </DialogTitle>
          <DialogDescription>
            Tenant: <strong>{tenant?.display_name}</strong>. Toda alteração exige código de 6 dígitos enviado ao seu email e o tenant será notificado.
          </DialogDescription>
        </DialogHeader>

        {step === "input" ? (
          <div className="space-y-4">
            <div>
              <Label className="mb-2 block">Campo a alterar</Label>
              <div className="grid grid-cols-3 gap-2">
                {(["email", "password", "slug"] as Field[]).map((f) => {
                  const C = FIELD_CONFIG[f];
                  const I = C.icon;
                  return (
                    <Button
                      key={f}
                      type="button"
                      variant={field === f ? "default" : "outline"}
                      size="sm"
                      onClick={() => { setField(f); setValue(""); }}
                      className="flex-col h-auto py-3 gap-1"
                    >
                      <I className="h-4 w-4" />
                      <span className="text-xs capitalize">{f}</span>
                    </Button>
                  );
                })}
              </div>
            </div>
            <div>
              <Label className="mb-1 flex items-center gap-2"><Icon className="h-3.5 w-3.5" />{cfg.label}</Label>
              <Input
                type={cfg.type}
                placeholder={cfg.placeholder}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                autoComplete="off"
              />
            </div>
            <Alert>
              <AlertDescription className="text-xs">
                Será enviado código de 6 dígitos para o email do super admin (você). O tenant também será notificado por email e no painel sobre a tentativa de alteração.
              </AlertDescription>
            </Alert>
            <Button onClick={requestOtp} disabled={loading || !value.trim()} className="w-full">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enviar código de confirmação
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <Alert>
              <AlertDescription>
                Verifique seu email e digite o código de 6 dígitos abaixo. Validade: 10 minutos.
              </AlertDescription>
            </Alert>
            <div>
              <Label className="mb-1 block">Código de confirmação</Label>
              <Input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                className="text-center text-2xl tracking-[0.5em] font-mono"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("input")} disabled={loading} className="flex-1">
                Voltar
              </Button>
              <Button onClick={verifyAndExecute} disabled={loading || otp.length !== 6} className="flex-1">
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirmar e aplicar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
