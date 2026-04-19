import { useMemo, useState } from "react";
import { Wifi } from "lucide-react";

interface VirtualCardProps {
  number: string;
  name: string;
  expiry: string;
  cvv: string;
  flipped?: boolean;
}

function detectBrand(number: string): { name: string; gradient: string } {
  const n = number.replace(/\s/g, "");
  if (/^4/.test(n)) return { name: "VISA", gradient: "from-blue-700 via-blue-600 to-indigo-800" };
  if (/^(5[1-5]|2[2-7])/.test(n)) return { name: "MASTERCARD", gradient: "from-red-700 via-orange-600 to-yellow-600" };
  if (/^3[47]/.test(n)) return { name: "AMEX", gradient: "from-emerald-700 via-emerald-600 to-teal-700" };
  if (/^(606282|3841)/.test(n)) return { name: "HIPERCARD", gradient: "from-rose-700 via-red-600 to-rose-800" };
  if (/^(4011|4312|4389|4514|4573|5041|5066|5067|509|6277|6362|6363|6504|6509|6516|6550)/.test(n)) {
    return { name: "ELO", gradient: "from-zinc-800 via-zinc-700 to-zinc-900" };
  }
  return { name: "CARTÃO", gradient: "from-slate-800 via-slate-700 to-slate-900" };
}

export function VirtualCard({ number, name, expiry, cvv, flipped }: VirtualCardProps) {
  const brand = useMemo(() => detectBrand(number), [number]);
  const display = (number || "").padEnd(19, "•").slice(0, 19);
  const groups = display.match(/.{1,4}/g) || [];

  return (
    <div className="w-full max-w-[380px] mx-auto perspective-1000">
      <div
        className={`relative w-full aspect-[1.586/1] transition-transform duration-700 transform-style-3d ${flipped ? "[transform:rotateY(180deg)]" : ""}`}
        style={{ transformStyle: "preserve-3d" }}
      >
        {/* FRENTE */}
        <div
          className={`absolute inset-0 rounded-2xl p-5 text-white shadow-2xl bg-gradient-to-br ${brand.gradient} backface-hidden flex flex-col justify-between overflow-hidden`}
          style={{ backfaceVisibility: "hidden" }}
        >
          {/* shine */}
          <div className="absolute -top-12 -right-12 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-16 -left-10 w-56 h-56 bg-black/30 rounded-full blur-3xl pointer-events-none" />

          <div className="flex items-start justify-between relative z-10">
            <div className="flex flex-col gap-1">
              <div className="w-10 h-7 rounded-md bg-gradient-to-br from-yellow-300 to-yellow-500 shadow-inner border border-yellow-600/40" />
              <Wifi className="h-4 w-4 rotate-90 text-white/80" />
            </div>
            <span className="text-sm font-bold tracking-wider drop-shadow">{brand.name}</span>
          </div>

          <div className="relative z-10 font-mono text-lg sm:text-xl tracking-[0.18em] drop-shadow-md flex gap-2">
            {groups.map((g, i) => (
              <span key={i}>{g}</span>
            ))}
          </div>

          <div className="flex items-end justify-between relative z-10 text-[10px] uppercase tracking-widest">
            <div className="min-w-0 flex-1 mr-3">
              <div className="opacity-70">Titular</div>
              <div className="font-semibold text-sm tracking-wide truncate">{name || "SEU NOME AQUI"}</div>
            </div>
            <div className="text-right">
              <div className="opacity-70">Validade</div>
              <div className="font-semibold text-sm tracking-wide font-mono">{expiry || "MM/AA"}</div>
            </div>
          </div>
        </div>

        {/* VERSO */}
        <div
          className={`absolute inset-0 rounded-2xl text-white shadow-2xl bg-gradient-to-br ${brand.gradient} overflow-hidden`}
          style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
        >
          <div className="h-10 bg-black/80 mt-5" />
          <div className="px-5 mt-4">
            <div className="bg-white/90 text-black rounded-md h-9 flex items-center px-3 font-mono tracking-widest text-sm">
              <span className="flex-1 text-right opacity-50">••••••••</span>
              <span className="ml-3 font-bold">{cvv || "CVV"}</span>
            </div>
            <p className="text-[10px] opacity-70 mt-2 text-right">Código de segurança (3 ou 4 dígitos)</p>
          </div>
        </div>
      </div>
    </div>
  );
}
