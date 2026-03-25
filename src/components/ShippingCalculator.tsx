import { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, Truck, MapPin } from "lucide-react";
import { toast } from "sonner";

interface ShippingOption {
  method: string;
  price: number;
  days: string;
}

interface ShippingCalculatorProps {
  settings: any;
  subtotal: number;
  onSelectShipping: (option: ShippingOption | null) => void;
  selectedShipping: ShippingOption | null;
}

export default function ShippingCalculator({ settings, subtotal, onSelectShipping, selectedShipping }: ShippingCalculatorProps) {
  const [cep, setCep] = useState("");
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<ShippingOption[]>([]);
  const [calculated, setCalculated] = useState(false);

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(price);

  const formatCep = (value: string) => {
    const numbers = value.replace(/\D/g, "").slice(0, 8);
    if (numbers.length > 5) return `${numbers.slice(0, 5)}-${numbers.slice(5)}`;
    return numbers;
  };

  const calculateShipping = useCallback(async () => {
    const cleanCep = cep.replace(/\D/g, "");
    if (cleanCep.length !== 8) {
      toast.error("CEP inválido. Digite 8 números.");
      return;
    }

    setLoading(true);
    setCalculated(false);
    onSelectShipping(null);

    try {
      // Simulate shipping calculation based on store settings
      const shippingOptions: ShippingOption[] = [];
      const flatRate = settings?.shipping_flat_rate;
      const baseCost = settings?.shipping_base_cost || 0;
      const freeAbove = settings?.shipping_free_above;

      // Free shipping check
      if (freeAbove && subtotal >= freeAbove) {
        shippingOptions.push({
          method: "Frete Grátis",
          price: 0,
          days: "5-8 dias úteis",
        });
      }

      // Standard shipping
      if (flatRate && flatRate > 0) {
        shippingOptions.push({
          method: "Padrão",
          price: flatRate,
          days: "5-10 dias úteis",
        });
      } else if (baseCost > 0) {
        shippingOptions.push({
          method: "Padrão",
          price: baseCost,
          days: "5-10 dias úteis",
        });
      }

      // Express (simulated as 1.8x of standard)
      const standardPrice = flatRate || baseCost;
      if (standardPrice > 0) {
        shippingOptions.push({
          method: "Expresso",
          price: Math.round(standardPrice * 1.8 * 100) / 100,
          days: "2-4 dias úteis",
        });
      }

      // If no shipping config, use fallback
      if (shippingOptions.length === 0) {
        // Simple distance-based simulation using CEP region
        const region = parseInt(cleanCep.charAt(0));
        const baseFee = 9.90 + region * 2.5;
        
        shippingOptions.push(
          { method: "Econômico", price: Math.round(baseFee * 100) / 100, days: "8-12 dias úteis" },
          { method: "Padrão", price: Math.round(baseFee * 1.5 * 100) / 100, days: "5-8 dias úteis" },
          { method: "Expresso", price: Math.round(baseFee * 2.5 * 100) / 100, days: "2-4 dias úteis" },
        );

        if (subtotal >= 200) {
          shippingOptions.unshift({ method: "Frete Grátis", price: 0, days: "8-15 dias úteis" });
        }
      }

      setOptions(shippingOptions);
      setCalculated(true);
    } catch {
      toast.error("Erro ao calcular frete");
    } finally {
      setLoading(false);
    }
  }, [cep, settings, subtotal, onSelectShipping]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Truck className="h-4 w-4 text-gray-500" />
        <Label className="text-sm font-medium">Calcular Frete</Label>
      </div>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="00000-000"
            value={cep}
            onChange={(e) => setCep(formatCep(e.target.value))}
            onKeyDown={(e) => e.key === "Enter" && calculateShipping()}
            className="pl-9 font-mono"
            maxLength={9}
          />
        </div>
        <Button variant="outline" onClick={calculateShipping} disabled={loading || cep.replace(/\D/g, "").length !== 8}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Calcular"}
        </Button>
      </div>

      {calculated && options.length > 0 && (
        <div className="space-y-2 animate-fade-in">
          {options.map((opt, i) => (
            <button
              key={i}
              onClick={() => onSelectShipping(opt)}
              className={`w-full flex items-center justify-between rounded-lg border p-3 text-left transition-all text-sm ${
                selectedShipping?.method === opt.method
                  ? "border-black bg-gray-50 ring-1 ring-black"
                  : "border-gray-200 hover:border-gray-400"
              }`}
            >
              <div>
                <p className="font-medium">{opt.method}</p>
                <p className="text-xs text-gray-500">{opt.days}</p>
              </div>
              <span className={`font-bold ${opt.price === 0 ? "text-green-600" : ""}`}>
                {opt.price === 0 ? "Grátis" : formatPrice(opt.price)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
