import { useState, useMemo, useCallback, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { usePublicProducts } from "@/hooks/usePublicStore";
import Autoplay from "embla-carousel-autoplay";
import { useProductImages } from "@/hooks/useProductImages";
import { useProductVariants } from "@/hooks/useProductVariants";
import { useLojaContext } from "./LojaLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext } from "@/components/ui/carousel";
import { ShoppingCart, Package, ArrowLeft, MessageCircle, Truck, ShieldCheck, RotateCcw, Share2, Heart, AlertTriangle, Ruler, HelpCircle, ShoppingBag, Video, Eye, Loader2 } from "lucide-react";
import { useWishlist } from "@/hooks/useWishlist";
import { useBehaviorTracking } from "@/hooks/useBehaviorTracking";
import { ProductReviews } from "@/components/ProductReviews";
import { CartNotification, useCartNotification } from "@/components/storefront/CartNotification";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import paymentMethodsImg from "@/assets/payment-methods.png";
import securityBadgesImg from "@/assets/security-badges.png";

export default function LojaProduto() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { cart, settings, productPageConfig, storeUserId, openCart, basePath } = useLojaContext();
  const { data: products, isLoading: productsLoading } = usePublicProducts(storeUserId);
  const { data: productImages } = useProductImages(id);
  const { data: variants } = useProductVariants(id);
  const wishlist = useWishlist(storeUserId);
  const cartNotif = useCartNotification();
  const { trackEvent } = useBehaviorTracking(storeUserId);

  const product = products?.find((p) => p.id === id);

  const { allImages, allVideos } = useMemo(() => {
    const images: string[] = [];
    const videos: string[] = [];
    if (product?.image_url) {
      if (product.image_url.match(/\.(mp4|webm|ogg|mov|avi|mkv|flv|wmv)$/i)) {
        videos.push(product.image_url);
      } else {
        images.push(product.image_url);
      }
    }
    productImages?.forEach((img: any) => {
      const url = img.image_url;
      if (url?.match(/\.(mp4|webm|ogg|mov|avi|mkv|flv|wmv)$/i)) {
        if (!videos.includes(url)) videos.push(url);
      } else {
        if (!images.includes(url)) images.push(url);
      }
    });
    return { allImages: images, allVideos: videos };
  }, [product, productImages]);

  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});
  const [whatsappDialogOpen, setWhatsappDialogOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [isNavigating, setIsNavigating] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [navigatingProductId, setNavigatingProductId] = useState<string | null>(null);
  const [showStickyCart, setShowStickyCart] = useState(false);

  useEffect(() => {
    if (!productPageConfig?.enable_sticky_add_to_cart) return;

    const handleScroll = () => {
      const scrollPosition = window.scrollY;
      setShowStickyCart(scrollPosition > 600);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [productPageConfig?.enable_sticky_add_to_cart]);

  // Track recently viewed
  useEffect(() => {
    if (id && productPageConfig?.enable_recently_viewed) {
      const viewed = JSON.parse(localStorage.getItem("recently_viewed") || "[]");
      const filtered = viewed.filter((pid: string) => pid !== id);
      const newViewed = [id, ...filtered].slice(0, 10);
      localStorage.setItem("recently_viewed", JSON.stringify(newViewed));
    }
  }, [id, productPageConfig?.enable_recently_viewed]);

  // Increment view count and track behavior
  useEffect(() => {
    if (id) {
      const trackView = async () => {
        try {
          await supabase.rpc("increment_product_views", { product_id: id });
          await trackEvent("product_view", id, { name: product?.name });
        } catch (error) {
          console.error("Error tracking view:", error);
        }
      };
      trackView();
    }
  }, [id, trackEvent, product?.name]);

  const recentlyViewedProducts = useMemo(() => {
    if (!productPageConfig?.enable_recently_viewed || !products) return [];
    const viewedIds = JSON.parse(localStorage.getItem("recently_viewed") || "[]");
    return products.filter((p) => viewedIds.includes(p.id) && p.id !== id).slice(0, 8);
  }, [id, products, productPageConfig?.enable_recently_viewed]);

  const bestSellersInCategory = useMemo(() => {
    if (!productPageConfig?.enable_category_best_sellers || !product || !products) return [];
    return products
      .filter((p) => p.category_id === product.category_id && p.id !== product.id)
      .sort((a, b) => (b as any).sales_count - (a as any).sales_count)
      .slice(0, 8);
  }, [product, products, productPageConfig?.enable_category_best_sellers]);

  const handleProductClick = useCallback((e: React.MouseEvent, productId: string) => {
    e.preventDefault();
    setNavigatingProductId(productId);
    setIsNavigating(true);
    setTimeout(() => {
      navigate(`${basePath}/produto/${productId}`);
      window.scrollTo({ top: 0, behavior: "smooth" });
      setTimeout(() => { setIsNavigating(false); setNavigatingProductId(null); }, 300);
    }, 400);
  }, [navigate, basePath]);

  const variantGroups = useMemo(() => {
    if (!variants || variants.length === 0) return {};
    const groups: Record<string, typeof variants> = {};
    variants.forEach((v) => {
      if (!groups[v.variant_type]) groups[v.variant_type] = [];
      groups[v.variant_type].push(v);
    });
    return groups;
  }, [variants]);

  const variantTypeLabels: Record<string, string> = { color: "Cor", size: "Tamanho", model: "Modelo" };

  const effectivePrice = useMemo(() => {
    if (!product) return 0;
    let price = product.price;
    Object.values(selectedVariants).forEach((variantId) => {
      const v = variants?.find((vr) => vr.id === variantId);
      if (v) price += v.price_modifier;
    });
    return price;
  }, [product, selectedVariants, variants]);

  const similarProducts = useMemo(() => {
    if (!product || !products) return [];
    return products
      .filter((p) => p.id !== product.id && p.category_id === product.category_id)
      .slice(0, 8);
  }, [product, products]);

  const buyTogetherProduct = useMemo(() => {
    if (!productPageConfig?.enable_buy_together || !products || products.length < 2) return null;
    return products.find((p) => p.id !== product.id && p.category_id === product.category_id);
  }, [product, products, productPageConfig?.enable_buy_together]);

  const bundlePrice = useMemo(() => {
    if (!buyTogetherProduct) return 0;
    return (effectivePrice + buyTogetherProduct.price) * 0.95; // 5% discount
  }, [effectivePrice, buyTogetherProduct]);

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(price);

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: product?.name, text: `Confira: ${product?.name}`, url });
      } catch {}
    } else {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado!");
    }
  };

  const primaryColor = settings?.primary_color || "#6d28d9";
  const buttonColor = settings?.button_color || "#000000";
  const buttonTextColor = settings?.button_text_color || "#ffffff";

  if (productsLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 text-center">
        <Loader2 className="h-10 w-10 mx-auto animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground mt-4">Carregando produto...</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 text-center">
        <Package className="h-16 w-16 mx-auto text-muted-foreground" />
        <h2 className="text-xl font-bold mt-4">Produto não encontrado</h2>
        <Link to={basePath} className="text-sm text-muted-foreground hover:underline mt-2 inline-block">Voltar para a loja</Link>
      </div>
    );
  }

  return (
    <>
      {isNavigating && (
        <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center" style={{ animation: "fadeIn 0.3s ease-out" }}>
          <div className="absolute inset-0" style={{ background: `radial-gradient(circle at center, ${primaryColor}10, transparent 70%)`, animation: "scaleUp 0.5s ease-out" }} />
        </div>
      )}
    <div className="max-w-7xl mx-auto px-4 py-6">
      <style>{`
        @keyframes pdp-fade-up {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .pdp-reveal {
          animation: pdp-fade-up 0.5s ease-out both;
        }
        .pdp-reveal-d1 { animation-delay: 0.05s; }
        .pdp-reveal-d2 { animation-delay: 0.15s; }
        .pdp-reveal-d3 { animation-delay: 0.25s; }
        .pdp-reveal-d4 { animation-delay: 0.35s; }
        .pdp-reveal-d5 { animation-delay: 0.45s; }
      `}</style>
      <Link to={basePath} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4 pdp-reveal">
        <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Product images */}
        <div className="space-y-3 pdp-reveal pdp-reveal-d1">
          <div 
            onClick={() => productPageConfig?.enable_image_zoom && setIsZoomed(true)}
            className={`aspect-square bg-gray-50 rounded-lg overflow-hidden border border-border ${productPageConfig?.enable_image_zoom ? "group cursor-zoom-in" : ""}`}
          >
            {allImages.length > 0 ? (
              <img
                src={allImages[selectedImageIndex] || allImages[0]}
                alt={product.name}
                className={`w-full h-full object-contain transition-all duration-300 ${productPageConfig?.enable_image_zoom ? "group-hover:scale-150" : ""}`}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package className="h-24 w-24 text-gray-200" />
              </div>
            )}
          </div>
          {allImages.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {allImages.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedImageIndex(i)}
                  className="shrink-0 h-16 w-16 rounded-md overflow-hidden border-2 transition-colors"
                  style={{ borderColor: selectedImageIndex === i ? primaryColor : "#e5e7eb" }}
                >
                  <img src={img} alt={`${product.name} ${i + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}

          {/* Videos section below images */}
          {allVideos.length > 0 && (
            <div className="space-y-2 pt-2">
              <p className="text-sm font-medium flex items-center gap-1.5 text-foreground">
                <Video className="h-4 w-4" /> Vídeos do produto
              </p>
              <div className="space-y-3">
                {allVideos.map((videoUrl, i) => (
                  <div key={i} className="rounded-lg overflow-hidden border border-border">
                    <video
                      src={videoUrl}
                      controls
                      className="w-full max-h-[400px] object-contain bg-black"
                      preload="metadata"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Product info */}
        <div className="space-y-4 pdp-reveal pdp-reveal-d2">
          {(product as any).categories?.name && (
            <Badge variant="outline" style={{ borderColor: primaryColor, color: primaryColor }}>{(product as any).categories.name}</Badge>
          )}

          <div className="flex items-start justify-between gap-2">
            <h1 className="text-2xl md:text-3xl font-bold">{product.name}</h1>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => product && wishlist.toggleWishlist(product.id)} title="Favoritar">
                <Heart className={`h-5 w-5 transition-colors ${product && wishlist.isWishlisted(product.id) ? "fill-red-500 text-red-500" : ""}`} />
              </Button>
              <Button variant="ghost" size="icon" onClick={handleShare} title="Compartilhar">
                <Share2 className="h-5 w-5" />
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="space-y-1">
              <p className="text-3xl font-bold" style={{ color: primaryColor }}>{formatPrice(effectivePrice)}</p>
              {(() => {
                const maxInst = (settings as any)?.max_installments || 12;
                return maxInst > 1 ? (
                  <p className="text-sm text-emerald-500 dark:text-emerald-400">
                    ou {maxInst}x de {formatPrice(effectivePrice / maxInst)} sem juros
                  </p>
                ) : (
                  <p className="text-sm text-emerald-500 dark:text-emerald-400">à vista</p>
                );
              })()}
            </div>
            
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 rounded-full border border-gray-100 shadow-sm animate-pulse" title="Visualizações reais deste produto">
              <Eye className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold text-muted-foreground">
                {product.views || 0} visualizações
              </span>
            </div>
          </div>

          {/* Variant selectors */}
          {Object.keys(variantGroups).length > 0 && (
            <div className="space-y-3">
              {Object.entries(variantGroups).map(([type, vars]) => (
                <div key={type} className="space-y-2">
                  <Label className="text-sm font-medium">{variantTypeLabels[type] || type}</Label>
                  <div className="flex flex-wrap gap-2">
                    {vars.map((v) => (
                      <button
                        key={v.id}
                        onClick={() => setSelectedVariants((prev) => ({ ...prev, [type]: prev[type] === v.id ? "" : v.id }))}
                        disabled={v.stock === 0}
                        className="px-3 py-1.5 rounded-lg border text-sm font-medium transition-all"
                        style={
                          selectedVariants[type] === v.id
                            ? { borderColor: primaryColor, backgroundColor: primaryColor, color: "#fff" }
                            : v.stock === 0
                            ? { borderColor: "#e5e7eb", color: "#d1d5db", cursor: "not-allowed", textDecoration: "line-through" }
                            : { borderColor: "#d1d5db" }
                        }
                      >
                        {v.variant_value}
                        {v.stock > 0 && v.stock <= 3 && <span className="text-[10px] ml-1 text-amber-500">(últimas {v.stock})</span>}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {product.stock > 0 ? (
            <Badge className="bg-green-100 text-green-800">Em estoque ({product.stock} unid.)</Badge>
          ) : (product as any).made_to_order ? (
            <Badge style={{ backgroundColor: `${primaryColor}20`, color: primaryColor }}>📦 Sob encomenda</Badge>
          ) : (
            <Badge variant="destructive">Esgotado</Badge>
          )}
          
          {productPageConfig?.enable_stock_urgency && product.stock > 0 && product.stock <= (productPageConfig?.stock_urgency_threshold || 5) && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 animate-pulse">
              <AlertTriangle className="h-4 w-4" />
              <p className="text-sm font-bold">Corra! Restam apenas {product.stock} unidades em estoque!</p>
            </div>
          )}

          <div className="flex gap-3">
            <Button
              className="flex-1 h-12 text-sm sm:text-base px-2 whitespace-nowrap"
              style={{ backgroundColor: buttonColor, color: buttonTextColor }}
              disabled={product.stock <= 0 && !(product as any).made_to_order}
              onClick={() => { cart.addItem({ id: product.id, name: product.name, price: effectivePrice, image_url: product.image_url }); cartNotif.show(product.name, product.image_url); }}
            >
              <ShoppingCart className="mr-2 h-5 w-5 shrink-0" /> <span className="truncate">Adicionar ao Carrinho</span>
            </Button>
            {settings?.sell_via_whatsapp && settings?.store_whatsapp && (
              <Button
                variant="outline"
                className="border-green-500 text-emerald-500 dark:text-emerald-400 hover:bg-emerald-500/10 h-12"
                onClick={() => setWhatsappDialogOpen(true)}
              >
                <MessageCircle className="mr-2 h-5 w-5" /> WhatsApp
              </Button>
            )}
          </div>

          {/* WhatsApp Name Dialog */}
          <Dialog open={whatsappDialogOpen} onOpenChange={setWhatsappDialogOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <MessageCircle className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />
                  Falar pelo WhatsApp
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Informe seu nome para enviarmos uma mensagem sobre este produto.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="customer-name">Seu nome</Label>
                  <Input
                    id="customer-name"
                    placeholder="Digite seu nome..."
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                  />
                </div>
                <div className="rounded-lg border p-3 bg-muted/50 text-sm space-y-1">
                  <p className="font-medium">{product.name}</p>
                  <p className="text-muted-foreground">{formatPrice(effectivePrice)}</p>
                </div>
                <Button
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                  disabled={!customerName.trim()}
                  onClick={() => {
                    const selectedVarText = Object.entries(selectedVariants)
                      .filter(([, val]) => val)
                      .map(([type, varId]) => {
                        const v = variants?.find((vr) => vr.id === varId);
                        return v ? `${variantTypeLabels[type] || type}: ${v.variant_value}` : "";
                      })
                      .filter(Boolean)
                      .join("\n");

                    const text = `Olá! Meu nome é *${customerName.trim()}* e tenho interesse no produto:\n\n📦 *${product.name}*\n💰 Preço: *${formatPrice(effectivePrice)}*${selectedVarText ? `\n🏷️ ${selectedVarText}` : ""}\n\nGostaria de mais informações!`;
                    window.open(
                      `https://wa.me/${settings!.store_whatsapp!.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`,
                      "_blank"
                    );
                    setWhatsappDialogOpen(false);
                    setCustomerName("");
                  }}
                >
                  <MessageCircle className="mr-2 h-4 w-4" /> Enviar Mensagem
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Separator />

          {productPageConfig?.enable_trust_badges && (
            <div className="flex flex-col items-center gap-4 py-4 pdp-reveal pdp-reveal-d3">
              <p className="text-sm font-semibold text-muted-foreground">Formas de pagamento</p>
              <img src={paymentMethodsImg} alt="Formas de pagamento aceitas" className="w-full max-w-sm object-contain" />
              <div className="bg-muted/50 rounded-xl p-3 border border-border">
                <img src={securityBadgesImg} alt="Site Seguro - SSL Certificado" className="w-full max-w-xs object-contain" />
              </div>
            </div>
          )}

          {productPageConfig?.enable_delivery_estimation && (
            <div className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-700">
              <Truck className="h-4 w-4" />
              <p className="text-sm">Prazo estimado de entrega: <span className="font-bold">{productPageConfig.delivery_estimation_text || "3-7 dias úteis"}</span></p>
            </div>
          )}

          {productPageConfig?.enable_size_guide && productPageConfig.size_guide_content && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Ruler className="h-4 w-4" />
                <h4 className="text-sm font-bold">Guia de Tamanhos</h4>
              </div>
              <p className="text-sm text-slate-600 whitespace-pre-wrap">{productPageConfig.size_guide_content}</p>
            </div>
          )}

          {productPageConfig?.enable_faq && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <HelpCircle className="h-4 w-4" />
                <h4 className="text-sm font-bold">Dúvidas Frequentes</h4>
              </div>
              <p className="text-xs text-slate-500 italic">Consulte nossa central de atendimento para mais detalhes.</p>
        </div>
      )}

      {/* Recently Viewed */}
      {productPageConfig?.enable_recently_viewed && recentlyViewedProducts.length > 0 && (
        <div className="mt-12 pdp-reveal pdp-reveal-d4">
          <h2 className="text-xl font-bold mb-4 pb-2" style={{ borderBottom: `2px solid ${primaryColor}20` }}>Vistos Recentemente</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
            {recentlyViewedProducts.map((p) => (
              <Link
                key={p.id}
                to={`${basePath}/produto/${p.id}`}
                className="block group"
              >
                <div className="aspect-square bg-gray-50 rounded-lg overflow-hidden border border-gray-100 group-hover:border-primary transition-colors mb-2">
                  <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                </div>
                <p className="text-xs font-medium line-clamp-1">{p.name}</p>
                <p className="text-xs font-bold" style={{ color: primaryColor }}>{formatPrice(p.price)}</p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Category Best Sellers */}
      {productPageConfig?.enable_category_best_sellers && bestSellersInCategory.length > 0 && (
        <div className="mt-12 pdp-reveal pdp-reveal-d5">
          <h2 className="text-xl font-bold mb-4 pb-2" style={{ borderBottom: `2px solid ${primaryColor}20` }}>Mais Vendidos da Categoria</h2>
          <Carousel
            opts={{ align: "start" }}
            className="w-full"
          >
            <CarouselContent className="-ml-3">
              {bestSellersInCategory.map((p) => (
                <CarouselItem key={p.id} className="pl-3 basis-1/2 sm:basis-1/3 md:basis-1/4 lg:basis-1/5">
                  <Link to={`${basePath}/produto/${p.id}`} className="group block">
                    <Card className="overflow-hidden border-gray-200">
                      <div className="aspect-square bg-gray-50 overflow-hidden">
                        <img src={p.image_url} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      </div>
                      <div className="p-3">
                        <p className="text-sm font-medium line-clamp-2">{p.name}</p>
                        <p className="text-sm font-bold mt-1" style={{ color: primaryColor }}>{formatPrice(p.price)}</p>
                      </div>
                    </Card>
                  </Link>
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
        </div>
      )}

      {/* Sticky Cart Bar */}
      {productPageConfig?.enable_sticky_add_to_cart && showStickyCart && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border p-4 shadow-lg animate-in fade-in slide-in-from-bottom-full duration-300 md:hidden lg:flex items-center justify-center">
          <div className="max-w-7xl w-full flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 hidden md:flex">
              <img src={product.image_url} alt={product.name} className="h-12 w-12 rounded object-cover" />
              <div>
                <p className="text-sm font-bold line-clamp-1">{product.name}</p>
                <p className="text-xs text-muted-foreground">{formatPrice(effectivePrice)}</p>
              </div>
            </div>
            <div className="flex-1 md:max-w-xs">
              <Button
                className="w-full h-11"
                style={{ backgroundColor: buttonColor, color: buttonTextColor }}
                onClick={() => { cart.addItem({ id: product.id, name: product.name, price: effectivePrice, image_url: product.image_url }); cartNotif.show(product.name, product.image_url); }}
              >
                <ShoppingCart className="mr-2 h-4 w-4" /> Comprar Agora
              </Button>
            </div>
          </div>
        </div>
      )}

          {product.description && (
            <>
              <Separator />
              <div>
                <h3 className="font-bold mb-2">Descrição</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{product.description}</p>
              </div>
            </>
          )}

          {productPageConfig?.enable_buy_together && buyTogetherProduct && (
            <div className="mt-6 p-4 border border-primary/20 rounded-xl bg-primary/5 space-y-4">
              <h3 className="font-bold flex items-center gap-2">
                <ShoppingBag className="h-5 w-5 text-primary" />
                Compre Junto e Ganhe 5% OFF
              </h3>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 flex-1">
                  <div className="h-16 w-16 rounded-lg overflow-hidden border border-border shrink-0 bg-card">
                    <img src={product.image_url} alt={product.name} className="w-full h-full object-contain" />
                  </div>
                  <span className="text-xl font-bold text-muted-foreground">+</span>
                  <div className="h-16 w-16 rounded-lg overflow-hidden border border-border shrink-0 bg-card">
                    <img src={buyTogetherProduct.image_url} alt={buyTogetherProduct.name} className="w-full h-full object-contain" />
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground line-through">{formatPrice(effectivePrice + buyTogetherProduct.price)}</p>
                  <p className="text-xl font-black text-primary">{formatPrice(bundlePrice)}</p>
                </div>
              </div>
              <Button 
                className="w-full h-11" 
                style={{ backgroundColor: buttonColor, color: buttonTextColor }}
                onClick={() => {
                  cart.addItem({ id: product.id, name: product.name, price: effectivePrice, image_url: product.image_url });
                  cart.addItem({ id: buyTogetherProduct.id, name: buyTogetherProduct.name, price: buyTogetherProduct.price, image_url: buyTogetherProduct.image_url });
                  cartNotif.show("Combo Adicionado!", product.image_url);
                  openCart();
                }}
              >
                Adicionar Ambos ao Carrinho
              </Button>
            </div>
          )}
        </div>
      </div>

      {productPageConfig?.enable_reviews && (
        <ProductReviews productId={product.id} />
      )}

      {/* Similar Products Carousel */}
      {productPageConfig?.enable_related_products !== false && similarProducts.length > 0 && (
        <div className="mt-12">
          <h2 className="text-xl font-bold mb-4 pb-2" style={{ borderBottom: `2px solid ${primaryColor}20` }}>Produtos Similares</h2>
          <Carousel
            opts={{ align: "start", loop: similarProducts.length > 4 }}
            plugins={[Autoplay({ delay: 3000, stopOnInteraction: true, stopOnMouseEnter: true })]}
            className="w-full"
          >
            <CarouselContent className="-ml-3">
              {similarProducts.map((p) => (
                <CarouselItem key={p.id} className="pl-3 basis-1/2 sm:basis-1/3 md:basis-1/4 lg:basis-1/5">
                  <a
                    href={`${basePath}/produto/${p.id}`}
                    onClick={(e) => handleProductClick(e, p.id)}
                    className="group block"
                  >
                    <Card
                      className="overflow-hidden border-gray-200 hover:shadow-xl transition-all duration-500 hover:-translate-y-1"
                      style={{
                        transition: "all 0.5s cubic-bezier(0.4,0,0.2,1)",
                        ...(navigatingProductId === p.id
                          ? { transform: "scale(0.92)", opacity: 0.5, boxShadow: `0 0 30px ${primaryColor}40` }
                          : {}),
                      }}
                    >
                      <div className="aspect-square bg-gray-50 overflow-hidden relative">
                        {p.image_url ? (
                          <img src={p.image_url} alt={p.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center"><Package className="h-8 w-8 text-muted-foreground" /></div>
                        )}
                        <div
                          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                          style={{ background: `linear-gradient(to top, ${primaryColor}18, transparent 60%)` }}
                        />
                      </div>
                      <div className="p-3">
                        <p className="text-sm font-medium line-clamp-2">{p.name}</p>
                        <p className="text-lg font-bold mt-1" style={{ color: primaryColor }}>{formatPrice(p.price)}</p>
                      </div>
                    </Card>
                  </a>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="left-0" />
            <CarouselNext className="right-0" />
          </Carousel>
        </div>
      )}
      <Dialog open={isZoomed} onOpenChange={setIsZoomed}>
        <DialogContent className="max-w-[98vw] max-h-[98vh] p-0 border-none bg-black/90 shadow-none flex items-center justify-center">
          <div className="relative w-full h-full flex items-center justify-center overflow-auto p-4">
             <img 
               src={allImages[selectedImageIndex] || allImages[0]} 
               alt={product?.name || "Product"} 
               className="max-w-full max-h-[90vh] object-contain cursor-zoom-out"
               onClick={() => setIsZoomed(false)}
             />
             <Button
               variant="ghost"
               size="icon"
               className="absolute top-2 right-2 text-white hover:bg-white/20 rounded-full"
               onClick={() => setIsZoomed(false)}
             >
               <X className="h-6 w-6" />
             </Button>
          </div>
        </DialogContent>
      </Dialog>

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
    </>
  );
}
