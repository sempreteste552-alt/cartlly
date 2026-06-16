/**
 * WorldCupOverlay
 *
 * Tema festivo da Copa do Mundo aplicado em todas as lojas quando
 * o flag `world_cup_mode_enabled` estiver ligado no Super Admin.
 *
 * - Não bloqueia rolagem (todos os elementos usam pointer-events: none,
 *   exceto o badge que pode ser fechado).
 * - Renderiza apenas em telas grandes para não pesar mobile.
 */
import { useMemo, useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const FLOATING_BALLS = [
  { left: "3%", top: "14%", size: 54, delay: "0s", duration: "11s", opacity: 0.45 },
  { left: "93%", top: "20%", size: 42, delay: "1.4s", duration: "13s", opacity: 0.4 },
  { left: "6%", top: "72%", size: 48, delay: "2.8s", duration: "12s", opacity: 0.42 },
  { left: "90%", top: "78%", size: 60, delay: "0.6s", duration: "14s", opacity: 0.44 },
  { left: "50%", top: "8%", size: 32, delay: "3.2s", duration: "15s", opacity: 0.3 },
];

const CONFETTI_COLORS = ["#009739", "#ffcd00", "#002776", "#c8102e", "#ffffff"];

const SoccerBall = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs>
      <radialGradient id={`bs-${size}`} cx="35%" cy="30%" r="75%">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="70%" stopColor="#f4f4f5" />
        <stop offset="100%" stopColor="#71717a" />
      </radialGradient>
    </defs>
    <circle cx="32" cy="32" r="30" fill={`url(#bs-${size})`} stroke="#0a0a0a" strokeWidth="1.8" />
    <polygon points="32,18 40,24 37,33 27,33 24,24" fill="#0a0a0a" />
    <polygon points="32,18 24,24 14,22 16,14 26,12" fill="none" stroke="#0a0a0a" strokeWidth="1.3" />
    <polygon points="32,18 40,24 50,22 48,14 38,12" fill="none" stroke="#0a0a0a" strokeWidth="1.3" />
    <polygon points="27,33 24,24 14,22 10,32 18,40" fill="none" stroke="#0a0a0a" strokeWidth="1.3" />
    <polygon points="37,33 40,24 50,22 54,32 46,40" fill="none" stroke="#0a0a0a" strokeWidth="1.3" />
    <polygon points="27,33 37,33 46,40 32,48 18,40" fill="none" stroke="#0a0a0a" strokeWidth="1.3" />
  </svg>
);

export function WorldCupOverlay() {
  const [enabled, setEnabled] = useState(false);
  const [showBadge, setShowBadge] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from("platform_banner_config_public")
          .select("key, value")
          .eq("key", "world_cup_mode_enabled")
          .maybeSingle();
        if (cancelled) return;
        const v = (data?.value as any)?.value;
        setEnabled(v === true || v === "true");
      } catch {
        if (!cancelled) setEnabled(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const balls = useMemo(() => FLOATING_BALLS, []);
  const confetti = useMemo(
    () =>
      Array.from({ length: 14 }).map((_, i) => ({
        left: `${(i * 7.3) % 100}%`,
        delay: `${(i * 0.7) % 8}s`,
        duration: `${8 + (i % 5)}s`,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        size: 6 + (i % 3) * 2,
      })),
    []
  );

  if (!enabled) return null;

  return (
    <>
      <style>{`
        @keyframes wc-float { 0%,100% { transform: translateY(0) rotate(0deg);} 50% { transform: translateY(-22px) rotate(180deg);} }
        @keyframes wc-shine { 0% { background-position: 0% 50%;} 100% { background-position: 200% 50%;} }
        @keyframes wc-confetti { 0% { transform: translateY(-20px) rotate(0deg); opacity: 0;} 10% { opacity: .85;} 90% { opacity: .85;} 100% { transform: translateY(110vh) rotate(720deg); opacity: 0;} }
        @keyframes wc-badge-in { from { transform: translateY(-10px) scale(.9); opacity: 0;} to { transform: translateY(0) scale(1); opacity: 1;} }
        @keyframes wc-pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(255,205,0,.55);} 50% { box-shadow: 0 0 0 10px rgba(255,205,0,0);} }
        .wc-strip { background: linear-gradient(90deg,#009739 0%,#009739 20%,#ffcd00 20%,#ffcd00 40%,#ffffff 40%,#ffffff 60%,#002776 60%,#002776 80%,#c8102e 80%,#c8102e 100%); background-size: 200% 100%; animation: wc-shine 14s linear infinite; }
        .wc-badge { background: linear-gradient(135deg,#009739 0%,#00b347 50%,#ffcd00 100%); animation: wc-badge-in .6s ease-out, wc-pulse 2.6s ease-in-out infinite .6s; }
        .wc-confetti-piece { position: absolute; top: -20px; border-radius: 2px; }
      `}</style>

      <div aria-hidden="true" className="wc-strip fixed top-0 left-0 right-0 h-[5px] z-[60] pointer-events-none" />

      {showBadge && (
        <button
          onClick={() => setShowBadge(false)}
          aria-label="Tema Copa do Mundo - clique para fechar"
          className="wc-badge fixed top-3 right-3 sm:top-4 sm:right-4 z-[61] flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white text-xs font-bold shadow-lg backdrop-blur-sm border border-white/20 hover:scale-105 transition-transform"
          style={{ fontFamily: "system-ui, sans-serif", letterSpacing: "0.04em" }}
        >
          <span className="text-base leading-none">⚽</span>
          <span>COPA 2026</span>
          <span className="ml-1 text-white/70 hover:text-white text-[10px]">✕</span>
        </button>
      )}

      <div aria-hidden="true" className="fixed inset-0 pointer-events-none z-[5] overflow-hidden hidden md:block">
        {balls.map((b, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: b.left,
              top: b.top,
              opacity: b.opacity,
              animation: `wc-float ${b.duration} ease-in-out ${b.delay} infinite`,
              filter: "drop-shadow(0 6px 14px rgba(0,0,0,0.25))",
            }}
          >
            <SoccerBall size={b.size} />
          </div>
        ))}
      </div>

      <div aria-hidden="true" className="fixed inset-0 pointer-events-none z-[4] overflow-hidden hidden lg:block">
        {confetti.map((c, i) => (
          <span
            key={i}
            className="wc-confetti-piece"
            style={{
              left: c.left,
              width: c.size,
              height: c.size * 1.6,
              background: c.color,
              animation: `wc-confetti ${c.duration} linear ${c.delay} infinite`,
            }}
          />
        ))}
      </div>
    </>
  );
}
