import PushNotificationSettings from "@/components/admin/PushNotificationSettings";
import { useTranslation } from "@/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Bell, Users, Zap, Sparkles } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export default function Notificacoes() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const { data: stats } = useQuery({
    queryKey: ["notif_stats", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [{ count: subs }, { count: sent }] = await Promise.all([
        supabase
          .from("push_subscriptions")
          .select("*", { count: "exact", head: true })
          .eq("store_user_id", user!.id),
        supabase
          .from("admin_notifications")
          .select("*", { count: "exact", head: true })
          .eq("sender_user_id", user!.id)
          .gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString()),
      ]);
      return { subs: subs || 0, sent: sent || 0 };
    },
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Premium header */}
      <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/15 via-purple-500/10 to-pink-500/10 p-5 shadow-[0_0_30px_-10px_hsl(var(--primary)/0.5)]">
        <div className="pointer-events-none absolute -top-20 -right-20 h-48 w-48 rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-20 h-48 w-48 rounded-full bg-pink-500/15 blur-3xl" />
        <div className="relative flex items-start gap-4">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-lg shadow-primary/30 shrink-0">
            <Bell className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold tracking-tight">{t.sidebar.notifications}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Envie notificações push diretas para os celulares dos seus clientes — taxa de abertura até <strong className="text-foreground">10x maior</strong> que e-mail.
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <Card className="border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-transparent shadow-[0_0_20px_-10px_rgba(16,185,129,0.5)]">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/15 flex items-center justify-center">
              <Users className="h-5 w-5 text-emerald-500" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Inscritos</p>
              <p className="text-2xl font-bold text-emerald-500 tabular-nums">{stats?.subs ?? "—"}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-primary/30 bg-gradient-to-br from-primary/10 to-transparent shadow-[0_0_20px_-10px_hsl(var(--primary)/0.5)]">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Enviadas (30d)</p>
              <p className="text-2xl font-bold text-primary tabular-nums">{stats?.sent ?? "—"}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-transparent shadow-[0_0_20px_-10px_rgba(245,158,11,0.5)] col-span-2 lg:col-span-1">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-500/15 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-amber-500" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Dica</p>
              <p className="text-xs font-medium text-foreground leading-tight">Envie de manhã (9h) ou no fim da tarde (18h) para máxima abertura.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <PushNotificationSettings />
    </div>
  );
}
