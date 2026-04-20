import { Wifi, CheckCircle2, XCircle, Loader2 } from "lucide-react";

export type CardTapStatus = "processing" | "approved" | "declined";

interface CardTapAnimationProps {
  brand?: string;
  last4?: string;
  /** Drives what the POS screen shows. */
  status?: CardTapStatus;
  /** Message shown below the POS terminal. */
  message?: string;
}

/**
 * "Card inserted into POS" animation.
 * - Card slides in once and STAYS attached to the terminal.
 * - POS screen reflects `status`: PROCESSANDO → APROVADO ✓ or RECUSADO ✗
 * - A persuasive/error message appears below the terminal.
 */
export function CardTapAnimation({
  brand,
  last4,
  status = "processing",
  message,
}: CardTapAnimationProps) {
  const isApproved = status === "approved";
  const isDeclined = status === "declined";
  const isProcessing = status === "processing";

  return (
    <div className="w-full flex flex-col items-center gap-4 select-none">
      <div className="relative w-full max-w-[320px] mx-auto h-[210px] flex items-center justify-center">
        {/* NFC ripples — only while processing */}
        {isProcessing && (
          <div className="absolute left-1/2 top-1/2 -translate-x-[10%] -translate-y-1/2 pointer-events-none">
            <span className="card-tap-ripple" style={{ animationDelay: "0s" }} />
            <span className="card-tap-ripple" style={{ animationDelay: "0.6s" }} />
            <span className="card-tap-ripple" style={{ animationDelay: "1.2s" }} />
          </div>
        )}

        {/* POS Terminal */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2 z-10">
          <div className="card-tap-pos">
            <div
              className="card-tap-pos-screen"
              style={{
                background: isApproved
                  ? "linear-gradient(180deg, #052e1a, #064a2b)"
                  : isDeclined
                  ? "linear-gradient(180deg, #2a0606, #4a0a0a)"
                  : undefined,
                boxShadow: isDeclined
                  ? "inset 0 0 12px hsl(0 80% 50% / 0.25)"
                  : undefined,
              }}
            >
              {isApproved && (
                <div className="flex flex-col items-center gap-1 animate-in fade-in zoom-in duration-300">
                  <CheckCircle2 className="h-7 w-7 text-emerald-400" />
                  <span className="text-[9px] font-bold text-emerald-300 tracking-wider">
                    APROVADO
                  </span>
                </div>
              )}
              {isDeclined && (
                <div className="flex flex-col items-center gap-1 animate-in fade-in zoom-in duration-300">
                  <XCircle className="h-7 w-7 text-red-400" />
                  <span className="text-[9px] font-bold text-red-300 tracking-wider">
                    RECUSADO
                  </span>
                </div>
              )}
              {isProcessing && (
                <div className="flex flex-col items-center gap-1.5">
                  <Loader2 className="h-6 w-6 text-emerald-400 animate-spin" />
                  <span className="text-[8px] font-semibold text-emerald-300/90 tracking-wider">
                    PROCESSANDO
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

        {/* Card slides in once and stays inserted */}
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

      {/* Status message below the terminal */}
      {message && (
        <div
          className={`w-full max-w-[340px] text-center px-4 py-3 rounded-xl border-2 animate-in fade-in slide-in-from-bottom-2 duration-300 ${
            isApproved
              ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
              : isDeclined
              ? "bg-red-500/10 border-red-500/40 text-red-700 dark:text-red-300"
              : "bg-muted/40 border-border/60 text-muted-foreground"
          }`}
        >
          <p className="text-sm font-bold leading-snug">{message}</p>
        </div>
      )}
    </div>
  );
}
