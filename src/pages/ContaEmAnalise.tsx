import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LogOut, Ban, ShieldOff, Wrench, MessageCircle } from "lucide-react";
import cartlyLogo from "@/assets/cartly-logo.png";

export default function ContaEmAnalise() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

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

  const { data: platformSettings } = useQuery({
    queryKey: ["platform_settings_conta_analise"],
    queryFn: async () => {
      const { data } = await supabase
        .from("platform_settings")
        .select("*");
      
      const settings: any = {};
      data?.forEach(row => {
        settings[row.key] = (row.value as any)?.value;
      });
      return settings;
    },
    refetchInterval: 5000, // Re-check every 5s so status updates quickly
  });

  const isBlocked = profile?.status === "blocked";
  const isAdminBlocked = (storeSettings as any)?.admin_blocked === true;
  const isRejected = profile?.status === "rejected";
  const isMaintenance = platformSettings?.maintenance_mode === true;

  // Auto-redirect away if the reason for being here no longer applies
  useEffect(() => {
    if (!profile && !storeSettings && !platformSettings) return; // still loading
    const hasReason = isBlocked || isAdminBlocked || isRejected || isMaintenance;
    if (!hasReason) {
      navigate("/admin", { replace: true });
    }
  }, [isBlocked, isAdminBlocked, isRejected, isMaintenance, profile, storeSettings, platformSettings, navigate]);

  const getContent = () => {
    if (isMaintenance) {
      return {
        icon: <Wrench className="h-10 w-10 text-primary" />,
        iconBg: "bg-primary/10",
        title: "Modo Manutenção",
        description: "A plataforma está em manutenção para melhorias.",
        detail: "Voltaremos em breve! Se precisar de ajuda imediata, use o suporte abaixo.",
        badge: "🛠️ Status: Manutenção global",
        badgeBorder: "border-primary/30 bg-primary/5",
        badgeText: "text-primary",
      };
    }
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

          <div className="flex flex-col w-full gap-3 mt-4">
            {platformSettings?.support_whatsapp_number && (
              <Button 
                className="w-full bg-[#25D366] hover:bg-[#20ba5a] text-white font-semibold"
                onClick={() => window.open(`https://wa.me/${platformSettings.support_whatsapp_number}?text=Olá,%20preciso%20de%20ajuda%20com%20minha%20conta%20no%20Cartlly`, "_blank")}
              >
                <MessageCircle className="mr-2 h-5 w-5" />
                Suporte via WhatsApp
              </Button>
            )}
            
            <Button variant="outline" onClick={signOut} className="w-full">
              <LogOut className="mr-2 h-4 w-4" />
              Sair da Conta
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
