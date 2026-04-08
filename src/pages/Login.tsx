import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Eye, EyeOff, Mail, CheckCircle2 } from "lucide-react";
import cartlyLogo from "@/assets/cartly-logo.png";
import siteSeguro from "@/assets/site-seguro.webp";

const SUPER_ADMIN_EMAIL = "evelynesantoscruivinel@gmail.com";

const LOGIN_PHRASES = [
  "Bem-vindo de volta à sua loja! 🏪",
  "Seus clientes estão esperando... 🚀",
  "Hora de faturar! 💰",
  "Sua loja, seu sucesso! ✨",
];

const REGISTER_PHRASES = [
  "Seja bem-vindo à Cartly! 🎉",
  "Você está prestes a faturar muito! 💎",
  "Monte sua loja em minutos! ⚡",
  "O futuro do seu negócio começa aqui! 🌟",
];

function useTypewriter(phrases: string[], speed = 60, pause = 2500) {
  const [text, setText] = useState("");
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const current = phrases[phraseIndex];
    const timeout = setTimeout(() => {
      if (!isDeleting) {
        setText(current.slice(0, charIndex + 1));
        setCharIndex((c) => c + 1);
        if (charIndex + 1 === current.length) {
          setTimeout(() => setIsDeleting(true), pause);
        }
      } else {
        setText(current.slice(0, charIndex - 1));
        setCharIndex((c) => c - 1);
        if (charIndex <= 1) {
          setIsDeleting(false);
          setPhraseIndex((p) => (p + 1) % phrases.length);
          setCharIndex(0);
        }
      }
    }, isDeleting ? speed / 2 : speed);
    return () => clearTimeout(timeout);
  }, [charIndex, isDeleting, phraseIndex, phrases, speed, pause]);

  return text;
}

export default function Login() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isRegister, setIsRegister] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [showEmailSent, setShowEmailSent] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [storeName, setStoreName] = useState("");
  const [storeSlug, setStoreSlug] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [alertCard, setAlertCard] = useState<{ type: "error" | "warning" | "success"; message: string } | null>(null);

  const loginText = useTypewriter(LOGIN_PHRASES);
  const registerText = useTypewriter(REGISTER_PHRASES);

  useEffect(() => {
    if (user) {
      // Never redirect customer accounts to admin
      const isCustomer = user.user_metadata?.is_customer === true;
      if (isCustomer) {
        // Customer accidentally on admin login page — check if there's a stored redirect
        const authContextStr = localStorage.getItem("auth_context");
        if (authContextStr) {
          try {
            const ctx = JSON.parse(authContextStr);
            if (ctx.redirect_back) {
              localStorage.removeItem("auth_context");
              window.location.href = ctx.redirect_back;
              return;
            }
          } catch { /* ignore */ }
        }
        // Sign out from admin context — they shouldn't be here
        supabase.auth.signOut();
        return;
      }

      // Check for admin OAuth context — if auth_context says store_customer, don't redirect to admin
      const authContextStr = localStorage.getItem("auth_context");
      if (authContextStr) {
        try {
          const ctx = JSON.parse(authContextStr);
          if (ctx.type === "store_customer" && ctx.redirect_back) {
            // This is a store customer who landed on /login after OAuth — redirect back to store
            // The CustomerAuthProvider will handle the rest
            window.location.href = ctx.redirect_back;
            return;
          }
        } catch { /* ignore */ }
      }

      if (user.email === SUPER_ADMIN_EMAIL) {
        navigate("/superadmin", { replace: true });
      } else {
        navigate("/admin", { replace: true });
      }
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      setAlertCard(null);
      if (isForgotPassword) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setAlertCard({ type: "success", message: "E-mail de redefinição enviado! Verifique sua caixa de entrada." });
        setIsForgotPassword(false);
      } else if (isRegister) {
        if (!acceptedTerms) {
          setAlertCard({ type: "error", message: "Você precisa aceitar os Termos de Uso para criar sua conta." });
          setLoading(false);
          return;
        }
        const slug = storeSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
        if (!slug) {
          setAlertCard({ type: "error", message: "Defina um slug válido para sua loja." });
          setLoading(false);
          return;
        }
        const { data: existingSlug } = await supabase
          .from("store_settings")
          .select("id")
          .eq("store_slug", slug)
          .maybeSingle();
        if (existingSlug) {
          setAlertCard({ type: "error", message: "Este slug já está em uso. Escolha outro." });
          setLoading(false);
          return;
        }
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: displayName },
            emailRedirectTo: window.location.origin,
          },
        });
        if (signUpError) {
          if (signUpError.message.includes("already registered") || signUpError.message.includes("already been registered")) {
            throw new Error("Este e-mail já está cadastrado. Faça login.");
          }
          throw signUpError;
        }
        if (signUpData.user && (!signUpData.user.identities || signUpData.user.identities.length === 0)) {
          throw new Error("Este e-mail já está cadastrado. Faça login.");
        }
        if (signUpData.user) {
          await supabase.from("store_settings").insert({
            user_id: signUpData.user.id,
            store_name: storeName.trim() || displayName || "Minha Loja",
            store_slug: slug,
          });
        }
        await supabase.auth.signOut();
        setShowEmailSent(true);
      } else {
        const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
        if (loginError) {
          if (loginError.message.includes("Email not confirmed")) {
            setAlertCard({ type: "warning", message: "Seu e-mail ainda não foi verificado. Verifique sua caixa de entrada e clique no link de confirmação." });
            setLoading(false);
            return;
          }
          if (loginError.message.includes("Invalid login")) {
            throw new Error("E-mail ou senha inválidos. Verifique seus dados.");
          }
          throw loginError;
        }
        navigate(email === SUPER_ADMIN_EMAIL ? "/superadmin" : "/admin");
      }
    } catch (error: any) {
      setAlertCard({ type: "error", message: error.message || "Erro ao autenticar" });
    } finally {
      setLoading(false);
    }
  };

  // Email verification success screen
  if (showEmailSent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="pointer-events-none fixed inset-0">
          <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl animate-pulse" />
          <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-purple-500/10 blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
        </div>
        <Card className="relative w-full max-w-md border-0 shadow-2xl rounded-2xl bg-card z-10">
          <CardContent className="flex flex-col items-center text-center py-12 px-6 space-y-6">
            <img src={cartlyLogo} alt="Cartly" className="h-16 w-auto" />
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-500/10">
              <Mail className="h-10 w-10 text-green-500" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Verifique seu E-mail
              </h1>
              <p className="text-muted-foreground leading-relaxed">
                Enviamos um link de verificação para <strong className="text-foreground">{email}</strong>
              </p>
              <p className="text-sm text-muted-foreground">
                Clique no link do e-mail para ativar sua conta automaticamente. Após a verificação, você já pode fazer login.
              </p>
            </div>
            <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-4 w-full">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                <p className="text-sm font-medium">Conta criada com sucesso! Verifique seu e-mail.</p>
              </div>
            </div>
            <div className="space-y-2 w-full">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setShowEmailSent(false);
                  setIsRegister(false);
                }}
              >
                Voltar ao Login
              </Button>
              <p className="text-xs text-muted-foreground">
                Não recebeu? Verifique a pasta de spam ou{" "}
                <button
                  onClick={async () => {
                    try {
                      const { error } = await supabase.auth.resend({ type: "signup", email });
                      if (error) throw error;
                      toast.success("E-mail reenviado!");
                    } catch (err: any) {
                      toast.error(err.message || "Erro ao reenviar");
                    }
                  }}
                  className="text-blue-500 hover:underline font-medium"
                >
                  reenvie o e-mail
                </button>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getTitle = () => {
    if (isForgotPassword) return "Redefinir Senha";
    if (isRegister) return "Criar Conta";
    return "Painel Administrativo";
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 overflow-hidden">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-purple-500/10 blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
      </div>

      <div className="relative w-full max-w-md">
        <div className="absolute -inset-[2px] rounded-2xl overflow-hidden">
          <div
            className="absolute inset-0 animate-spin"
            style={{
              background: "conic-gradient(from 0deg, #3b82f6, #60a5fa, #93c5fd, #2563eb, #1d4ed8, #3b82f6)",
              animationDuration: "3s",
            }}
          />
        </div>
        <div className="absolute -inset-[6px] rounded-2xl bg-blue-500/20 blur-xl animate-pulse" />

        <Card className="relative w-full border-0 shadow-2xl rounded-2xl bg-card z-10">
          <CardHeader className="text-center space-y-4 pt-8">
            <img src={cartlyLogo} alt="Cartly" className="mx-auto h-20 w-auto drop-shadow-lg" />
            <img src={siteSeguro} alt="Site 100% Seguro" className="mx-auto h-16" />
            <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
              {getTitle()}
            </CardTitle>

            {!isForgotPassword && (
              <div className="h-8 flex items-center justify-center">
                <p className="text-sm font-medium bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
                  {isRegister ? registerText : loginText}
                  <span className="inline-block w-0.5 h-4 bg-blue-500 ml-0.5 animate-pulse align-middle" />
                </p>
              </div>
            )}

            {isForgotPassword && (
              <CardDescription>Informe seu e-mail para receber o link de redefinição</CardDescription>
            )}
          </CardHeader>

          <CardContent className="pb-8">
            {/* Alert Card */}
            {alertCard && (
              <div className={`mb-4 rounded-lg border p-3 ${
                alertCard.type === "error" ? "border-destructive/40 bg-destructive/5" :
                alertCard.type === "warning" ? "border-yellow-500/40 bg-yellow-500/5" :
                "border-green-500/40 bg-green-500/5"
              }`}>
                <div className={`flex items-start gap-2 ${
                  alertCard.type === "error" ? "text-destructive" :
                  alertCard.type === "warning" ? "text-yellow-600 dark:text-yellow-400" :
                  "text-green-600 dark:text-green-400"
                }`}>
                  {alertCard.type === "error" ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  ) : alertCard.type === "warning" ? (
                    <Mail className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  )}
                  <p className="text-sm font-medium leading-tight">{alertCard.message}</p>
                </div>
                {alertCard.type === "warning" && (
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const { error } = await supabase.auth.resend({ type: "signup", email });
                        if (error) throw error;
                        toast.success("E-mail de verificação reenviado!");
                      } catch (err: any) {
                        toast.error(err.message || "Erro ao reenviar");
                      }
                    }}
                    className="mt-2 text-xs text-blue-500 hover:underline font-medium ml-6"
                  >
                    Reenviar e-mail de verificação
                  </button>
                )}
              </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              {isRegister && !isForgotPassword && (
                <div className="space-y-2">
                  <Label htmlFor="displayName">Seu Nome</Label>
                  <Input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Seu nome completo" required className="h-11 border-border/50 focus:border-blue-500 transition-colors" />
                </div>
              )}
              {isRegister && !isForgotPassword && (
                <div className="space-y-2">
                  <Label htmlFor="storeName">Nome da Loja</Label>
                  <Input id="storeName" value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder="Ex: Moda Fashion" required className="h-11 border-border/50 focus:border-blue-500 transition-colors" />
                </div>
              )}
              {isRegister && !isForgotPassword && (
                <div className="space-y-2">
                  <Label htmlFor="storeSlug">URL da Loja (slug)</Label>
                  <div className="flex items-center gap-0">
                    <span className="inline-flex h-11 items-center rounded-l-md border border-r-0 border-border/50 bg-muted px-3 text-xs text-muted-foreground">/loja/</span>
                    <Input id="storeSlug" value={storeSlug} onChange={(e) => setStoreSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} placeholder="moda-fashion" required className="h-11 rounded-l-none border-border/50 focus:border-blue-500 transition-colors" />
                  </div>
                  <p className="text-xs text-muted-foreground">Esse será o endereço da sua loja online</p>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@loja.com" required className="h-11 border-border/50 focus:border-blue-500 transition-colors" />
              </div>
              {!isForgotPassword && (
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <div className="relative">
                    <Input id="password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} className="h-11 border-border/50 focus:border-blue-500 transition-colors" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {!isRegister && (
                    <button type="button" onClick={() => setIsForgotPassword(true)} className="text-xs text-blue-500 hover:underline">
                      Esqueceu sua senha?
                    </button>
                  )}
                </div>
              )}
              {isRegister && !isForgotPassword && (
                <div className="flex items-start space-x-2">
                  <Checkbox id="terms" checked={acceptedTerms} onCheckedChange={(checked) => setAcceptedTerms(checked === true)} />
                  <label htmlFor="terms" className="text-sm text-muted-foreground leading-tight cursor-pointer">
                    Li e aceito os{" "}
                    <a href="/termos" target="_blank" className="text-blue-500 hover:underline font-medium">Termos de Uso</a>{" "}
                    e a{" "}
                    <a href="/privacidade" target="_blank" className="text-blue-500 hover:underline font-medium">Política de Privacidade</a>
                  </label>
                </div>
              )}
              <Button
                type="submit"
                className="w-full h-11 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white font-semibold shadow-lg shadow-blue-500/25 transition-all duration-300 hover:shadow-blue-500/40"
                disabled={loading || (isRegister && !acceptedTerms)}
              >
                {loading ? "Carregando..." : isForgotPassword ? "Enviar Link" : isRegister ? "Criar Conta" : "Entrar"}
              </Button>
            </form>

            {/* Google Sign-In */}
            {!isForgotPassword && (
              <>
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">ou continue com</span>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-11"
                  disabled={loading}
                  onClick={async () => {
                    setLoading(true);
                    try {
                      // Mark this as an admin/tenant OAuth flow
                      localStorage.setItem("auth_context", JSON.stringify({ type: "admin" }));
                      const { error } = await lovable.auth.signInWithOAuth("google", {
                        redirect_uri: window.location.origin,
                      });
                      if (error) throw error;
                    } catch (err: any) {
                      localStorage.removeItem("auth_context");
                      toast.error(err.message || "Erro ao entrar com Google");
                    } finally {
                      setLoading(false);
                    }
                  }}
                >
                  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Entrar com Google
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-11"
                  disabled={loading}
                  onClick={async () => {
                    setLoading(true);
                    try {
                      localStorage.setItem("auth_context", JSON.stringify({ type: "admin" }));
                      const { error } = await lovable.auth.signInWithOAuth("apple", {
                        redirect_uri: window.location.origin,
                      });
                      if (error) throw error;
                    } catch (err: any) {
                      localStorage.removeItem("auth_context");
                      toast.error(err.message || "Erro ao entrar com Apple");
                    } finally {
                      setLoading(false);
                    }
                  }}
                >
                  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                  </svg>
                  Entrar com Apple
                </Button>
              </>
            )}
            <div className="mt-4 text-center text-sm text-muted-foreground">
              {isForgotPassword ? (
                <button onClick={() => setIsForgotPassword(false)} className="font-medium text-blue-500 hover:underline">
                  Voltar ao login
                </button>
              ) : (
                <>
                  {isRegister ? "Já tem uma conta?" : "Não tem uma conta?"}{" "}
                  <button
                    onClick={() => {
                      setIsRegister(!isRegister);
                      setAcceptedTerms(false);
                    }}
                    className="font-medium text-blue-500 hover:underline"
                  >
                    {isRegister ? "Fazer login" : "Criar conta"}
                  </button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
