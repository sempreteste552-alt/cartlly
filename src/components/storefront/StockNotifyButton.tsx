import { useState } from "react";
import { Bell, BellRing, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTranslation } from "@/i18n";

interface StockNotifyButtonProps {
  productId: string;
  productName: string;
  storeUserId: string;
  primaryColor?: string;
}

export function StockNotifyButton({ productId, productName, storeUserId, primaryColor = "#6d28d9" }: StockNotifyButtonProps) {
  const { t, locale } = useTranslation();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  const uiText = {
    pt: {
      invalidEmail: "Informe um e-mail válido",
      alreadySubscribed: "Você já está inscrito para este produto!",
      success: "Você será avisado quando voltar ao estoque!",
      error: "Erro ao se inscrever. Tente novamente.",
      subscribed: "Você será notificado quando voltar ao estoque!",
      button: "Avise-me quando voltar ao estoque",
      title: "Alerta de Estoque",
      description: "Informe seu e-mail para receber um aviso quando",
      submit: "Quero ser avisado",
    },
    en: {
      invalidEmail: "Enter a valid email",
      alreadySubscribed: "You are already subscribed for this product!",
      success: "We will notify you when it is back in stock!",
      error: "Subscription failed. Please try again.",
      subscribed: "You will be notified when it is back in stock!",
      button: "Notify me when it is back",
      title: "Stock Alert",
      description: "Enter your email to receive a notice when",
      submit: "Notify me",
    },
    es: {
      invalidEmail: "Ingresa un correo válido",
      alreadySubscribed: "¡Ya estás suscrito para este producto!",
      success: "¡Te avisaremos cuando vuelva al stock!",
      error: "Error al suscribirte. Inténtalo de nuevo.",
      subscribed: "¡Recibirás una notificación cuando vuelva al stock!",
      button: "Avísame cuando vuelva",
      title: "Alerta de stock",
      description: "Ingresa tu correo para recibir un aviso cuando",
      submit: "Quiero que me avisen",
    },
    fr: {
      invalidEmail: "Saisissez un e-mail valide",
      alreadySubscribed: "Vous êtes déjà inscrit pour ce produit !",
      success: "Nous vous préviendrons à son retour en stock !",
      error: "Erreur lors de l'inscription. Réessayez.",
      subscribed: "Vous serez averti à son retour en stock !",
      button: "Prévenez-moi du retour",
      title: "Alerte stock",
      description: "Saisissez votre e-mail pour être averti quand",
      submit: "Être averti",
    },
  }[locale];

  const handleSubscribe = async () => {
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error(uiText.invalidEmail);
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
          toast.info(uiText.alreadySubscribed);
          setSubscribed(true);
          setOpen(false);
          return;
        }
        throw error;
      }

      toast.success(uiText.success);
      setSubscribed(true);
      setOpen(false);
    } catch (err) {
      toast.error(uiText.error);
    } finally {
      setLoading(false);
    }
  };

  if (subscribed) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-lg border text-sm" style={{ borderColor: `${primaryColor}40`, color: primaryColor, backgroundColor: `${primaryColor}08` }}>
        <BellRing className="h-4 w-4 shrink-0" />
        <span>{uiText.subscribed}</span>
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
        {uiText.button}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" style={{ color: primaryColor }} />
              {uiText.title}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {uiText.description} <strong>{productName}</strong> {locale === "pt" ? "voltar ao estoque." : locale === "en" ? "is back in stock." : locale === "es" ? "vuelva al stock." : "sera de retour en stock."}
            </p>
            <Input
              type="email"
              placeholder={t.auth.emailPlaceholder}
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
              {uiText.submit}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
