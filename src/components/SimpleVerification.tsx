import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck } from "lucide-react";

interface SimpleVerificationProps {
  onVerify: (isValid: boolean) => void;
  className?: string;
}

export function SimpleVerification({ onVerify, className = "" }: SimpleVerificationProps) {
  const [num1, setNum1] = useState(0);
  const [num2, setNum2] = useState(0);
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState(false);

  const generateChallenge = () => {
    const n1 = Math.floor(Math.random() * 10) + 1;
    const n2 = Math.floor(Math.random() * 10) + 1;
    setNum1(n1);
    setNum2(n2);
    setAnswer("");
    onVerify(false);
  };

  useEffect(() => {
    generateChallenge();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setAnswer(val);
    const isCorrect = parseInt(val) === num1 + num2;
    onVerify(isCorrect);
    setError(val.length > 0 && !isCorrect);
  };

  return (
    <div className={`space-y-2 p-3 border rounded-lg bg-muted/30 ${className}`}>
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-1">
        <ShieldCheck className="h-4 w-4" />
        <span>Verificação de Segurança</span>
      </div>
      <div className="flex items-center gap-3">
        <Label className="text-sm whitespace-nowrap">Quanto é {num1} + {num2}?</Label>
        <Input
          type="number"
          value={answer}
          onChange={handleChange}
          placeholder="?"
          className={`h-8 w-20 ${error ? "border-destructive focus-visible:ring-destructive" : ""}`}
        />
      </div>
      {error && (
        <p className="text-[10px] text-destructive font-medium animate-pulse">
          Resposta incorreta, tente novamente.
        </p>
      )}
    </div>
  );
}
