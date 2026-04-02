import { useState, useEffect } from "react";
import { X } from "lucide-react";
import type { StoreMarketingConfig } from "@/hooks/useStoreMarketingConfig";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";

// ── Announcement Bar ──
export function AnnouncementBar({ config }: { config: StoreMarketingConfig }) {
  const [dismissed, setDismissed] = useState(false);

  if (!config.announcement_bar_enabled || !config.announcement_bar_text || dismissed) return null;

  return (
    <div
      className="relative text-center py-2 px-8 text-sm font-medium"
      style={{ backgroundColor: config.announcement_bar_bg_color, color: config.announcement_bar_text_color }}
    >
      {config.announcement_bar_link ? (
        <a href={config.announcement_bar_link} className="hover:underline">
          {config.announcement_bar_text}
        </a>
      ) : (
        config.announcement_bar_text
      )}
      <button onClick={() => setDismissed(true)} className="absolute right-3 top-1/2 -translate-y-1/2 opacity-60 hover:opacity-100">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ── Free Shipping Bar ──
export function FreeShippingBar({ config, cartTotal }: { config: StoreMarketingConfig; cartTotal: number }) {
  if (!config.free_shipping_bar_enabled || config.free_shipping_threshold <= 0) return null;

  const remaining = Math.max(0, config.free_shipping_threshold - cartTotal);
  const progress = Math.min(100, (cartTotal / config.free_shipping_threshold) * 100);

  const formatPrice = (p: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(p);

  return (
    <div className="max-w-7xl mx-auto px-4 py-2">
      <div className="rounded-full overflow-hidden bg-muted">
        <div className="flex items-center gap-3 px-4 py-1.5">
          <span className="text-xs font-medium shrink-0">
            {remaining > 0
              ? `Faltam ${formatPrice(remaining)} para frete grátis!`
              : "🎉 Frete grátis ativado!"}
          </span>
          <Progress value={progress} className="h-2 flex-1" />
        </div>
      </div>
    </div>
  );
}

// ── Popup Coupon ──
export function PopupCoupon({ config }: { config: StoreMarketingConfig }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!config.popup_coupon_enabled || !config.popup_coupon_code) return;
    const shown = sessionStorage.getItem("popup_coupon_shown");
    if (shown) return;
    const timer = setTimeout(() => {
      setOpen(true);
      sessionStorage.setItem("popup_coupon_shown", "1");
    }, (config.popup_coupon_delay_seconds || 5) * 1000);
    return () => clearTimeout(timer);
  }, [config]);

  if (!config.popup_coupon_enabled || !config.popup_coupon_code) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {config.popup_coupon_title || "🎁 Cupom Especial!"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-center">
          {config.popup_coupon_image_url && (
            <img src={config.popup_coupon_image_url} alt="Promoção" className="w-full h-40 object-cover rounded-lg" />
          )}
          {config.popup_coupon_description && (
            <p className="text-muted-foreground text-sm">{config.popup_coupon_description}</p>
          )}
          <div className="bg-muted rounded-lg py-3 px-4">
            <p className="text-xs text-muted-foreground mb-1">Use o cupom:</p>
            <p className="text-2xl font-bold tracking-widest">{config.popup_coupon_code}</p>
          </div>
          <Button onClick={() => setOpen(false)} className="w-full">
            Aproveitar!
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
