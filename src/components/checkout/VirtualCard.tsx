import { useMemo } from "react";
import { Wifi } from "lucide-react";

interface VirtualCardProps {
  number: string;
  name: string;
  expiry: string;
  cvv: string;
  flipped?: boolean;
}

interface CardStyle {
  bank: string;
  brand: string;
  gradient: string;
  textColor: string;
  accentColor: string;
}

// Detecta banco emissor + tier (black/platinum/gold) pelo BIN brasileiro
function detectBankByBin(bin: string): Partial<CardStyle> | null {
  // NUBANK - roxo característico
  if (/^(401178|401179|438935|451416|457631|457632|504175|627780|636297|636368|650487|650488|655595|655596)/.test(bin)) {
    return { bank: "NUBANK", gradient: "from-purple-900 via-purple-800 to-fuchsia-900", textColor: "text-white", accentColor: "from-fuchsia-400 to-purple-300" };
  }
  if (/^(533559|542530|552692)/.test(bin)) {
    return { bank: "NUBANK ULTRAVIOLETA", gradient: "from-zinc-900 via-purple-950 to-black", textColor: "text-purple-200", accentColor: "from-purple-400 to-fuchsia-500" };
  }
  // ITAÚ - laranja/azul
  if (/^(498409|498410|516292|516293|549035|549036|627892|636206|636207)/.test(bin)) {
    return { bank: "ITAÚ", gradient: "from-orange-600 via-orange-500 to-blue-900", textColor: "text-white", accentColor: "from-yellow-300 to-orange-400" };
  }
  // ITAÚ BLACK
  if (/^(540516|540517|552337|554134)/.test(bin)) {
    return { bank: "ITAÚ BLACK", gradient: "from-zinc-950 via-zinc-900 to-orange-950", textColor: "text-orange-200", accentColor: "from-orange-400 to-amber-500" };
  }
  // BRADESCO - vermelho
  if (/^(438568|448936|453978|516259|548787|552032|636370|627874)/.test(bin)) {
    return { bank: "BRADESCO", gradient: "from-red-700 via-red-600 to-red-900", textColor: "text-white", accentColor: "from-red-300 to-orange-300" };
  }
  // BANCO DO BRASIL - amarelo/azul
  if (/^(438476|453211|461353|490951|503879|516292|548132|552032|627871|636297)/.test(bin)) {
    return { bank: "BANCO DO BRASIL", gradient: "from-yellow-500 via-yellow-400 to-blue-900", textColor: "text-blue-950", accentColor: "from-yellow-200 to-yellow-400" };
  }
  // BB OUROCARD BLACK
  if (/^(556059|552032)/.test(bin)) {
    return { bank: "BB OUROCARD BLACK", gradient: "from-zinc-900 via-stone-900 to-yellow-900", textColor: "text-yellow-200", accentColor: "from-yellow-300 to-amber-500" };
  }
  // SANTANDER - vermelho
  if (/^(411614|438970|448949|451476|452358|460628|516229|529965|540982|548932|552037|552038)/.test(bin)) {
    return { bank: "SANTANDER", gradient: "from-red-600 via-red-500 to-red-800", textColor: "text-white", accentColor: "from-red-200 to-red-400" };
  }
  // CAIXA - azul/laranja
  if (/^(401723|438622|453974|516292|548126|552241|627780|636368)/.test(bin)) {
    return { bank: "CAIXA", gradient: "from-blue-700 via-blue-600 to-orange-600", textColor: "text-white", accentColor: "from-orange-300 to-yellow-400" };
  }
  // INTER - laranja
  if (/^(458247|526438|527620|530988|627892|636297)/.test(bin)) {
    return { bank: "INTER", gradient: "from-orange-500 via-orange-600 to-red-700", textColor: "text-white", accentColor: "from-yellow-300 to-orange-400" };
  }
  // C6 BANK - preto/dourado
  if (/^(467481|516454|529961|535129|542502|552641)/.test(bin)) {
    return { bank: "C6 BANK", gradient: "from-zinc-950 via-zinc-900 to-stone-800", textColor: "text-amber-200", accentColor: "from-amber-300 to-yellow-500" };
  }
  // C6 CARBON
  if (/^(556610|556611|552641)/.test(bin)) {
    return { bank: "C6 CARBON", gradient: "from-black via-zinc-950 to-stone-900", textColor: "text-stone-200", accentColor: "from-stone-300 to-zinc-400" };
  }
  // BTG PACTUAL - preto/azul escuro
  if (/^(516229|552037|627780)/.test(bin)) {
    return { bank: "BTG PACTUAL", gradient: "from-slate-950 via-blue-950 to-black", textColor: "text-blue-200", accentColor: "from-blue-300 to-cyan-400" };
  }
  // XP - preto/amarelo
  if (/^(516229|552037)/.test(bin)) {
    return { bank: "XP", gradient: "from-zinc-900 via-yellow-900 to-black", textColor: "text-yellow-200", accentColor: "from-yellow-300 to-amber-400" };
  }
  // PICPAY - verde
  if (/^(458247|526438|627892)/.test(bin)) {
    return { bank: "PICPAY", gradient: "from-green-600 via-green-500 to-emerald-700", textColor: "text-white", accentColor: "from-lime-300 to-green-400" };
  }
  // MERCADO PAGO - azul
  if (/^(516229|552037|627780)/.test(bin)) {
    return { bank: "MERCADO PAGO", gradient: "from-cyan-500 via-blue-500 to-blue-700", textColor: "text-white", accentColor: "from-cyan-200 to-blue-300" };
  }
  // PAGBANK - amarelo
  if (/^(401723|516292|548126)/.test(bin)) {
    return { bank: "PAGBANK", gradient: "from-yellow-400 via-yellow-500 to-orange-600", textColor: "text-zinc-900", accentColor: "from-yellow-200 to-orange-300" };
  }
  // SAFRA
  if (/^(411614|438970|516229)/.test(bin)) {
    return { bank: "SAFRA", gradient: "from-blue-900 via-indigo-900 to-slate-900", textColor: "text-white", accentColor: "from-blue-300 to-indigo-400" };
  }
  // NEON
  if (/^(467481|516454|627892)/.test(bin)) {
    return { bank: "NEON", gradient: "from-emerald-500 via-teal-500 to-cyan-600", textColor: "text-white", accentColor: "from-emerald-200 to-teal-300" };
  }
  return null;
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

function detectCardStyle(number: string): CardStyle {
  const n = number.replace(/\s/g, "");
  const brand = detectBrand(n);
  const bin = n.slice(0, 6);

  if (bin.length >= 6) {
    const bank = detectBankByBin(bin);
    if (bank) {
      return {
        bank: bank.bank!,
        brand: brand.name,
        gradient: bank.gradient!,
        textColor: bank.textColor!,
        accentColor: bank.accentColor!,
      };
    }
  }

  return {
    bank: "",
    brand: brand.name,
    gradient: brand.gradient,
    textColor: "text-white",
    accentColor: "from-yellow-300 to-yellow-500",
  };
}

export function VirtualCard({ number, name, expiry, cvv, flipped }: VirtualCardProps) {
  const style = useMemo(() => detectCardStyle(number), [number]);
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
          className={`absolute inset-0 rounded-2xl p-5 ${style.textColor} shadow-2xl bg-gradient-to-br ${style.gradient} backface-hidden flex flex-col justify-between overflow-hidden`}
          style={{ backfaceVisibility: "hidden" }}
        >
          {/* shine */}
          <div className="absolute -top-12 -right-12 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-16 -left-10 w-56 h-56 bg-black/30 rounded-full blur-3xl pointer-events-none" />

          <div className="flex items-start justify-between relative z-10">
            <div className="flex flex-col gap-1">
              <div className={`w-10 h-7 rounded-md bg-gradient-to-br ${style.accentColor} shadow-inner border border-black/20`} />
              <Wifi className="h-4 w-4 rotate-90 opacity-80" />
            </div>
            <div className="flex flex-col items-end gap-1">
              {style.bank && (
                <span className="text-[10px] font-bold tracking-widest opacity-90 drop-shadow">{style.bank}</span>
              )}
              <span className="text-sm font-bold tracking-wider drop-shadow">{style.brand}</span>
            </div>
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
          className={`absolute inset-0 rounded-2xl ${style.textColor} shadow-2xl bg-gradient-to-br ${style.gradient} overflow-hidden`}
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
