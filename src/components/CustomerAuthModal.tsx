import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Eye, EyeOff, Loader2, Mail, AlertTriangle, CheckCircle2, ShieldCheck } from "lucide-react";
import { SimpleVerification } from "@/components/SimpleVerification";
import { toast } from "sonner";
import { useCustomerAuth } from "@/hooks/useCustomerAuth";
import { lovable } from "@/integrations/lovable/index";

interface CustomerAuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeUserId: string;
}

export function CustomerAuthModal({ open, onOpenChange, storeUserId }: CustomerAuthModalProps) {
  const { signIn, signUp, resetPassword } = useCustomerAuth();
  const [tab, setTab] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [alertCard, setAlertCard] = useState<{ type: "error" | "warning" | "success"; message: string } | null>(null);
  const [showEmailConfirmCard, setShowEmailConfirmCard] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [isVerified, setIsVerified] = useState(false);

  const getPasswordStrength = (pass: string) => {
    let score = 0;
    if (!pass) return 0;
    if (pass.length > 6) score += 25;
    if (/[A-Z]/.test(pass)) score += 25;
    if (/[0-9]/.test(pass)) score += 25;
    if (/[^A-Za-z0-9]/.test(pass)) score += 25;
    return score;
  };

  const passwordStrength = getPasswordStrength(password);
  const getStrengthColor = (score: number) => {
    if (score <= 25) return "bg-red-500";
    if (score <= 50) return "bg-orange-500";
    if (score <= 75) return "bg-yellow-500";
    return "bg-green-500";
  };
  const getStrengthLabel = (score: number) => {
    if (score <= 25) return "Fraca";
    if (score <= 50) return "Média";
    if (score <= 75) return "Boa";
    return "Forte";
  };

  const clearAlerts = () => {
    setAlertCard(null);
    setShowEmailConfirmCard(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAlerts();
    setLoading(true);
    try {
      if (!isVerified) {
        setAlertCard({ type: "error", message: "Responda corretamente ao desafio de segurança." });
        setLoading(false);
        return;
      }
      const captchaValid = true;
      if (!captchaValid) {
        setIsVerified(false);
        setAlertCard({ type: "error", message: "Verificação falhou. Tente novamente." });
        setLoading(false);
        return;
      }
      await signIn(email, password, storeUserId);
      toast.success("Login efetuado com sucesso!", { duration: 3000 });
      setEmail("");
      setPassword("");
      onOpenChange(false);
    } catch (err: any) {
      const msg = err.message || "Erro ao fazer login";
      if (msg.includes("Confirme seu e-mail") || msg.includes("Email not confirmed") || msg.includes("não foi verificado")) {
        setAlertCard({ type: "warning", message: "Seu e-mail ainda não foi confirmado. Verifique sua caixa de entrada e clique no link de verificação." });
        setRegisteredEmail(email);
        setShowEmailConfirmCard(true);
      } else if (msg.includes("inválidos") || msg.includes("Invalid login")) {
        setAlertCard({ type: "error", message: "E-mail ou senha incorretos. Verifique seus dados e tente novamente." });
      } else {
        setAlertCard({ type: "error", message: msg });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAlerts();
    if (!name.trim()) {
      setAlertCard({ type: "error", message: "Informe seu nome completo." });
      return;
    }
    setLoading(true);
    try {
      // Verification is temporarily optional to avoid access issues while configuring Cloudflare
      if (!isVerified) {
        setAlertCard({ type: "error", message: "Responda corretamente ao desafio de segurança." });
        setLoading(false);
        return;
      }
      const captchaValid = true;
      if (!captchaValid) {
        setIsVerified(false);
        setAlertCard({ type: "error", message: "Verificação falhou. Tente novamente." });
        setLoading(false);
        return;
      }
      await signUp(email, password, name, storeUserId);
      setRegisteredEmail(email);
      setShowEmailConfirmCard(true);
      setAlertCard({ type: "success", message: "Conta criada com sucesso! Verifique seu e-mail para confirmar." });
      setTab("login");
    } catch (err: any) {
      const msg = err.message || "Erro ao criar conta";
      if (msg.includes("Verifique seu e-mail") || msg.includes("confirmar o cadastro")) {
        // This is expected — email confirmation required
        setRegisteredEmail(email);
        setShowEmailConfirmCard(true);
        setAlertCard({ type: "success", message: "Conta criada! Verifique seu e-mail para confirmar antes de fazer login." });
        setTab("login");
      } else if (msg.includes("já está cadastrado em outra conta") || msg.includes("already")) {
        setAlertCard({ type: "error", message: "Este e-mail já existe em outra conta e não pode ser reaproveitado nesta loja." });
        setTab("login");
      } else if (msg.includes("já está cadastrado nesta loja") || msg.includes("já possui conta")) {
        setAlertCard({ type: "warning", message: "Este e-mail já está registrado. Faça login." });
        setTab("login");
      } else {
        setAlertCard({ type: "error", message: msg });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAlerts();
    if (!email.trim()) {
      setAlertCard({ type: "error", message: "Informe seu e-mail." });
      return;
    }
    setLoading(true);
    try {
      await resetPassword(email);
      setAlertCard({ type: "success", message: "E-mail de redefinição enviado! Verifique sua caixa de entrada." });
      setShowForgot(false);
    } catch (err: any) {
      setAlertCard({ type: "error", message: err.message || "Erro ao enviar e-mail" });
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider: "google" | "apple") => {
    clearAlerts();
    setLoading(true);
    try {
      localStorage.setItem("auth_context", JSON.stringify({
        type: "store_customer",
        store_user_id: storeUserId,
        redirect_back: window.location.href,
      }));
      const { error } = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: window.location.href,
      });
      if (error) throw error;
    } catch (err: any) {
      localStorage.removeItem("auth_context");
      setAlertCard({ type: "error", message: err.message || `Erro ao entrar com ${provider === "google" ? "Google" : "Apple"}` });
    } finally {
      setLoading(false);
    }
  };

  const AlertCard = () => {
    if (!alertCard) return null;
    const styles = {
      error: { border: "border-destructive/40", bg: "bg-destructive/5", text: "text-destructive", icon: <AlertTriangle className="h-4 w-4 flex-shrink-0" /> },
      warning: { border: "border-yellow-500/40", bg: "bg-yellow-500/5", text: "text-yellow-600 dark:text-yellow-400", icon: <Mail className="h-4 w-4 flex-shrink-0" /> },
      success: { border: "border-green-500/40", bg: "bg-green-500/5", text: "text-green-600 dark:text-green-400", icon: <CheckCircle2 className="h-4 w-4 flex-shrink-0" /> },
    };
    const s = styles[alertCard.type];
    return (
      <div className={`rounded-lg border ${s.border} ${s.bg} p-3 w-full`}>
        <div className={`flex items-start gap-2 ${s.text}`}>
          {s.icon}
          <p className="text-sm font-medium leading-tight">{alertCard.message}</p>
        </div>
      </div>
    );
  };

  const EmailConfirmCard = () => {
    if (!showEmailConfirmCard || !registeredEmail) return null;
    return (
      <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-3 w-full space-y-2">
        <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
          <Mail className="h-4 w-4 flex-shrink-0" />
          <p className="text-sm font-medium">Confirme seu e-mail</p>
        </div>
        <p className="text-xs text-muted-foreground">
          Enviamos um link para <strong>{registeredEmail}</strong>. Clique no link para ativar sua conta.
        </p>
        <button
          type="button"
          onClick={async () => {
            try {
              const { supabase } = await import("@/integrations/supabase/client");
              const { error } = await supabase.auth.resend({ type: "signup", email: registeredEmail });
              if (error) throw error;
              toast.success("E-mail reenviado!");
            } catch (err: any) {
              toast.error(err.message || "Erro ao reenviar");
            }
          }}
          className="text-xs text-blue-500 hover:underline font-medium"
        >
          Reenviar e-mail de verificação
        </button>
      </div>
    );
  };

  if (showForgot) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Redefinir Senha</DialogTitle>
          </DialogHeader>
          <AlertCard />
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" required />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Enviar Link
            </Button>
            <button type="button" onClick={() => { setShowForgot(false); clearAlerts(); }} className="text-sm text-muted-foreground hover:underline w-full text-center">
              Voltar ao login
            </button>
          </form>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) clearAlerts(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Minha Conta</DialogTitle>
        </DialogHeader>

        <AlertCard />
        <EmailConfirmCard />

        <Tabs value={tab} onValueChange={(v) => { setTab(v); clearAlerts(); }}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Entrar</TabsTrigger>
            <TabsTrigger value="register">Criar Conta</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <form onSubmit={handleLogin} className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" required />
              </div>
              <div className="space-y-2">
                <Label>Senha</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <button type="button" onClick={() => { setShowForgot(true); clearAlerts(); }} className="text-xs text-muted-foreground hover:underline">
                  Esqueceu sua senha?
                </button>
              </div>
              <div className="flex justify-center">
                <SimpleVerification
                  onVerify={(isValid) => setIsVerified(isValid)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading || !isVerified}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Entrar
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="register">
            <form onSubmit={handleRegister} className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Nome completo</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" required />
              </div>
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" required />
              </div>
              <div className="space-y-2">
                <Label>Senha</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    required
                    minLength={6}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {password && (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <ShieldCheck className="h-3 w-3" />
                        Força da senha:
                      </span>
                      <span className="font-medium" style={{ color: passwordStrength <= 25 ? '#ef4444' : passwordStrength <= 50 ? '#f97316' : passwordStrength <= 75 ? '#eab308' : '#22c55e' }}>
                        {getStrengthLabel(passwordStrength)}
                      </span>
                    </div>
                    <Progress value={passwordStrength} className="h-1" indicatorClassName={getStrengthColor(passwordStrength)} />
                  </div>
                )}
              </div>
              <div className="flex justify-center">
                <SimpleVerification
                  onVerify={(isValid) => setIsVerified(isValid)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading || !isVerified}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Criar Conta
              </Button>
            </form>
          </TabsContent>

          {/* Social sign-in divider */}
          <div className="relative my-3">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">ou continue com</span>
            </div>
          </div>

          <div className="space-y-2">
            {/* Google */}
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={loading}
              onClick={() => handleOAuth("google")}
            >
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Entrar com Google
            </Button>

            {/* Apple */}
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={loading}
              onClick={() => handleOAuth("apple")}
            >
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
              </svg>
              Entrar com Apple
            </Button>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
