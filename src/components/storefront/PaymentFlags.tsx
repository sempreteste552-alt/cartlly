import React from "react";
import { cn } from "@/lib/utils";
import visaIcon from "@/assets/payment-flags/visa.png";
import mastercardIcon from "@/assets/payment-flags/mastercard.png";
import eloIcon from "@/assets/payment-flags/elo.png";
import amexIcon from "@/assets/payment-flags/amex.png";
import hipercardIcon from "@/assets/payment-flags/hipercard.png";
import pixIcon from "@/assets/payment-flags/pix.png";
import boletoIcon from "@/assets/payment-flags/boleto.png";
import dinersIcon from "@/assets/payment-flags/diners.png";
import discoverIcon from "@/assets/payment-flags/discover.png";
import applepayIcon from "@/assets/payment-flags/applepay.png";

interface PaymentFlagsProps {
  acceptedMethods?: string[];
  className?: string;
}

const PAYMENT_METHODS_DATA: Record<string, { label: string; icon: string }> = {
  visa: { label: "Visa", icon: visaIcon },
  mastercard: { label: "Mastercard", icon: mastercardIcon },
  elo: { label: "Elo", icon: eloIcon },
  amex: { label: "American Express", icon: amexIcon },
  hipercard: { label: "Hipercard", icon: hipercardIcon },
  pix: { label: "PIX", icon: pixIcon },
  boleto: { label: "Boleto", icon: boletoIcon },
  diners: { label: "Diners Club", icon: dinersIcon },
  discover: { label: "Discover", icon: discoverIcon },
  applepay: { label: "Apple Pay", icon: applepayIcon },
};

export const PaymentFlags: React.FC<PaymentFlagsProps> = ({ 
  acceptedMethods = ["visa", "mastercard", "elo", "amex", "hipercard", "pix", "boleto"], 
  className 
}) => {
  if (!acceptedMethods || acceptedMethods.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap items-center justify-center gap-2", className)}>
      {acceptedMethods.map((method) => {
        const data = PAYMENT_METHODS_DATA[method.toLowerCase()];
        if (!data) return null;
        
        return (
          <div 
            key={method} 
            className="bg-white rounded px-1.5 py-1 flex items-center justify-center w-12 h-7 border border-gray-200 shadow-sm transition-transform hover:scale-110"
            title={data.label}
          >
            <img 
              src={data.icon} 
              alt={data.label} 
              className="max-w-full max-h-full object-contain filter brightness-110"
            />
          </div>
        );
      })}
    </div>
  );
};
