import { Wifi, CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";

interface CardTapAnimationProps {
  brand?: string;
  last4?: string;
  /** When true, animation completes and POS shows APPROVED. */
  approved?: boolean;
}

/**
 * One-shot "card tap to POS terminal" animation.
 * Card slides in from the left, lands on the POS and STAYS attached.
 * After ~1.6s the POS screen flips to APROVADO automatically (or when `approved` prop becomes true).
 */
export function CardTapAnimation({ brand, last4, approved = false }: CardTapAnimationProps) {
  const [showApproved, setShowApproved] = useState(false);

  useEffect(() => {
    // Auto-flip POS to "APROVADO" once the card has landed.
    const t = setTimeout(() => setShowApproved(true), 1700);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (approved) setShowApproved(true);
  }, [approved]);

  return (
    <div className="relative w-full max-w-[320px] mx-auto h-[220px] flex items-center justify-center select-none">
      {/* NFC ripples coming from POS */}
      <div className="absolute left-1/2 top-1/2 -translate-x-[10%] -translate-y-1/2 pointer-events-none">
        <span className="card-tap-ripple" style={{ animationDelay: "0s" }} />
        <span className="card-tap-ripple" style={{ animationDelay: "0.6s" }} />
        <span className="card-tap-ripple" style={{ animationDelay: "1.2s" }} />
      </div>

      {/* POS Terminal (right) */}
      <div className="absolute right-2 top-1/2 -translate-y-1/2 z-10">
        <div className="card-tap-pos">
          <div className="card-tap-pos-screen">
            {showApproved ? (
              <div className="flex flex-col items-center gap-1 animate-in fade-in zoom-in duration-300">
                <CheckCircle2 className="h-7 w-7 text-emerald-400" />
                <span className="text-[9px] font-bold text-emerald-300 tracking-wider">APROVADO</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1.5">
                <Wifi className="h-6 w-6 text-emerald-400 -rotate-90 animate-pulse" />
                <span className="text-[8px] font-semibold text-emerald-300/90 tracking-wider">
                  APROXIMAR
                </span>
              </div>
            )}
          </div>
          <div className="grid grid-cols-3 gap-1 mt-2 px-2">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="card-tap-pos-key" />
            ))}
          </div>
          <div className="card-tap-pos-base" />
        </div>
      </div>

      {/* Card slides in once and stays */}
      <div className="card-tap-card">
        <div className="card-tap-card-chip" />
        <Wifi className="absolute top-3 right-3 h-3.5 w-3.5 text-white/80 -rotate-90" />
        <div className="absolute bottom-2.5 left-3 right-3 flex items-end justify-between">
          <span className="text-[8px] font-mono tracking-widest text-white/90">
            •••• {last4 || "1234"}
          </span>
          <span className="text-[9px] font-black uppercase italic text-white/95 tracking-wider">
            {brand || "BANK"}
          </span>
        </div>
      </div>
    </div>
  );
}
