import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import cartlyLogo from "@/assets/cartly-logo.png";

const SUPER_ADMIN_EMAIL = "evelynesantoscruivinel@gmail.com";

export default function Login() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isRegister, setIsRegister] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
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
      if (isForgotPassword) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("E-mail de redefinição enviado! Verifique sua caixa de entrada.");
        setIsForgotPassword(false);
      } else if (isRegister) {
        if (!acceptedTerms) {
          toast.error("Você precisa aceitar os Termos de Uso para criar sua conta.");
          setLoading(false);
          return;
        }
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: displayName },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        toast.success("Conta criada! Sua conta está em análise pelo administrador.");
        setIsRegister(false);
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate(email === SUPER_ADMIN_EMAIL ? "/superadmin" : "/admin");
      }
    } catch (error: any) {
      toast.error(error.message || "Erro ao autenticar");
    } finally {
      setLoading(false);
    }
  };

  const getTitle = () => {
    if (isForgotPassword) return "Redefinir Senha";
    if (isRegister) return "Criar Conta Admin";
    return "Painel Administrativo";
  };

  const getDescription = () => {
    if (isForgotPassword) return "Informe seu e-mail para receber o link de redefinição";
    if (isRegister) return "Preencha os dados para criar sua conta";
    return "Entre com suas credenciais para acessar o painel";
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border shadow-lg">
        <CardHeader className="text-center space-y-3">
          <img src={cartlyLogo} alt="Cartly" className="mx-auto h-16 w-auto" />
          <CardTitle className="text-2xl font-bold tracking-tight">{getTitle()}</CardTitle>
          <CardDescription>{getDescription()}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && !isForgotPassword && (
              <div className="space-y-2">
                <Label htmlFor="displayName">Nome</Label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Seu nome"
                  required
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@loja.com"
                required
              />
            </div>
            {!isForgotPassword && (
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {!isRegister && (
                  <button
                    type="button"
                    onClick={() => setIsForgotPassword(true)}
                    className="text-xs text-primary hover:underline"
                  >
                    Esqueceu sua senha?
                  </button>
                )}
              </div>
            )}
            {isRegister && !isForgotPassword && (
              <div className="flex items-start space-x-2">
                <Checkbox
                  id="terms"
                  checked={acceptedTerms}
                  onCheckedChange={(checked) => setAcceptedTerms(checked === true)}
                />
                <label htmlFor="terms" className="text-sm text-muted-foreground leading-tight cursor-pointer">
                  Li e aceito os{" "}
                  <a href="/termos" target="_blank" className="text-primary hover:underline font-medium">
                    Termos de Uso
                  </a>{" "}
                  e a{" "}
                  <a href="/privacidade" target="_blank" className="text-primary hover:underline font-medium">
                    Política de Privacidade
                  </a>
                </label>
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading || (isRegister && !acceptedTerms)}>
              {loading
                ? "Carregando..."
                : isForgotPassword
                ? "Enviar Link"
                : isRegister
                ? "Criar Conta"
                : "Entrar"}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm text-muted-foreground">
            {isForgotPassword ? (
              <button
                onClick={() => setIsForgotPassword(false)}
                className="font-medium text-primary hover:underline"
              >
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
                  className="font-medium text-primary hover:underline"
                >
                  {isRegister ? "Fazer login" : "Criar conta"}
                </button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
