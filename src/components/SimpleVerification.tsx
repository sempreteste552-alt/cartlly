import { useState, useEffect, useCallback } from "react";
import { Lock, CheckCircle2, ShieldCheck, Fingerprint, RefreshCw } from "lucide-react";

interface SimpleVerificationProps {
  onVerify: (isValid: boolean) => void;
  className?: string;
}

const TRUST_PHRASES = [
  "Seus dados são protegidos com criptografia de ponta a ponta",
  "Ambiente 100% seguro e verificado",
  "Proteção avançada contra acessos não autorizados",
  "Seus dados pessoais nunca são compartilhados",
  "Conexão segura com certificado SSL ativo",
  "Sistema monitorado 24h contra fraudes",
];

const EMOJI_SETS = [
  { label: "gato", items: ["🐱", "🐶", "🐰", "🐻", "🦊", "🐼"] },
  { label: "carro", items: ["🚗", "🚀", "✈️", "🚢", "🚲", "🏍️"] },
  { label: "estrela", items: ["⭐", "🌙", "☀️", "🌈", "⚡", "❄️"] },
  { label: "pizza", items: ["🍕", "🍔", "🍩", "🍎", "🍰", "🌮"] },
  { label: "coração", items: ["❤️", "💎", "🔥", "💧", "🌸", "🍀"] },
  { label: "bola", items: ["⚽", "🏀", "🎾", "🎱", "🏐", "🎳"] },
  { label: "casa", items: ["🏠", "🏰", "⛪", "🏢", "🗼", "🌉"] },
  { label: "sol", items: ["☀️", "🌙", "⭐", "🌧️", "🌪️", "🌊"] },
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function SimpleVerification({ onVerify, className = "" }: SimpleVerificationProps) {
  const [targetEmoji, setTargetEmoji] = useState("");
  const [targetLabel, setTargetLabel] = useState("");
  const [grid, setGrid] = useState<{ emoji: string; isTarget: boolean }[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState(false);
  const [trustPhrase, setTrustPhrase] = useState("");
  const [targetCount, setTargetCount] = useState(0);

  const generateChallenge = useCallback(() => {
    const set = EMOJI_SETS[Math.floor(Math.random() * EMOJI_SETS.length)];
    const target = set.items[0];
    const distractors = set.items.slice(1);

    // Place 2-3 targets among 9 cells
    const count = Math.floor(Math.random() * 2) + 2; // 2 or 3
    const cells: { emoji: string; isTarget: boolean }[] = [];

    for (let i = 0; i < count; i++) {
      cells.push({ emoji: target, isTarget: true });
    }
    for (let i = 0; i < 9 - count; i++) {
      cells.push({ emoji: distractors[i % distractors.length], isTarget: false });
    }

    setTargetEmoji(target);
    setTargetLabel(set.label);
    setGrid(shuffle(cells));
    setSelected(new Set());
    setVerified(false);
    setError(false);
    setTargetCount(count);
    onVerify(false);
    setTrustPhrase(TRUST_PHRASES[Math.floor(Math.random() * TRUST_PHRASES.length)]);
  }, [onVerify]);

  useEffect(() => {
    generateChallenge();
  }, []);

  const handleSelect = (index: number) => {
    if (verified) return;
    const next = new Set(selected);
    if (next.has(index)) {
      next.delete(index);
    } else {
      next.add(index);
    }
    setSelected(next);
    setError(false);

    // Check if user selected exactly the right ones
    if (next.size === targetCount) {
      const allCorrect = Array.from(next).every((i) => grid[i]?.isTarget);
      if (allCorrect) {
        setVerified(true);
        onVerify(true);
      } else {
        setError(true);
        onVerify(false);
        // Reset after a short delay
        setTimeout(() => {
          setSelected(new Set());
          setError(false);
        }, 1200);
      }
    }
  };

  return (
    <div className={`w-full space-y-3 ${className}`}>
      {/* Trust badge */}
      <div className="flex items-center gap-2 justify-center text-xs text-muted-foreground">
        <Lock className="h-3.5 w-3.5 text-green-600" />
        <span>{trustPhrase}</span>
      </div>

      {/* Verification card */}
      <div className={`relative overflow-hidden rounded-xl border-2 transition-all duration-500 ${
        verified
          ? "border-green-500/60 bg-green-500/5 shadow-sm shadow-green-500/10"
          : error
            ? "border-destructive/40 bg-destructive/5"
            : "border-border bg-muted/20"
      }`}>
        {/* Header */}
        <div className={`flex items-center gap-2.5 px-4 py-2.5 border-b transition-colors duration-500 ${
          verified
            ? "bg-green-500/10 border-green-500/20"
            : "bg-muted/30 border-border/50"
        }`}>
          <div className={`flex items-center justify-center w-7 h-7 rounded-full transition-colors duration-500 ${
            verified
              ? "bg-green-500/20 text-green-600"
              : "bg-primary/10 text-primary"
          }`}>
            {verified ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <Fingerprint className="h-4 w-4" />
            )}
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground leading-tight">
              {verified ? "Identidade Verificada" : "Verificação de Identidade"}
            </p>
            <p className="text-[10px] text-muted-foreground leading-tight">
              {verified
                ? "Acesso autorizado com sucesso"
                : `Selecione todos os ${targetEmoji} (${targetLabel})`}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {!verified && (
              <button
                type="button"
                onClick={generateChallenge}
                className="p-1 rounded-md hover:bg-muted transition-colors"
                title="Gerar novo desafio"
              >
                <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
            <ShieldCheck className={`h-5 w-5 transition-colors duration-500 ${
              verified ? "text-green-500" : "text-muted-foreground/50"
            }`} />
          </div>
        </div>

        {/* Grid body */}
        <div className="px-4 py-3">
          {verified ? (
            <div className="flex items-center gap-2 text-green-600 py-1">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-sm font-medium">Verificação concluída com sucesso</span>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 w-fit mx-auto">
              {grid.map((cell, i) => {
                const isSelected = selected.has(i);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleSelect(i)}
                    className={`w-14 h-14 sm:w-16 sm:h-16 rounded-xl text-2xl flex items-center justify-center border-2 transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer select-none ${
                      isSelected
                        ? error
                          ? "border-destructive bg-destructive/10 scale-95"
                          : "border-primary bg-primary/10 ring-2 ring-primary/30"
                        : "border-border bg-background hover:border-primary/40 hover:bg-muted/50"
                    }`}
                  >
                    {cell.emoji}
                  </button>
                );
              })}
            </div>
          )}
          {error && (
            <p className="text-[11px] text-destructive font-medium mt-2 text-center animate-pulse">
              Seleção incorreta. Tente novamente.
            </p>
          )}
        </div>
      </div>

      {/* Bottom trust indicators */}
      <div className="flex items-center justify-center gap-4 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <Lock className="h-3 w-3 text-green-600" />
          SSL Ativo
        </span>
        <span className="flex items-center gap-1">
          <ShieldCheck className="h-3 w-3 text-green-600" />
          Anti-Fraude
        </span>
        <span className="flex items-center gap-1">
          <Fingerprint className="h-3 w-3 text-green-600" />
          Verificado
        </span>
      </div>
    </div>
  );
}
