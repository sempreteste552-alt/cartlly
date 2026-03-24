import { useMemo } from "react";
import { Link } from "react-router-dom";
import { usePublicProducts, usePublicCategories } from "@/hooks/usePublicStore";
import { usePublicBanners } from "@/hooks/useStoreBanners";
import { useLojaContext } from "./LojaLayout";
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext } from "@/components/ui/carousel";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Package } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function LojaHome() {
  const { data: products, isLoading: prodLoading } = usePublicProducts();
  const { data: banners } = usePublicBanners();
  const { data: categories } = usePublicCategories();
  const { cart, searchTerm } = useLojaContext();

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(price);

  const filtered = useMemo(() => {
    if (!products) return [];
    if (!searchTerm.trim()) return products;
    const term = searchTerm.toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(term) || p.description?.toLowerCase().includes(term));
  }, [products, searchTerm]);

  // Under construction
  if (!prodLoading && (!products || products.length === 0)) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-4">
        <div className="text-7xl mb-6">🏗️</div>
        <h1 className="text-3xl font-bold text-center">Loja em Construção</h1>
        <p className="text-gray-500 mt-3 text-center max-w-md">
          Estamos preparando nossos produtos para você. Volte em breve para conferir as novidades!
        </p>
      </div>
    );
  }

  // Group by category
  const groupedByCategory = useMemo(() => {
    if (!filtered.length) return {};
    const groups: Record<string, typeof filtered> = {};
    filtered.forEach((p) => {
      const catName = (p as any).categories?.name || "Outros";
      if (!groups[catName]) groups[catName] = [];
      groups[catName].push(p);
    });
    return groups;
  }, [filtered]);

  return (
    <div>
      {/* Banner carousel */}
      {banners && banners.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 pt-4">
          <Carousel opts={{ loop: true }} className="w-full">
            <CarouselContent>
              {banners.map((banner) => (
                <CarouselItem key={banner.id}>
                  {banner.link_url ? (
                    <a href={banner.link_url} target="_blank" rel="noopener noreferrer">
                      <img src={banner.image_url} alt="Banner" className="w-full h-48 sm:h-64 md:h-80 object-cover rounded-lg" />
                    </a>
                  ) : (
                    <img src={banner.image_url} alt="Banner" className="w-full h-48 sm:h-64 md:h-80 object-cover rounded-lg" />
                  )}
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="left-2" />
            <CarouselNext className="right-2" />
          </Carousel>
        </div>
      )}

      {/* Categories bar */}
      {categories && categories.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 mt-6">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {categories.map((cat) => (
              <Badge key={cat.id} variant="outline" className="shrink-0 cursor-pointer hover:bg-black hover:text-white transition-colors px-4 py-1.5">
                {cat.name}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Products */}
      <div className="max-w-7xl mx-auto px-4 mt-8 space-y-10 pb-8">
        {prodLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-48 w-full rounded-lg" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))}
          </div>
        ) : searchTerm.trim() ? (
          <>
            <h2 className="text-lg font-bold">Resultados para "{searchTerm}" ({filtered.length})</h2>
            <ProductGrid products={filtered} formatPrice={formatPrice} cart={cart} />
          </>
        ) : (
          Object.entries(groupedByCategory).map(([catName, catProducts]) => (
            <div key={catName}>
              <h2 className="text-xl font-bold mb-4 border-b border-gray-200 pb-2">{catName}</h2>
              <ProductGrid products={catProducts} formatPrice={formatPrice} cart={cart} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ProductGrid({ products, formatPrice, cart }: { products: any[]; formatPrice: (p: number) => string; cart: ReturnType<typeof import("@/hooks/useCart").useCart> }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      {products.map((product) => (
        <Link key={product.id} to={`/loja/produto/${product.id}`} className="group">
          <Card className="overflow-hidden border-gray-200 hover:shadow-lg transition-shadow">
            <div className="aspect-square bg-gray-50 overflow-hidden">
              {product.image_url ? (
                <img src={product.image_url} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="h-12 w-12 text-gray-300" />
                </div>
              )}
            </div>
            <div className="p-3">
              <p className="text-sm font-medium line-clamp-2 min-h-[2.5rem]">{product.name}</p>
              <p className="text-lg font-bold mt-1">{formatPrice(product.price)}</p>
              {product.stock > 0 ? (
                <p className="text-xs text-green-600 mt-1">Em estoque</p>
              ) : (
                <p className="text-xs text-red-500 mt-1">Esgotado</p>
              )}
              <Button
                className="w-full mt-2 bg-black text-white hover:bg-gray-800"
                size="sm"
                disabled={product.stock <= 0}
                onClick={(e) => {
                  e.preventDefault();
                  cart.addItem({ id: product.id, name: product.name, price: product.price, image_url: product.image_url });
                }}
              >
                <ShoppingCart className="mr-1 h-3 w-3" /> Comprar
              </Button>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}
