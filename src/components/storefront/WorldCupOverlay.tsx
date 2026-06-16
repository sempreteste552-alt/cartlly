/**
 * WorldCupOverlay
 *
 * Tema festivo da Copa do Mundo aplicado em todas as lojas.
 * Para desativar quando a Copa terminar, basta trocar
 * `WORLD_CUP_ACTIVE` para `false` (ou apagar a importação no LojaLayout).
 *
 * Visual profissional: bolas flutuantes sutis nos cantos + faixa de cores
 * discreta no topo. Não interfere com cliques nem com o conteúdo da loja.
 */
import { useMemo } from "react";

export const WORLD_CUP_ACTIVE = true;

const FLOATING_BALLS = [
  { left: "4%", top: "12%", size: 38, delay: "0s", duration: "9s", opacity: 0.18 },
  { left: "92%", top: "22%", size: 28, delay: "1.4s", duration: "11s", opacity: 0.14 },
  { left: "8%", top: "78%", size: 32, delay: "2.8s", duration: "10s", opacity: 0.16 },
  { left: "88%", top: "82%", size: 44, delay: "0.6s", duration: "12s", opacity: 0.15 },
];

const SoccerBall = ({ size }: { size: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 64 64"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <defs>
      <radialGradient id="ballShade" cx="35%" cy="30%" r="75%">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="70%" stopColor="#f4f4f5" />
        <stop offset="100%" stopColor="#a1a1aa" />
      </radialGradient>
    </defs>
    <circle cx="32" cy="32" r="30" fill="url(#ballShade)" stroke="#18181b" strokeWidth="1.5" />
    <polygon points="32,18 40,24 37,33 27,33 24,24" fill="#18181b" />
    <polygon points="32,18 24,24 14,22 16,14 26,12" fill="none" stroke="#18181b" strokeWidth="1.2" />
    <polygon points="32,18 40,24 50,22 48,14 38,12" fill="none" stroke="#18181b" strokeWidth="1.2" />
    <polygon points="27,33 24,24 14,22 10,32 18,40" fill="none" stroke="#18181b" strokeWidth="1.2" />
    <polygon points="37,33 40,24 50,22 54,32 46,40" fill="none" stroke="#18181b" strokeWidth="1.2" />
    <polygon points="27,33 37,33 46,40 32,48 18,40" fill="none" stroke="#18181b" strokeWidth="1.2" />
  </svg>
);

export function WorldCupOverlay() {
  if (!WORLD_CUP_ACTIVE) return null;

  const balls = useMemo(() => FLOATING_BALLS, []);

  return (
    <>
      <style>{`
        @keyframes wc-float {
          0%,100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-18px) rotate(180deg); }
        }
        @keyframes wc-shine {
          0% { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }
        .wc-strip {
          background: linear-gradient(
            90deg,
            #009739 0%, #009739 20%,
            #ffcd00 20%, #ffcd00 40%,
            #ffffff 40%, #ffffff 60%,
            #002776 60%, #002776 80%,
            #c8102e 80%, #c8102e 100%
          );
          background-size: 200% 100%;
          animation: wc-shine 18s linear infinite;
        }
      `}</style>

      {/* Faixa fina de cores no topo (não bloqueia nada, fica acima de banners) */}
      <div
        aria-hidden="true"
        className="wc-strip fixed top-0 left-0 right-0 h-[3px] z-[60] pointer-events-none opacity-80"
      />

      {/* Bolas flutuantes nos cantos */}
      <div
        aria-hidden="true"
        className="fixed inset-0 pointer-events-none z-[5] overflow-hidden hidden sm:block"
      >
        {balls.map((b, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: b.left,
              top: b.top,
              opacity: b.opacity,
              animation: `wc-float ${b.duration} ease-in-out ${b.delay} infinite`,
              filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.18))",
            }}
          >
            <SoccerBall size={b.size} />
          </div>
        ))}
      </div>
    </>
  );
}
