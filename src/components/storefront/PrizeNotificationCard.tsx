import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Gift, X, Sparkles, Trophy, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import confetti from "canvas-confetti";

interface PrizeNotificationCardProps {
  customer: any;
  storeUserId: string;
  settings: any;
}

export function PrizeNotificationCard({ customer, storeUserId, settings }: PrizeNotificationCardProps) {
  const [prizes, setPrizes] = useState<any[]>([]);
  const [currentPrize, setCurrentPrize] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!customer?.id) return;

    const fetchPrizes = async () => {
      const { data, error } = await supabase
        .from("customer_prizes")
        .select("*, products(name, image_url, description)")
        .eq("customer_id", customer.id)
        .in("status", ["released", "claimed"])
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching prizes:", error);
        return;
      }

      if (data && data.length > 0) {
        setPrizes(data);
        setCurrentPrize(data[0]);
        setIsVisible(true);
        
        // Trigger confetti if it's newly released
        if (data[0].status === "released") {
          confetti({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.6 },
            colors: [settings?.primary_color || "#6d28d9", "#3b82f6", "#10b981", "#f59e0b", "#ef4444"],
          });
        }
      }
    };

    fetchPrizes();

    // Listen for real-time updates
    const channel = supabase
      .channel(`customer-prizes-${customer.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "customer_prizes",
          filter: `customer_id=eq.${customer.id}`,
        },
        () => {
          fetchPrizes();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [customer?.id, storeUserId]);

  const handleRedeem = async () => {
    if (!currentPrize) return;

    // Update status to claimed
    const { error } = await supabase
      .from("customer_prizes")
      .update({ status: "claimed" })
      .eq("id", currentPrize.id);

    if (error) {
      toast.error("Erro ao resgatar prêmio");
      return;
    }

    // Redirect to WhatsApp
    const message = `Olá! Acabei de ganhar o prêmio "${currentPrize.products?.name}" na loja e gostaria de resgatá-lo!`;
    const phone = settings?.whatsapp_number?.replace(/\D/g, "") || "";
    if (phone) {
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank");
    } else {
      toast.error("Número do WhatsApp da loja não configurado.");
    }
  };

  if (!isVisible || !currentPrize) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-sm"
      >
        <Card className="p-6 border border-white/20 shadow-2xl bg-white/10 dark:bg-black/20 backdrop-blur-md relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-2">
            <button onClick={() => setIsVisible(false)} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex flex-col items-center gap-4 text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center relative">
              <Trophy className="h-8 w-8 text-primary animate-bounce" />
              <Sparkles className="absolute -top-1 -right-1 h-4 w-4 text-yellow-500 animate-pulse" />
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-black text-primary tracking-tight">PARABÉNS!</h3>
              <p className="font-bold text-foreground">Você ganhou um presente:</p>
              <div className="mt-3 p-3 rounded-lg bg-muted border border-border">
                {currentPrize.products?.image_url && (
                  <img src={currentPrize.products.image_url} alt={currentPrize.products.name} className="h-24 w-24 mx-auto rounded-md object-cover mb-2" />
                )}
                <p className="font-bold text-sm">{currentPrize.products?.name}</p>
                <p className="text-[10px] text-muted-foreground line-clamp-2">{currentPrize.products?.description}</p>
              </div>
            </div>

            <Button 
              className="w-full h-11 font-bold gap-2 text-white hover:scale-[1.02] transition-transform" 
              style={{ backgroundColor: settings?.button_color || "#25D366" }}
              onClick={handleRedeem}
            >
              <MessageCircle className="h-5 w-5" />
              Resgatar meu Prêmio
            </Button>
          </div>

          <div className="absolute -bottom-6 -left-6 w-12 h-12 bg-primary/5 rounded-full blur-xl group-hover:bg-primary/10 transition-colors" />
          <div className="absolute -top-6 -right-6 w-12 h-12 bg-primary/5 rounded-full blur-xl group-hover:bg-primary/10 transition-colors" />
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}
