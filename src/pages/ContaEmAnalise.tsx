import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LogOut, Ban, ShieldOff } from "lucide-react";
import cartlyLogo from "@/assets/cartly-logo.png";

export default function ContaEmAnalise() {
  const { user, signOut } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ["profile_block_status", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("status")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const { data: storeSettings } = useQuery({
    queryKey: ["store_block_status", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("store_settings")
        .select("admin_blocked, store_blocked")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const isBlocked = profile?.status === "blocked";
  const isAdminBlocked = (storeSettings as any)?.admin_blocked === true;
  const isRejected = profile?.status === "rejected";

  const getContent = () => {
    if (isBlocked) {
      return {
        icon: <Ban className="h-10 w-10 text-destructive" />,
        iconBg: "bg-destructive/10",
        title: "Conta Bloqueada",
        description: "Sua conta foi bloqueada pelo administrador da plataforma.",
        detail: "Entre em contato com o suporte para mais informações.",
        badge: "🚫 Status: Conta bloqueada",
        badgeBorder: "border-destructive/30 bg-destructive/5",
        badgeText: "text-destructive",
      };
    }
    if (isAdminBlocked) {
      return {
        icon: <ShieldOff className="h-10 w-10 text-orange-500" />,
        iconBg: "bg-orange-500/10",
        title: "Painel Bloqueado",
        description: "O acesso ao painel administrativo da sua loja está temporariamente bloqueado.",
        detail: "Entre em contato com o suporte para mais informações.",
        badge: "🔒 Status: Painel administrativo bloqueado",
        badgeBorder: "border-orange-500/30 bg-orange-500/5",
        badgeText: "text-orange-600 dark:text-orange-400",
      };
    }
    if (isRejected) {
      return {
        icon: <Ban className="h-10 w-10 text-destructive" />,
        iconBg: "bg-destructive/10",
        title: "Conta Desativada",
        description: "Sua conta foi desativada pelo administrador da plataforma.",
        detail: "Entre em contato com o suporte se acredita que houve um erro.",
        badge: "❌ Status: Conta desativada",
        badgeBorder: "border-destructive/30 bg-destructive/5",
        badgeText: "text-destructive",
      };
    }
    return {
      icon: <Ban className="h-10 w-10 text-destructive" />,
      iconBg: "bg-destructive/10",
      title: "Acesso Negado",
      description: "Você não tem permissão para acessar esta área.",
      detail: "Entre em contato com o suporte.",
      badge: "🚫 Acesso negado",
      badgeBorder: "border-destructive/30 bg-destructive/5",
      badgeText: "text-destructive",
    };
  };

  const content = getContent();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border shadow-lg">
        <CardContent className="flex flex-col items-center text-center py-12 px-6 space-y-6">
          <img src={cartlyLogo} alt="Cartly" className="h-12 w-auto" />

          <div className={`flex h-20 w-20 items-center justify-center rounded-full ${content.iconBg}`}>
            {content.icon}
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {content.title}
            </h1>
            <p className="text-muted-foreground leading-relaxed">
              {content.description}
            </p>
            <p className="text-sm text-muted-foreground">
              {content.detail}
            </p>
          </div>

          <div className={`rounded-lg border ${content.badgeBorder} p-4 w-full`}>
            <p className={`text-sm ${content.badgeText} font-medium`}>
              {content.badge}
            </p>
          </div>

          <Button variant="outline" onClick={signOut} className="mt-4">
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
