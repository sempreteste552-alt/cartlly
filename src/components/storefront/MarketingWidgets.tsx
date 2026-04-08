import { useState, useEffect } from "react";
import { X, Timer } from "lucide-react";
import type { StoreMarketingConfig } from "@/hooks/useStoreMarketingConfig";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";

// ── Countdown Bar ──
export function CountdownBar({ config }: { config: StoreMarketingConfig }) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (!config.countdown_enabled || !config.countdown_end_date) return;
    const target = new Date(config.countdown_end_date).getTime();
    const tick = () => {
      const diff = target - Date.now();
      if (diff <= 0) { setExpired(true); return; }
      setTimeLeft({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [config.countdown_enabled, config.countdown_end_date]);

  if (!config.countdown_enabled || !config.countdown_end_date || expired) return null;

  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div
      className="relative py-2.5 px-4 text-center animate-pulse"
      style={{ backgroundColor: config.countdown_bg_color, color: config.countdown_text_color }}
    >
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4">
        <div className="flex items-center gap-2">
          <Timer className="h-4 w-4 animate-spin" style={{ animationDuration: "3s" }} />
          {config.countdown_text && (
            <span className="text-sm font-semibold">{config.countdown_text}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 font-mono text-sm font-bold tracking-wider">
          <span className="bg-white/20 backdrop-blur rounded px-1.5 py-0.5">{pad(timeLeft.days)}d</span>
          <span>:</span>
          <span className="bg-white/20 backdrop-blur rounded px-1.5 py-0.5">{pad(timeLeft.hours)}h</span>
          <span>:</span>
          <span className="bg-white/20 backdrop-blur rounded px-1.5 py-0.5">{pad(timeLeft.minutes)}m</span>
          <span>:</span>
          <span className="bg-white/20 backdrop-blur rounded px-1.5 py-0.5">{pad(timeLeft.seconds)}s</span>
        </div>
      </div>
    </div>
  );
}

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
