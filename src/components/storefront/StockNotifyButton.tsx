import { useState } from "react";
import { Bell, BellRing, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface StockNotifyButtonProps {
  productId: string;
  productName: string;
  storeUserId: string;
  primaryColor?: string;
}

export function StockNotifyButton({ productId, productName, storeUserId, primaryColor = "#6d28d9" }: StockNotifyButtonProps) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = async () => {
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Informe um e-mail válido");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("stock_notify_subscriptions" as any)
        .insert({
          product_id: productId,
          email: email.trim().toLowerCase(),
          store_user_id: storeUserId,
        } as any);

      if (error) {
        if (error.code === "23505") {
          toast.info("Você já está inscrito para este produto!");
          setSubscribed(true);
          setOpen(false);
          return;
        }
        throw error;
      }

      toast.success("Você será avisado quando voltar ao estoque!");
      setSubscribed(true);
      setOpen(false);
    } catch (err) {
      toast.error("Erro ao se inscrever. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  if (subscribed) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-lg border text-sm" style={{ borderColor: `${primaryColor}40`, color: primaryColor, backgroundColor: `${primaryColor}08` }}>
        <BellRing className="h-4 w-4 shrink-0" />
        <span>Você será notificado quando voltar ao estoque!</span>
      </div>
    );
  }

  return (
    <>
      <Button
        variant="outline"
        className="w-full gap-2"
        style={{ borderColor: primaryColor, color: primaryColor }}
        onClick={() => setOpen(true)}
      >
        <Bell className="h-4 w-4" />
        Avise-me quando voltar ao estoque
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" style={{ color: primaryColor }} />
              Alerta de Estoque
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Informe seu e-mail para receber um aviso quando <strong>{productName}</strong> voltar ao estoque.
            </p>
            <Input
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubscribe()}
            />
            <Button
              className="w-full"
              style={{ backgroundColor: primaryColor, color: "#fff" }}
              onClick={handleSubscribe}
              disabled={loading}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Bell className="h-4 w-4 mr-2" />}
              Quero ser avisado
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
