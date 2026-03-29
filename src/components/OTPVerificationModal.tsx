import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Shield, Mail, Smartphone, MessageCircle, Loader2 } from "lucide-react";

interface OTPVerificationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: string;
  purpose: string;
  onVerified: (result: { user_id?: string; reset_token?: string }) => void;
  title?: string;
  description?: string;
}

export default function OTPVerificationModal({
  open,
  onOpenChange,
  email,
  purpose,
  onVerified,
  title = "Verificação de Segurança",
  description = "Digite o código enviado para seu e-mail",
}: OTPVerificationModalProps) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [method, setMethod] = useState<"email" | "sms" | "whatsapp">("email");
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (open && !sent) {
      sendOTP();
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [open]);

  useEffect(() => {
    if (countdown > 0) {
      timerRef.current = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) {
            clearInterval(timerRef.current);
            return 0;
          }
          return c - 1;
        });
      }, 1000);
      return () => clearInterval(timerRef.current);
    }
  }, [countdown]);

  const sendOTP = async () => {
    setSending(true);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/send-otp`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, purpose, method }),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setSent(true);
      setCountdown(60);
      toast.success(`Código enviado para ${email}`);
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar código");
    } finally {
      setSending(false);
    }
  };

  const verifyOTP = async () => {
    if (code.length < 6) return;
    setLoading(true);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/verify-otp`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            code,
            purpose,
            device_fingerprint: getDeviceFingerprint(),
            ip_address: null,
            user_agent: navigator.userAgent,
          }),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      toast.success("Código verificado com sucesso!");
      onVerified({ user_id: data.user_id, reset_token: data.reset_token });
      onOpenChange(false);
      setCode("");
      setSent(false);
    } catch (err: any) {
      toast.error(err.message || "Código inválido");
      setCode("");
    } finally {
      setLoading(false);
    }
  };

  const getDeviceFingerprint = (): string => {
    const nav = navigator;
    const screen = window.screen;
    const raw = `${nav.userAgent}|${nav.language}|${screen.width}x${screen.height}|${screen.colorDepth}|${new Date().getTimezoneOffset()}`;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      const char = raw.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return `dev_${Math.abs(hash).toString(36)}`;
  };

  const methodIcons = {
    email: <Mail className="h-4 w-4" />,
    sms: <Smartphone className="h-4 w-4" />,
    whatsapp: <MessageCircle className="h-4 w-4" />,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center space-y-3">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Shield className="h-7 w-7 text-primary" />
          </div>
          <DialogTitle className="text-xl">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Method selector - only show email for now */}
          <div className="flex gap-2 justify-center">
            {(["email"] as const).map((m) => (
              <Button
                key={m}
                variant={method === m ? "default" : "outline"}
                size="sm"
                onClick={() => setMethod(m)}
                className="gap-2"
              >
                {methodIcons[m]}
                {m === "email" ? "E-mail" : m === "sms" ? "SMS" : "WhatsApp"}
              </Button>
            ))}
          </div>

          {/* OTP Input */}
          <div className="flex justify-center">
            <InputOTP
              maxLength={6}
              value={code}
              onChange={setCode}
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>

          <p className="text-center text-sm text-muted-foreground">
            Código enviado para <strong>{email}</strong>
          </p>

          {/* Verify button */}
          <Button
            onClick={verifyOTP}
            disabled={code.length < 6 || loading}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verificando...
              </>
            ) : (
              "Verificar Código"
            )}
          </Button>

          {/* Resend */}
          <div className="text-center">
            {countdown > 0 ? (
              <p className="text-sm text-muted-foreground">
                Reenviar em <strong>{countdown}s</strong>
              </p>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={sendOTP}
                disabled={sending}
              >
                {sending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Reenviar código
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
