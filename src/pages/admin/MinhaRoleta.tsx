import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Gift, Sparkles, History, CheckCircle, Clock, XCircle, AlertCircle, Trophy, Ticket, Star, Heart } from "lucide-react";
import { RouletteWheel } from "@/components/roulette/RouletteWheel";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import confetti from "canvas-confetti";
import { motion, AnimatePresence } from "framer-motion";

export default function MinhaRoleta() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { width, height } = useWindowSize();
  const [showConfetti, setShowConfetti] = useState(false);
  const [lastWin, setLastWin] = useState<any>(null);

  // Fetch Tenant Subscription
  const { data: subscription, isLoading: subLoading } = useQuery({
    queryKey: ["my_subscription_roulette", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_subscriptions")
        .select("*, tenant_plans(name)")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const tier = (subscription as any)?.tenant_plans?.name || "FREE";

  // Fetch Eligible Prizes
  const { data: prizes, isLoading: prizesLoading } = useQuery({
    queryKey: ["roulette_prizes_eligible", tier],
    queryFn: async () => {
      // Logic to filter prizes by tier
      // For now, we fetch all active ones and let the frontend/DB handle it
      const { data, error } = await supabase
        .from("roulette_prizes")
        .select("*")
        .eq("is_active", true)
        .order("label");
      
      if (error) throw error;

      // Filter by tier in JS if DB policy doesn't handle tier specific visibility
      const tierHierarchy: Record<string, number> = { "FREE": 0, "STARTER": 1, "PRO": 2, "PREMIUM": 3 };
      const currentTierLevel = tierHierarchy[tier] || 0;

      return (data || []).filter(p => {
        const minLevel = tierHierarchy[p.min_subscription_tier] || 0;
        return currentTierLevel >= minLevel;
      });
    },
  });

  // Fetch Spin History
  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ["my_spin_history", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("roulette_spins")
        .select("*, roulette_prizes(label)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const canSpin = history ? history.length === 0 || (new Date().getTime() - new Date(history[0].created_at).getTime() > 24 * 60 * 60 * 1000) : true;

  const handleSpinStart = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("spin-roulette");

      if (error) throw error;
      
      const { prize, spin } = data;
      setLastWin(prize);
      
      return prize;
    } catch (e: any) {
      toast.error("Erro ao girar: " + (e.message || e.error));
      throw e;
    }
  };

  const handleFinish = async (prize: any) => {
    if (!prize) return;
    
    const status = prize.manual_approval_required ? "pending_approval" : "won";
    
    if (status === "won") {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 5000);
      toast.success(`Parabéns! Você ganhou: ${prize.label}`);
    } else {
      toast.info(`Você ganhou ${prize.label}! Aguardando aprovação do admin.`);
    }

    queryClient.invalidateQueries({ queryKey: ["my_spin_history"] });
  };

  if (subLoading || prizesLoading) return <Skeleton className="h-[600px] w-full" />;

  return (
    <div className="max-w-4xl mx-auto space-y-8 p-4 sm:p-8">
      {showConfetti && <Confetti width={width} height={height} recycle={false} />}

      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-full mb-4">
          <Sparkles className="h-8 w-8 text-primary animate-pulse" />
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight">Roleta de Prêmios</h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Tente a sorte e ganhe descontos exclusivos na sua assinatura ou brindes especiais!
        </p>
        <div className="flex justify-center gap-2">
          <Badge variant="outline" className="px-4 py-1 text-sm">
            Seu Plano: {tier}
          </Badge>
          {!canSpin && (
            <Badge variant="secondary" className="px-4 py-1 text-sm bg-amber-100 text-amber-700 border-amber-200">
              Próximo giro em 24h
            </Badge>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-5 gap-8 items-start">
        <Card className="md:col-span-3 overflow-hidden border-2 border-primary/20 shadow-xl bg-gradient-to-b from-white to-gray-50/50">
          <CardHeader className="text-center">
            <CardTitle>Gire a Roda</CardTitle>
            <CardDescription>
              {canSpin ? "Você tem 1 giro disponível!" : "Você já girou recentemente. Volte amanhã!"}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center pb-12">
            <div className={!canSpin ? "opacity-50 grayscale pointer-events-none" : ""}>
              <RouletteWheel 
                prizes={prizes || []} 
                onSpinStart={handleSpinStart}
                onFinish={handleFinish} 
              />
            </div>
          </CardContent>
          {!canSpin && (
            <div className="bg-amber-50 p-4 border-t border-amber-100 flex items-center gap-3 text-amber-800">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <p className="text-sm font-medium">Você já utilizou seu giro diário. Tente novamente amanhã!</p>
            </div>
          )}
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <History className="h-5 w-5 text-muted-foreground" />
              Seu Histórico
            </CardTitle>
          </CardHeader>
          <CardContent>
            {historyLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : history && history.length > 0 ? (
              <div className="space-y-3">
                {history.map((spin: any) => (
                  <div key={spin.id} className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                    <div className="space-y-0.5">
                      <p className="text-sm font-bold">{spin.roulette_prizes?.label}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(spin.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    {spin.status === "won" && (
                      <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" /> Ganhou</Badge>
                    )}
                    {spin.status === "pending_approval" && (
                      <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">
                        <Clock className="h-3 w-3 mr-1" /> Pendente
                      </Badge>
                    )}
                    {spin.status === "rejected" && (
                      <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> Recusado</Badge>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Gift className="h-8 w-8 mx-auto mb-2 opacity-20" />
                <p className="text-sm">Nenhum giro registrado ainda.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        {prizes?.slice(0, 3).map((p) => (
          <div key={p.id} className="p-4 border rounded-xl bg-white flex items-center gap-3 shadow-sm hover:shadow-md transition-shadow">
            <div className="h-10 w-10 rounded-full bg-primary/5 flex items-center justify-center text-primary">
              <Gift className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold">{p.label}</p>
              <p className="text-[10px] text-muted-foreground line-clamp-1">{p.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
