import { useState, useEffect, useCallback } from "react";
import { ShoppingCart, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CartNotificationProps {
  productName: string;
  productImage?: string | null;
  buttonColor?: string;
  buttonTextColor?: string;
  onClose: () => void;
  onOpenCart: () => void;
}

export function CartNotification({
  productName,
  productImage,
  buttonColor = "#000",
  buttonTextColor = "#fff",
  onClose,
  onOpenCart,
}: CartNotificationProps) {
  const [exiting, setExiting] = useState(false);

  const handleClose = useCallback(() => {
    setExiting(true);
    setTimeout(onClose, 300);
  }, [onClose]);

  useEffect(() => {
    const timer = setTimeout(handleClose, 4000);
    return () => clearTimeout(timer);
  }, [handleClose]);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center pointer-events-none">
      <div
        className={`pointer-events-auto max-w-sm w-[90%] rounded-2xl shadow-2xl border border-border bg-card p-4 transition-all duration-300 ${
          exiting ? "opacity-0 scale-90" : "opacity-100 scale-100 animate-scale-in"
        }`}
      >
        {/* Close */}
        <button
          onClick={handleClose}
          className="absolute top-3 right-3 h-6 w-6 rounded-full bg-muted flex items-center justify-center hover:bg-muted-foreground/20 transition-colors"
        >
          <X className="h-3.5 w-3.5 text-foreground" />
        </button>

        <div className="flex items-center gap-3">
          {/* Check icon */}
          <div
            className="h-10 w-10 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: buttonColor + "20" }}
          >
            <Check className="h-5 w-5" style={{ color: buttonColor }} />
          </div>

          {/* Product info */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">Adicionado ao carrinho!</p>
            <p className="text-xs text-muted-foreground truncate">{productName}</p>
          </div>

          {/* Product thumb */}
          {productImage && (
            <img
              src={productImage}
              alt=""
              className="h-12 w-12 rounded-lg object-cover shrink-0"
            />
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-3">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-xs"
            onClick={handleClose}
          >
            Continuar comprando
          </Button>
          <Button
            size="sm"
            className="flex-1 text-xs transition-transform active:scale-95"
            style={{ backgroundColor: buttonColor, color: buttonTextColor }}
            onClick={() => {
              handleClose();
              onOpenCart();
            }}
          >
            <ShoppingCart className="mr-1 h-3 w-3" />
            Ver Carrinho
          </Button>
        </div>
      </div>
    </div>
  );
}

// Hook to manage cart notification state
export function useCartNotification() {
  const [notification, setNotification] = useState<{
    productName: string;
    productImage?: string | null;
  } | null>(null);

  const show = useCallback((productName: string, productImage?: string | null) => {
    setNotification({ productName, productImage });
  }, []);

  const hide = useCallback(() => {
    setNotification(null);
  }, []);

  return { notification, show, hide };
}
