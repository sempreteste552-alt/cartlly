import { useMemo } from "react";
import { Link } from "react-router-dom";
import type { StoreHomeSection } from "@/hooks/useStoreHomeSections";
import { SectionWrapper } from "../DynamicHomeSections";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Eye } from "lucide-react";
import { useTranslation } from "@/i18n";
import { useLocalizedTextList } from "@/hooks/useLocalizedStoreText";

interface Props {
  section: StoreHomeSection;
  products?: any[];
  cart?: any;
  basePath?: string;
  primaryColor: string;
  buttonColor: string;
  buttonTextColor: string;
  onAddToCart?: (name: string, image?: string | null) => void;
}

export function GenericProductSection({ section, products, cart, basePath = "/loja", primaryColor, buttonColor, buttonTextColor, onAddToCart }: Props) {
  const { locale } = useTranslation();
  const formatPrice = (price: number) =>
    new Intl.NumberFormat(locale === "en" ? "en-US" : locale === "es" ? "es-ES" : locale === "fr" ? "fr-FR" : "pt-BR", { style: "currency", currency: "BRL" }).format(price);

  const filteredProducts = useMemo(() => {
    if (!products || products.length === 0) return [];
    const limit = (section.config as any)?.limit || 8;

    switch (section.section_type) {
      case "best_sellers":
        return products.slice(0, limit);
      case "new_arrivals":
        return [...products]
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, limit);
      case "featured_products":
        return products.slice(0, limit);
      case "collections":
      case "categories":
        return products.slice(0, limit);
      default:
        return products.slice(0, limit);
    }
  }, [products, section]);

  const translatedNames = useLocalizedTextList(filteredProducts.map((p) => p.name));

  const addToCartText = {
    pt: "Adicionar ao Carrinho",
    en: "Add to Cart",
    es: "Añadir al Carrito",
    fr: "Ajouter au Panier",
  }[locale];

  if (filteredProducts.length === 0) return null;

  return (
    <SectionWrapper section={section} primaryColor={primaryColor}>
      <div 
        className="grid" 
        style={{ 
          gridTemplateColumns: `repeat(var(--store-grid-cols-mobile, 2), 1fr)`,
          gap: `var(--store-grid-gap, 16px)`,
          "--desktop-cols": `var(--store-grid-cols-desktop, 4)`,
        } as any}
      >
        <style>{`
          @media (min-width: 640px) {
            .grid { grid-template-columns: repeat(var(--desktop-cols), 1fr) !important; }
          }
        `}</style>
        {filteredProducts.map((product, index) => (
          <Link key={product.id} to={`${basePath}/produto/${product.id}`} className="group">
            <Card 
              className="overflow-hidden border-border transition-all duration-300 hover:shadow-xl hover:-translate-y-1 relative bg-card"
              style={{ 
                borderRadius: "var(--store-card-radius, 8px)",
                boxShadow: "var(--store-card-shadow, 0 1px 2px 0 rgb(0 0 0 / 0.05))",
                fontFamily: "var(--store-font-body)"
              }}
            >
              <div className="aspect-square overflow-hidden bg-muted">
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={translatedNames[index] || product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-4xl">📦</div>
                )}
              </div>
              <div className="p-3">
                <div className="flex items-center justify-between gap-1 mb-1">
                  <p className="text-sm font-medium line-clamp-2 min-h-[2.5rem] flex-1">{translatedNames[index] || product.name}</p>
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded-full shrink-0">
                    <Eye className="h-3 w-3" />
                    <span>{product.views || 0}</span>
                  </div>
                </div>
                <p className="text-lg font-bold" style={{ color: primaryColor }}>
                  {formatPrice(product.price)}
                </p>
                <Button
                  className="w-full mt-2 transition-transform active:scale-95 text-[10px] xs:text-xs px-2 whitespace-nowrap"
                  size="sm"
                  style={{ backgroundColor: buttonColor, color: buttonTextColor }}
                  disabled={product.stock <= 0 && !product.made_to_order}
                  onClick={(e) => {
                    e.preventDefault();
                    cart?.addItem({ id: product.id, name: product.name, price: product.price, image_url: product.image_url });
                    onAddToCart?.(product.name, product.image_url);
                  }}
                >
                  <ShoppingCart className="mr-1 h-3 w-3 shrink-0" /> <span className="truncate">{addToCartText}</span>
                </Button>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </SectionWrapper>
  );
}
