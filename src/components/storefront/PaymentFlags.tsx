import React from "react";
import { cn } from "@/lib/utils";

interface PaymentFlagsProps {
  acceptedMethods?: string[];
  className?: string;
}

const PAYMENT_METHODS_DATA: Record<string, { label: string; icon: string }> = {
  visa: {
    label: "Visa",
    icon: "https://upload.wikimedia.org/wikipedia/commons/5/5e/Visa_Inc._logo.svg",
  },
  mastercard: {
    label: "Mastercard",
    icon: "https://upload.wikimedia.org/wikipedia/commons/2/2a/Mastercard-logo.svg",
  },
  elo: {
    label: "Elo",
    icon: "https://upload.wikimedia.org/wikipedia/commons/b/b0/Elo_logo.svg",
  },
  amex: {
    label: "American Express",
    icon: "https://upload.wikimedia.org/wikipedia/commons/f/fa/American_Express_logo_%282018%29.svg",
  },
  hipercard: {
    label: "Hipercard",
    icon: "https://upload.wikimedia.org/wikipedia/commons/b/ba/Hipercard_logo.svg",
  },
  pix: {
    label: "PIX",
    icon: "https://upload.wikimedia.org/wikipedia/commons/a/a2/Logo_Pix.svg",
  },
  boleto: {
    label: "Boleto",
    icon: "https://upload.wikimedia.org/wikipedia/commons/c/c7/BoletoBancario.svg",
  },
  diners: {
    label: "Diners Club",
    icon: "https://upload.wikimedia.org/wikipedia/commons/a/a6/Diners_Club_Logo3.svg",
  },
  discover: {
    label: "Discover",
    icon: "https://upload.wikimedia.org/wikipedia/commons/5/57/Discover_Card_logo.svg",
  },
};

export const PaymentFlags: React.FC<PaymentFlagsProps> = ({ 
  acceptedMethods = ["visa", "mastercard", "elo", "amex", "hipercard", "pix", "boleto"], 
  className 
}) => {
  if (!acceptedMethods || acceptedMethods.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap items-center justify-center gap-3", className)}>
      {acceptedMethods.map((method) => {
        const data = PAYMENT_METHODS_DATA[method.toLowerCase()];
        if (!data) return null;
        
        return (
          <div 
            key={method} 
            className="bg-white rounded p-1 flex items-center justify-center w-10 h-6 border border-gray-200 shadow-sm"
            title={data.label}
          >
            <img 
              src={data.icon} 
              alt={data.label} 
              className="max-w-full max-h-full object-contain"
            />
          </div>
        );
      })}
    </div>
  );
};
