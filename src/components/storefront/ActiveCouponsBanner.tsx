import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Tag, Copy, Check, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { usePublicCoupons } from "@/hooks/usePublicCoupons";

export function ActiveCouponsBanner({ storeUserId, primaryColor }: { storeUserId?: string; primaryColor?: string }) {
  const [expanded, setExpanded] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const { data: coupons, isLoading } = usePublicCoupons(storeUserId);

  if (isLoading || !coupons || coupons.length === 0) return null;

  const color = primaryColor || "#6d28d9";

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success(`Cupom ${code} copiado!`);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const formatDiscount = (c: typeof coupons[0]) =>
    c.discount_type === "percentage" ? `${c.discount_value}% OFF` : `R$ ${Number(c.discount_value).toFixed(2)} OFF`;

  const visibleCoupons = expanded ? coupons : coupons.slice(0, 2);

  return (
    <div className="max-w-7xl mx-auto px-4 py-3">
      <div
        className="rounded-xl p-3 border"
        style={{ borderColor: `${color}30`, backgroundColor: `${color}08` }}
      >
        <div className="flex items-center gap-2 mb-2">
          <Tag className="h-4 w-4" style={{ color }} />
          <span className="text-sm font-semibold" style={{ color }}>
            Cupons disponíveis
          </span>
          <Badge variant="secondary" className="text-[10px]" style={{ backgroundColor: `${color}15`, color }}>
            {coupons.length}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          {visibleCoupons.map((c) => (
            <button
              key={c.code}
              onClick={() => copyCode(c.code)}
              className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all hover:scale-105 active:scale-95"
              style={{ borderColor: `${color}40`, color }}
            >
              <span className="font-mono font-bold tracking-wider">{c.code}</span>
              <Badge
                variant="secondary"
                className="text-[10px] px-1 py-0"
                style={{ backgroundColor: `${color}15`, color }}
              >
                {formatDiscount(c)}
              </Badge>
              {copiedCode === c.code ? (
                <Check className="h-3 w-3 text-green-500" />
              ) : (
                <Copy className="h-3 w-3 opacity-50" />
              )}
            </button>
          ))}
        </div>
        {coupons.length > 2 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs mt-2 opacity-70 hover:opacity-100 transition-opacity"
            style={{ color }}
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {expanded ? "Ver menos" : `+${coupons.length - 2} cupons`}
          </button>
        )}
      </div>
    </div>
  );
}
