import React from "react";
import { cn } from "@/lib/utils";

interface PaymentFlagsProps {
  acceptedMethods?: string[];
  className?: string;
}

const PAYMENT_METHODS_DATA: Record<string, { label: string; icon: string }> = {
  visa: {
    label: "Visa",
    icon: "https://cdn.jsdelivr.net/gh/fabioluz/pagamento-icons@master/svg/visa.svg",
  },
  mastercard: {
    label: "Mastercard",
    icon: "https://cdn.jsdelivr.net/gh/fabioluz/pagamento-icons@master/svg/mastercard.svg",
  },
  elo: {
    label: "Elo",
    icon: "https://cdn.jsdelivr.net/gh/fabioluz/pagamento-icons@master/svg/elo.svg",
  },
  amex: {
    label: "American Express",
    icon: "https://cdn.jsdelivr.net/gh/fabioluz/pagamento-icons@master/svg/amex.svg",
  },
  hipercard: {
    label: "Hipercard",
    icon: "https://cdn.jsdelivr.net/gh/fabioluz/pagamento-icons@master/svg/hipercard.svg",
  },
  pix: {
    label: "PIX",
    icon: "https://cdn.jsdelivr.net/gh/fabioluz/pagamento-icons@master/svg/pix.svg",
  },
  boleto: {
    label: "Boleto",
    icon: "https://cdn.jsdelivr.net/gh/fabioluz/pagamento-icons@master/svg/boleto.svg",
  },
  diners: {
    label: "Diners Club",
    icon: "https://cdn.jsdelivr.net/gh/fabioluz/pagamento-icons@master/svg/diners.svg",
  },
  discover: {
    label: "Discover",
    icon: "https://cdn.jsdelivr.net/gh/fabioluz/pagamento-icons@master/svg/discover.svg",
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
