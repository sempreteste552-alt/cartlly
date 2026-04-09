import { useMemo, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { usePublicProducts, usePublicCategories, useAllProductReviews, useBestSellingProducts } from "@/hooks/usePublicStore";
import { usePublicBanners } from "@/hooks/useStoreBanners";
import { usePublicProductImages } from "@/hooks/useProductImages";
import { useLojaContext } from "./LojaLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Star, Share2, Heart, Award } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductImageSlideshow } from "@/components/ProductImageSlideshow";
import { useWishlist } from "@/hooks/useWishlist";
import { DynamicHomeSections } from "@/components/storefront/DynamicHomeSections";
import { HighlightsSection } from "@/components/storefront/sections/HighlightsSection";
import { ActiveCouponsBanner } from "@/components/storefront/ActiveCouponsBanner";
import { BannerCarousel } from "@/components/storefront/BannerCarousel";
import { useStaggeredReveal, useScrollReveal } from "@/hooks/useScrollReveal";
import { CartNotification, useCartNotification } from "@/components/storefront/CartNotification";
import { toast } from "sonner";

export default function LojaHome() {
  const location = useLocation();
  const { cart, searchTerm, settings, storeUserId, openCart, basePath } = useLojaContext();

  // Smooth scroll to top on page load
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [location.pathname]);
  const { data: products, isLoading: prodLoading } = usePublicProducts(storeUserId);
  const { data: banners } = usePublicBanners(storeUserId);
  const { data: categories } = usePublicCategories(storeUserId);
  const wishlist = useWishlist(storeUserId);
  const cartNotif = useCartNotification();

  const productIds = useMemo(() => products?.map((p) => p.id) ?? [], [products]);
  const { data: ratings } = useAllProductReviews(productIds);
  const { data: productImagesMap } = usePublicProductImages(productIds);
  const { data: bestSellers } = useBestSellingProducts(storeUserId);

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
        <h1 className="text-3xl font-bold text-center text-foreground">Loja em Construção</h1>
        <p className="text-muted-foreground mt-3 text-center max-w-md">
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
    <div className="space-y-6">
      {!searchTerm.trim() && (
        <>
          {/* 1. Banner - logo abaixo do cabeçalho */}
          {banners && banners.length > 0 && (
            <BannerCarousel banners={banners} mobileFormat={(settings as any)?.banner_mobile_format || "landscape"} />
          )}

          {/* 2. Destaques (Stories) - abaixo do banner */}
          <HighlightsSection storeUserId={storeUserId} primaryColor={primaryColor} />

          {/* 2.5. Cupons ativos */}
          <ActiveCouponsBanner storeUserId={storeUserId} primaryColor={primaryColor} />

          {/* 3. Seções dinâmicas (produtos em destaque, etc.) */}
          <DynamicHomeSections
            storeUserId={storeUserId}
            products={products || []}
            settings={settings}
            cart={cart}
            basePath={basePath}
            onAddToCart={cartNotif.show}
          />
        </>
      )}

      {!searchTerm.trim() && categories && categories.length > 0 && (
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
                onClick={() => {
                   const el = document.getElementById(`category-${cat.name}`);
                   if (el) {
                     const yOffset = -80;
                     const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
                     window.scrollTo({ top: y, behavior: "smooth" });
                   }
                 }}
              >
                {cat.name}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <div className={`max-w-7xl mx-auto px-4 ${searchTerm.trim() ? "mt-4" : "mt-8"} space-y-10 pb-8`}>
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
            <ProductGrid products={filtered} formatPrice={formatPrice} cart={cart} ratings={ratings} productImagesMap={productImagesMap} bestSellers={bestSellers} buttonColor={buttonColor} buttonTextColor={buttonTextColor} primaryColor={primaryColor} accentColor={accentColor} wishlist={wishlist} basePath={basePath} onAddToCart={cartNotif.show} />
          </>
        ) : (
          Object.entries(groupedByCategory).map(([catName, catProducts]) => (
            <CategorySection
              key={catName}
              catName={catName}
              catProducts={catProducts}
              formatPrice={formatPrice}
              cart={cart}
              ratings={ratings}
              productImagesMap={productImagesMap}
              bestSellers={bestSellers}
              buttonColor={buttonColor}
              buttonTextColor={buttonTextColor}
              primaryColor={primaryColor}
              accentColor={accentColor}
              wishlist={wishlist}
              basePath={basePath}
              onAddToCart={cartNotif.show}
            />
          ))
        )}
      </div>

      {cartNotif.notification && (
        <CartNotification
          productName={cartNotif.notification.productName}
          productImage={cartNotif.notification.productImage}
          buttonColor={buttonColor}
          buttonTextColor={buttonTextColor}
          onClose={cartNotif.hide}
          onOpenCart={openCart}
        />
      )}
    </div>
  );
}

function CategorySection({ catName, catProducts, ...gridProps }: {
  catName: string;
  catProducts: any[];
  formatPrice: (p: number) => string;
  cart: any;
  ratings?: Record<string, { average: number; count: number }>;
  productImagesMap?: Record<string, string[]>;
  bestSellers?: Set<string>;
  buttonColor: string;
  buttonTextColor: string;
  primaryColor: string;
  accentColor: string;
  wishlist: any;
  basePath: string;
  onAddToCart: (name: string, image?: string | null) => void;
}) {
  const { ref: titleRef, isVisible: titleVisible } = useScrollReveal<HTMLDivElement>();

  return (
    <div id={`category-${catName}`}>
      <div
        ref={titleRef}
        className="mb-4 pb-2 overflow-hidden"
        style={{ borderBottom: `2px solid ${gridProps.primaryColor}20` }}
      >
        <h2
          className="text-xl font-bold transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
          style={{
            opacity: titleVisible ? 1 : 0,
            transform: titleVisible ? "translateY(0)" : "translateY(100%)",
          }}
        >
          {catName}
        </h2>
      </div>
      <ProductGrid products={catProducts} {...gridProps} />
    </div>
  );
}

function ProductGrid({ products, formatPrice, cart, ratings, productImagesMap, bestSellers, buttonColor, buttonTextColor, primaryColor, accentColor, wishlist, basePath, onAddToCart }: {
  products: any[];
  formatPrice: (p: number) => string;
  cart: ReturnType<typeof import("@/hooks/useCart").useCart>;
  ratings?: Record<string, { average: number; count: number }>;
  productImagesMap?: Record<string, string[]>;
  bestSellers?: Set<string>;
  buttonColor: string;
  buttonTextColor: string;
  primaryColor: string;
  accentColor: string;
  wishlist: ReturnType<typeof import("@/hooks/useWishlist").useWishlist>;
  basePath: string;
  onAddToCart: (name: string, image?: string | null) => void;
}) {
  const { ref, getItemStyle } = useStaggeredReveal(products.length, 70);

  const handleShare = async (e: React.MouseEvent, product: any) => {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}${basePath}/produto/${product.id}`;
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
    <div ref={ref} className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      {products.map((product, index) => {
        const r = ratings?.[product.id];
        const additionalImages = productImagesMap?.[product.id] ?? [];
        const mainImage = product.image_url || additionalImages[0] || null;
        const extraImages = product.image_url 
          ? additionalImages 
          : additionalImages.slice(1);
        return (
          <Link key={product.id} to={`${basePath}/produto/${product.id}`} className="group" style={getItemStyle(index)}>
            <Card className="overflow-hidden border-border transition-all duration-300 hover:shadow-xl hover:-translate-y-1 relative bg-card">
              <div
                className="absolute -inset-[1px] rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none -z-10"
                style={{ background: `linear-gradient(135deg, ${primaryColor}40, ${accentColor}40, ${primaryColor}20)`, filter: "blur(8px)" }}
              />
              <div className="aspect-square overflow-hidden relative">
                <ProductImageSlideshow mainImage={mainImage} additionalImages={extraImages} alt={product.name} className="h-full w-full" showArrows autoplaySpeed={3500} glowColor={primaryColor} />
                <div className="absolute top-2 right-2 flex flex-col gap-1 z-10">
                  <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); wishlist.toggleWishlist(product.id); }} className="h-8 w-8 rounded-full bg-card/80 backdrop-blur-sm flex items-center justify-center hover:bg-card shadow-sm transition-all hover:scale-110" title="Favoritar">
                    <Heart className={`h-4 w-4 transition-colors ${wishlist.isWishlisted(product.id) ? "fill-red-500 text-red-500" : "text-foreground"}`} />
                  </button>
                  <button onClick={(e) => handleShare(e, product)} className="h-8 w-8 rounded-full bg-card/80 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-card shadow-sm hover:scale-110" title="Compartilhar">
                    <Share2 className="h-4 w-4 text-foreground" />
                  </button>
                </div>
                {new Date(product.created_at).getTime() > Date.now() - 7 * 86400000 && (
                  <div className="absolute top-2 left-2 z-10">
                    <Badge className="text-[10px] font-bold px-1.5 py-0.5 shadow-sm" style={{ backgroundColor: accentColor, color: "#fff" }}>NOVO</Badge>
                  </div>
                )}
                {bestSellers?.has(product.id) && (
                  <div className="absolute bottom-2 left-2 z-10">
                    <Badge className="text-[10px] font-bold px-1.5 py-0.5 shadow-sm flex items-center gap-0.5" style={{ backgroundColor: "#f59e0b", color: "#fff" }}>
                      <Award className="h-3 w-3" /> RECOMENDADO
                    </Badge>
                  </div>
                )}
              </div>
              <div className="p-3 text-foreground">
                <p className="text-sm font-medium line-clamp-2 min-h-[2.5rem]">{product.name}</p>
                {r && r.count > 0 && (
                  <div className="flex items-center gap-1 mt-1">
                    <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                    <span className="text-xs font-medium">{r.average.toFixed(1)}</span>
                    <span className="text-xs text-muted-foreground">({r.count})</span>
                  </div>
                )}
                <p className="text-lg font-bold mt-1" style={{ color: primaryColor }}>{formatPrice(product.price)}</p>
                <p className="text-[10px] text-muted-foreground">ou 12x de {formatPrice(product.price / 12)}</p>
                {product.stock > 0 ? (
                  <p className="text-xs text-green-600 mt-1">Em estoque</p>
                ) : (product as any).made_to_order ? (
                  <p className="text-xs mt-1" style={{ color: primaryColor }}>📦 Sob encomenda</p>
                ) : (
                  <p className="text-xs text-red-500 mt-1">Esgotado</p>
                )}
                <Button className="w-full mt-2 transition-transform active:scale-95" size="sm" style={{ backgroundColor: buttonColor, color: buttonTextColor }} disabled={product.stock <= 0 && !(product as any).made_to_order} onClick={(e) => { e.preventDefault(); cart.addItem({ id: product.id, name: product.name, price: product.price, image_url: product.image_url }); onAddToCart(product.name, product.image_url); }}>
                  <ShoppingCart className="mr-1 h-3 w-3" /> Adicionar ao Carrinho
                </Button>
              </div>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
