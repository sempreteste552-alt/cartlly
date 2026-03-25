import { useMemo } from "react";
import { Link } from "react-router-dom";
import { usePublicProducts, usePublicCategories, useAllProductReviews } from "@/hooks/usePublicStore";
import { usePublicBanners } from "@/hooks/useStoreBanners";
import { usePublicProductImages } from "@/hooks/useProductImages";
import { useLojaContext } from "./LojaLayout";
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext } from "@/components/ui/carousel";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Star, Share2, Heart } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductImageSlideshow } from "@/components/ProductImageSlideshow";
import { useWishlist } from "@/hooks/useWishlist";
import { toast } from "sonner";

export default function LojaHome() {
  const { cart, searchTerm, settings, storeUserId } = useLojaContext();
  const { data: products, isLoading: prodLoading } = usePublicProducts(storeUserId);
  const { data: banners } = usePublicBanners(storeUserId);
  const { data: categories } = usePublicCategories(storeUserId);
  const wishlist = useWishlist(storeUserId);

  const productIds = useMemo(() => products?.map((p) => p.id) ?? [], [products]);
  const { data: ratings } = useAllProductReviews(productIds);
  const { data: productImagesMap } = usePublicProductImages(productIds);

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(price);

  const filtered = useMemo(() => {
    if (!products) return [];
    if (!searchTerm.trim()) return products;
    const term = searchTerm.toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(term) || p.description?.toLowerCase().includes(term));
  }, [products, searchTerm]);

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

  const primaryColor = settings?.primary_color || "#6d28d9";
  const buttonColor = settings?.button_color || "#000000";
  const buttonTextColor = settings?.button_text_color || "#ffffff";
  const accentColor = settings?.accent_color || "#8b5cf6";

  return (
    <div>
      {banners && banners.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 pt-4">
          <Carousel opts={{ loop: true }} className="w-full">
            <CarouselContent>
              {banners.map((banner) => (
                <CarouselItem key={banner.id}>
                  {(banner as any).media_type === "video" ? (
                    <video
                      src={banner.image_url}
                      className="w-full h-48 sm:h-64 md:h-80 object-cover rounded-lg"
                      autoPlay muted loop playsInline
                    />
                  ) : banner.link_url ? (
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

      {categories && categories.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 mt-6">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {categories.map((cat) => (
              <Badge
                key={cat.id}
                variant="outline"
                className="shrink-0 cursor-pointer transition-colors px-4 py-1.5 hover:text-white"
                style={{ borderColor: primaryColor, color: primaryColor }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = primaryColor; e.currentTarget.style.color = "#fff"; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = primaryColor; }}
              >
                {cat.name}
              </Badge>
            ))}
          </div>
        </div>
      )}

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
            <ProductGrid products={filtered} formatPrice={formatPrice} cart={cart} ratings={ratings} productImagesMap={productImagesMap} buttonColor={buttonColor} buttonTextColor={buttonTextColor} primaryColor={primaryColor} accentColor={accentColor} wishlist={wishlist} />
          </>
        ) : (
          Object.entries(groupedByCategory).map(([catName, catProducts]) => (
            <div key={catName}>
              <h2 className="text-xl font-bold mb-4 pb-2" style={{ borderBottom: `2px solid ${primaryColor}20` }}>{catName}</h2>
              <ProductGrid products={catProducts} formatPrice={formatPrice} cart={cart} ratings={ratings} productImagesMap={productImagesMap} buttonColor={buttonColor} buttonTextColor={buttonTextColor} primaryColor={primaryColor} accentColor={accentColor} wishlist={wishlist} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ProductGrid({ products, formatPrice, cart, ratings, productImagesMap, buttonColor, buttonTextColor, primaryColor, accentColor, wishlist }: {
  products: any[];
  formatPrice: (p: number) => string;
  cart: ReturnType<typeof import("@/hooks/useCart").useCart>;
  ratings?: Record<string, { average: number; count: number }>;
  productImagesMap?: Record<string, string[]>;
  buttonColor: string;
  buttonTextColor: string;
  primaryColor: string;
  accentColor: string;
  wishlist: ReturnType<typeof import("@/hooks/useWishlist").useWishlist>;
}) {
  const handleShare = async (e: React.MouseEvent, product: any) => {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}/loja/produto/${product.id}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: product.name, text: `Confira: ${product.name}`, url });
      } catch {}
    } else {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado!");
    }
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      {products.map((product) => {
        const r = ratings?.[product.id];
        const additionalImages = productImagesMap?.[product.id] ?? [];
        return (
          <Link key={product.id} to={`/loja/produto/${product.id}`} className="group">
            <Card className="overflow-hidden border-gray-200 hover:shadow-lg transition-shadow">
              <div className="aspect-square overflow-hidden relative">
                <ProductImageSlideshow
                  mainImage={product.image_url}
                  additionalImages={additionalImages}
                  alt={product.name}
                  className="group-hover:scale-[1.02] transition-transform duration-300"
                />
                <div className="absolute top-2 right-2 flex flex-col gap-1">
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); wishlist.toggleWishlist(product.id); }}
                    className="h-8 w-8 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center hover:bg-white shadow-sm transition-all"
                    title="Favoritar"
                  >
                    <Heart className={`h-4 w-4 transition-colors ${wishlist.isWishlisted(product.id) ? "fill-red-500 text-red-500" : "text-gray-700"}`} />
                  </button>
                  <button
                    onClick={(e) => handleShare(e, product)}
                    className="h-8 w-8 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white shadow-sm"
                    title="Compartilhar"
                  >
                    <Share2 className="h-4 w-4 text-gray-700" />
                  </button>
                </div>
              </div>
              <div className="p-3">
                <p className="text-sm font-medium line-clamp-2 min-h-[2.5rem]">{product.name}</p>
                {r && r.count > 0 && (
                  <div className="flex items-center gap-1 mt-1">
                    <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                    <span className="text-xs font-medium">{r.average.toFixed(1)}</span>
                    <span className="text-xs text-gray-400">({r.count})</span>
                  </div>
                )}
                <p className="text-lg font-bold mt-1" style={{ color: primaryColor }}>{formatPrice(product.price)}</p>
                {product.stock > 0 ? (
                  <p className="text-xs text-green-600 mt-1">Em estoque</p>
                ) : (product as any).made_to_order ? (
                  <p className="text-xs mt-1" style={{ color: primaryColor }}>📦 Sob encomenda</p>
                ) : (
                  <p className="text-xs text-red-500 mt-1">Esgotado</p>
                )}
                <Button
                  className="w-full mt-2"
                  size="sm"
                  style={{ backgroundColor: buttonColor, color: buttonTextColor }}
                  disabled={product.stock <= 0 && !(product as any).made_to_order}
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
        );
      })}
    </div>
  );
}
