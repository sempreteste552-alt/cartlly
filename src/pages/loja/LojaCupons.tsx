import { useState } from "react";
import { useLojaContext } from "./LojaLayout";
import { Copy, Check, Tag, Ticket, Clock, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { usePublicCoupons } from "@/hooks/usePublicCoupons";

export default function LojaCupons() {
  const { storeUserId, settings } = useLojaContext();
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const { data: coupons, isLoading } = usePublicCoupons(storeUserId);

  const primaryColor = settings?.primary_color || "#6d28d9";
  const buttonColor = settings?.button_color || "#000000";

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success(`Cupom ${code} copiado!`);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  const formatDiscount = (c: typeof coupons extends (infer T)[] | undefined ? T : never) =>
    c.discount_type === "percentage"
      ? `${c.discount_value}% OFF`
      : `R$ ${Number(c.discount_value).toFixed(2)} OFF`;

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" style={{ borderColor: `${primaryColor}40`, borderTopColor: "transparent" }} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="h-12 w-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: `${primaryColor}15` }}>
          <Ticket className="h-6 w-6" style={{ color: primaryColor }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Cupons de Desconto</h1>
          <p className="text-sm text-muted-foreground">Aproveite nossas ofertas especiais</p>
        </div>
      </div>

      {!coupons || coupons.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="h-20 w-20 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: `${primaryColor}10` }}>
            <Tag className="h-10 w-10 text-muted-foreground/40" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">Nenhum cupom disponível</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            No momento não temos cupons ativos. Fique de olho, novas promoções podem surgir a qualquer momento!
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {coupons.map((c) => (
            <div
              key={c.code}
              className="relative overflow-hidden rounded-2xl border-2 transition-all hover:shadow-lg hover:-translate-y-0.5 group"
              style={{ borderColor: `${primaryColor}30`, backgroundColor: `${primaryColor}05` }}
            >
              {/* Decorative circles */}
              <div className="absolute -left-3 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-background border-2" style={{ borderColor: `${primaryColor}30` }} />
              <div className="absolute -right-3 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-background border-2" style={{ borderColor: `${primaryColor}30` }} />

              <div className="px-6 py-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    {/* Discount badge */}
                    <div
                      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold text-white mb-3"
                      style={{ backgroundColor: primaryColor }}
                    >
                      <Tag className="h-3.5 w-3.5" />
                      {formatDiscount(c)}
                    </div>

                    {/* Code */}
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className="font-mono text-xl font-black tracking-[0.15em] px-3 py-1.5 rounded-lg border-2 border-dashed"
                        style={{ borderColor: `${primaryColor}50`, color: primaryColor, backgroundColor: `${primaryColor}08` }}
                      >
                        {c.code}
                      </span>
                    </div>

                    {/* Details */}
                    <div className="flex flex-wrap gap-3 mt-3 text-xs text-muted-foreground">
                      {c.min_order_value && Number(c.min_order_value) > 0 && (
                        <span className="flex items-center gap-1">
                          <ShoppingBag className="h-3 w-3" />
                          Mín. R$ {Number(c.min_order_value).toFixed(2)}
                        </span>
                      )}
                      {c.expires_at && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Até {formatDate(c.expires_at)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Copy button */}
                  <button
                    onClick={() => copyCode(c.code)}
                    className="flex flex-col items-center gap-1 px-4 py-3 rounded-xl border-2 transition-all hover:scale-105 active:scale-95 shrink-0"
                    style={{
                      borderColor: copiedCode === c.code ? "#22c55e" : `${primaryColor}40`,
                      backgroundColor: copiedCode === c.code ? "#22c55e10" : `${primaryColor}08`,
                      color: copiedCode === c.code ? "#22c55e" : primaryColor,
                    }}
                  >
                    {copiedCode === c.code ? (
                      <Check className="h-5 w-5" />
                    ) : (
                      <Copy className="h-5 w-5" />
                    )}
                    <span className="text-[10px] font-semibold">
                      {copiedCode === c.code ? "Copiado!" : "Copiar"}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
