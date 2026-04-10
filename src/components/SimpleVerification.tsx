import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { ShieldCheck, Lock, CheckCircle2, Fingerprint } from "lucide-react";

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

export function SimpleVerification({ onVerify, className = "" }: SimpleVerificationProps) {
  const [num1, setNum1] = useState(0);
  const [num2, setNum2] = useState(0);
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState(false);
  const [verified, setVerified] = useState(false);
  const [trustPhrase, setTrustPhrase] = useState("");

  const generateChallenge = useCallback(() => {
    const n1 = Math.floor(Math.random() * 10) + 1;
    const n2 = Math.floor(Math.random() * 10) + 1;
    setNum1(n1);
    setNum2(n2);
    setAnswer("");
    setVerified(false);
    setError(false);
    onVerify(false);
    setTrustPhrase(TRUST_PHRASES[Math.floor(Math.random() * TRUST_PHRASES.length)]);
  }, [onVerify]);

  useEffect(() => {
    generateChallenge();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setAnswer(val);
    const isCorrect = parseInt(val) === num1 + num2;
    onVerify(isCorrect);
    setVerified(isCorrect);
    setError(val.length > 0 && !isCorrect);
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
          <div>
            <p className="text-sm font-semibold text-foreground leading-tight">
              {verified ? "Identidade Verificada" : "Verificação de Identidade"}
            </p>
            <p className="text-[10px] text-muted-foreground leading-tight">
              {verified ? "Acesso autorizado com sucesso" : "Confirme que você é humano"}
            </p>
          </div>
          <ShieldCheck className={`h-5 w-5 ml-auto transition-colors duration-500 ${
            verified ? "text-green-500" : "text-muted-foreground/50"
          }`} />
        </div>

        {/* Challenge body */}
        <div className="px-4 py-3">
          {verified ? (
            <div className="flex items-center gap-2 text-green-600 py-1">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-sm font-medium">Verificação concluída com sucesso</span>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-foreground whitespace-nowrap">
                Quanto é <span className="font-bold text-primary">{num1} + {num2}</span> ?
              </span>
              <Input
                type="number"
                value={answer}
                onChange={handleChange}
                placeholder="Resposta"
                className={`h-9 w-24 text-center font-semibold ${
                  error ? "border-destructive focus-visible:ring-destructive" : ""
                }`}
              />
            </div>
          )}
          {error && (
            <p className="text-[11px] text-destructive font-medium mt-1.5 animate-pulse">
              Resposta incorreta. Tente novamente.
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
