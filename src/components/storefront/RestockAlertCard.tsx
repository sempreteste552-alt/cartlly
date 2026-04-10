import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { X, ChevronLeft, ChevronRight, ShoppingBag, Sparkles } from "lucide-react";
import { usePublicRestockAlert } from "@/hooks/useRestockAlerts";
import { usePublicProducts } from "@/hooks/usePublicStore";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  storeUserId?: string;
  basePath: string;
  primaryColor?: string;
  buttonColor?: string;
  buttonTextColor?: string;
}

export function RestockAlertCard({ storeUserId, basePath, primaryColor = "#6d28d9", buttonColor = "#000", buttonTextColor = "#fff" }: Props) {
  const { data: alert } = usePublicRestockAlert(storeUserId);
  const { data: allProducts } = usePublicProducts(storeUserId);
  const [visible, setVisible] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [previewProduct, setPreviewProduct] = useState<any>(null);

  // Use alert colors or fallback to props
  const alertBgColor = alert?.bg_color || primaryColor;
  const alertTextColor = alert?.text_color || "#ffffff";
  const alertCardBgColor = alert?.card_bg_color || "#ffffff";
  const alertAccentColor = alert?.accent_color || primaryColor;

  const restockProducts = allProducts?.filter((p) => {
    const isManual = alert?.product_ids?.includes(p.id);
    
    // Auto-include products updated in the last 7 days (restock/new)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const updatedDate = p.updated_at ? new Date(p.updated_at) : null;
    const isRecent = updatedDate && updatedDate > sevenDaysAgo && p.stock > 0;
    
    return isManual || isRecent;
  }) ?? [];

  useEffect(() => {
    if (alert && restockProducts.length > 0) {
      const t = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(t);
    }
  }, [alert, restockProducts.length]);

  // Autoplay carousel
  useEffect(() => {
    if (!visible || restockProducts.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIdx((i) => (i + 1) % restockProducts.length);
    }, 3500);
    return () => clearInterval(interval);
  }, [visible, restockProducts.length]);

  const handleClose = useCallback(() => {
    setVisible(false);
  }, []);

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(price);

  if (!visible || restockProducts.length === 0) return null;

  const product = restockProducts[currentIdx];

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={handleClose}
      />

      {/* Card */}
      <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-[61] mx-auto max-w-md animate-scale-in">
        <div
          className="relative rounded-2xl overflow-hidden shadow-2xl border border-white/10"
          style={{ background: `linear-gradient(145deg, ${alertBgColor}25, ${alertBgColor}08)`, backdropFilter: "blur(20px)" }}
        >
          {/* Glow effect */}
          <div
            className="absolute -top-20 -right-20 w-40 h-40 rounded-full blur-3xl opacity-30 pointer-events-none"
            style={{ background: alertAccentColor }}
          />

          {/* Close button */}
          <button
            onClick={handleClose}
            className="absolute top-3 right-3 z-10 h-8 w-8 rounded-full bg-card/80 backdrop-blur-sm flex items-center justify-center hover:bg-card transition-all hover:scale-110 shadow-sm"
          >
            <X className="h-4 w-4 text-foreground" />
          </button>

          {/* Header */}
          <div className="px-5 pt-5 pb-2">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="h-5 w-5 animate-pulse" style={{ color: alertAccentColor }} />
              <h3 className="text-lg font-bold leading-tight" style={{ color: alertTextColor === '#ffffff' ? undefined : alertTextColor }}>
                {alert?.title || "🔥 Produtos de volta!"}
              </h3>
            </div>
            {alert?.subtitle && (
              <p className="text-sm text-muted-foreground">{alert.subtitle}</p>
            )}
          </div>

          {/* Carousel */}
          <div className="relative px-5 py-3">
            <div className="relative rounded-xl overflow-hidden shadow-inner" style={{ backgroundColor: alertCardBgColor }}>
              {/* Product image */}
              <div className="aspect-[4/3] relative overflow-hidden">
                {product?.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-full h-full object-cover transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full bg-muted flex items-center justify-center">
                    <ShoppingBag className="h-12 w-12 text-muted-foreground/40" />
                  </div>
                )}

                {/* Navigation arrows */}
                {restockProducts.length > 1 && (
                  <>
                    <button
                      onClick={(e) => { e.stopPropagation(); setCurrentIdx((i) => (i - 1 + restockProducts.length) % restockProducts.length); }}
                      className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-card/80 backdrop-blur-sm flex items-center justify-center hover:bg-card transition-all shadow-sm"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setCurrentIdx((i) => (i + 1) % restockProducts.length); }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-card/80 backdrop-blur-sm flex items-center justify-center hover:bg-card transition-all shadow-sm"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </>
                )}

                {/* Dots indicator */}
                {restockProducts.length > 1 && (
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
                    {restockProducts.map((_, i) => (
                      <button
                        key={i}
                        onClick={(e) => { e.stopPropagation(); setCurrentIdx(i); }}
                        className="h-1.5 rounded-full transition-all duration-300"
                        style={{
                          width: i === currentIdx ? 16 : 6,
                          backgroundColor: i === currentIdx ? alertAccentColor : "rgba(255,255,255,0.5)",
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Product info */}
              <div className="p-3">
                <p className="font-semibold text-sm text-foreground line-clamp-1">{product?.name}</p>
                <p className="text-lg font-bold mt-0.5" style={{ color: alertAccentColor }}>
                  {formatPrice(product?.price || 0)}
                </p>
              </div>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="px-5 pb-5 flex gap-2">
            <Button
              className="flex-1 font-bold text-sm transition-transform active:scale-95 animate-pulse"
              style={{ backgroundColor: buttonColor, color: buttonTextColor }}
              onClick={() => setPreviewProduct(product)}
            >
              <ShoppingBag className="mr-1 h-4 w-4" />
              {alert?.cta_text || "Conferir"}
            </Button>
            <Link to={`${basePath}/produto/${product?.id}`} onClick={handleClose} className="flex-1">
              <Button
                variant="outline"
                className="w-full font-bold text-sm transition-transform active:scale-95"
                style={{ borderColor: alertAccentColor, color: alertAccentColor }}
              >
                Ver Produto
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      <Dialog open={!!previewProduct} onOpenChange={() => setPreviewProduct(null)}>
        <DialogContent className="max-w-sm z-[70]">
          <DialogHeader>
            <DialogTitle className="line-clamp-2">{previewProduct?.name}</DialogTitle>
          </DialogHeader>
          {previewProduct?.image_url && (
            <img
              src={previewProduct.image_url}
              alt={previewProduct.name}
              className="w-full aspect-square object-cover rounded-lg"
            />
          )}
          <div>
            <p className="text-2xl font-bold" style={{ color: alertAccentColor }}>
              {formatPrice(previewProduct?.price || 0)}
            </p>
            {previewProduct?.description && (
              <p className="text-sm text-muted-foreground mt-2 line-clamp-3">{previewProduct.description}</p>
            )}
            {previewProduct?.stock > 0 ? (
              <p className="text-xs text-green-600 mt-1">✅ Em estoque</p>
            ) : (
              <p className="text-xs text-red-500 mt-1">Esgotado</p>
            )}
          </div>
          <Link
            to={`${basePath}/produto/${previewProduct?.id}`}
            onClick={() => { setPreviewProduct(null); handleClose(); }}
          >
            <Button
              className="w-full font-bold transition-transform active:scale-95"
              style={{ backgroundColor: buttonColor, color: buttonTextColor }}
            >
              Ver Produto Completo
            </Button>
          </Link>
        </DialogContent>
      </Dialog>
    </>
  );
}
