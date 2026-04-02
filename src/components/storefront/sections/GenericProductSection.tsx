import { useMemo } from "react";
import { Link } from "react-router-dom";
import type { StoreHomeSection } from "@/hooks/useStoreHomeSections";
import { SectionWrapper } from "../DynamicHomeSections";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShoppingCart } from "lucide-react";
import { toast } from "sonner";

interface Props {
  section: StoreHomeSection;
  products?: any[];
  cart?: any;
  basePath?: string;
  primaryColor: string;
  buttonColor: string;
  buttonTextColor: string;
}

export function GenericProductSection({ section, products, cart, basePath = "/loja", primaryColor, buttonColor, buttonTextColor }: Props) {
  const formatPrice = (price: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(price);

  const filteredProducts = useMemo(() => {
    if (!products || products.length === 0) return [];
    const limit = (section.config as any)?.limit || 8;

    switch (section.section_type) {
      case "best_sellers":
        // For now show first N products (would need sales data for real sorting)
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

  if (filteredProducts.length === 0) return null;

  return (
    <SectionWrapper section={section} primaryColor={primaryColor}>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {filteredProducts.map((product) => (
          <Link key={product.id} to={`${basePath}/produto/${product.id}`} className="group">
            <Card className="overflow-hidden border-border hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
              <div className="aspect-square overflow-hidden bg-muted">
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-4xl">📦</div>
                )}
              </div>
              <div className="p-3">
                <p className="text-sm font-medium line-clamp-2 min-h-[2.5rem]">{product.name}</p>
                <p className="text-lg font-bold mt-1" style={{ color: primaryColor }}>
                  {formatPrice(product.price)}
                </p>
                <Button
                  className="w-full mt-2"
                  size="sm"
                  style={{ backgroundColor: buttonColor, color: buttonTextColor }}
                  disabled={product.stock <= 0 && !product.made_to_order}
                  onClick={(e) => {
                    e.preventDefault();
                    cart?.addItem({ id: product.id, name: product.name, price: product.price, image_url: product.image_url });
                    toast.success("Adicionado ao carrinho!");
                  }}
                >
                  <ShoppingCart className="mr-1 h-3 w-3" /> Comprar
                </Button>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </SectionWrapper>
  );
}
