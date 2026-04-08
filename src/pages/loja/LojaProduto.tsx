import { useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { usePublicProducts } from "@/hooks/usePublicStore";
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
import { ShoppingCart, Package, ArrowLeft, MessageCircle, Truck, ShieldCheck, RotateCcw, Share2, Heart } from "lucide-react";
import { useWishlist } from "@/hooks/useWishlist";
import { ProductReviews } from "@/components/ProductReviews";
import { CartNotification, useCartNotification } from "@/components/storefront/CartNotification";
import { toast } from "sonner";

export default function LojaProduto() {
  const { id, slug } = useParams();
  const { cart, settings, storeUserId } = useLojaContext();
  const { data: products } = usePublicProducts(storeUserId);
  const { data: productImages } = useProductImages(id);
  const { data: variants } = useProductVariants(id);
  const wishlist = useWishlist(storeUserId);
  const cartNotif = useCartNotification();

  const product = products?.find((p) => p.id === id);
  const basePath = slug ? `/loja/${slug}` : "/loja";

  const allImages = useMemo(() => {
    const images: string[] = [];
    if (product?.image_url) images.push(product.image_url);
    productImages?.forEach((img: any) => {
      if (!images.includes(img.image_url)) images.push(img.image_url);
    });
    return images;
  }, [product, productImages]);

  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});
  const [whatsappDialogOpen, setWhatsappDialogOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");

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

  if (!product) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 text-center">
        <Package className="h-16 w-16 mx-auto text-gray-300" />
        <h2 className="text-xl font-bold mt-4">Produto não encontrado</h2>
        <Link to={basePath} className="text-sm text-gray-500 hover:underline mt-2 inline-block">Voltar para a loja</Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <Link to={basePath} className="inline-flex items-center text-sm text-gray-500 hover:text-black mb-4">
        <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Product images */}
        <div className="space-y-3">
          <div className="aspect-square bg-gray-50 rounded-lg overflow-hidden border border-gray-200">
            {allImages.length > 0 ? (
              <img
                src={allImages[selectedImageIndex] || allImages[0]}
                alt={product.name}
                className="w-full h-full object-contain transition-opacity duration-300"
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
        </div>

        {/* Product info */}
        <div className="space-y-4">
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

          <div className="space-y-1">
            <p className="text-3xl font-bold" style={{ color: primaryColor }}>{formatPrice(effectivePrice)}</p>
            <p className="text-sm text-green-600">
              ou 12x de {formatPrice(effectivePrice / 12)} sem juros
            </p>
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

          <div className="flex gap-3">
            <Button
              className="flex-1 h-12 text-base"
              style={{ backgroundColor: buttonColor, color: buttonTextColor }}
              disabled={product.stock <= 0 && !(product as any).made_to_order}
              onClick={() => { cart.addItem({ id: product.id, name: product.name, price: effectivePrice, image_url: product.image_url }); cartNotif.show(product.name, product.image_url); }}
            >
              <ShoppingCart className="mr-2 h-5 w-5" /> Adicionar ao Carrinho
            </Button>
            {settings?.sell_via_whatsapp && settings?.store_whatsapp && (
              <Button
                variant="outline"
                className="border-green-500 text-green-600 hover:bg-green-50 h-12"
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
                  <MessageCircle className="h-5 w-5 text-green-600" />
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

          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: Truck, label: "Entrega rápida" },
              { icon: ShieldCheck, label: "Compra segura" },
              { icon: RotateCcw, label: "Troca fácil" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="text-center p-3 rounded-lg" style={{ backgroundColor: `${primaryColor}10` }}>
                <Icon className="h-5 w-5 mx-auto" style={{ color: primaryColor }} />
                <p className="text-xs mt-1 text-gray-600">{label}</p>
              </div>
            ))}
          </div>

          {product.description && (
            <>
              <Separator />
              <div>
                <h3 className="font-bold mb-2">Descrição</h3>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{product.description}</p>
              </div>
            </>
          )}
        </div>
      </div>

      <ProductReviews productId={product.id} />

      {/* Similar Products Carousel */}
      {similarProducts.length > 0 && (
        <div className="mt-12">
          <h2 className="text-xl font-bold mb-4 pb-2" style={{ borderBottom: `2px solid ${primaryColor}20` }}>Produtos Similares</h2>
          <Carousel opts={{ align: "start", loop: similarProducts.length > 4 }} className="w-full">
            <CarouselContent className="-ml-3">
              {similarProducts.map((p) => (
                <CarouselItem key={p.id} className="pl-3 basis-1/2 sm:basis-1/3 md:basis-1/4 lg:basis-1/5">
                  <Link to={`${basePath}/produto/${p.id}`} className="group block">
                    <Card className="overflow-hidden border-gray-200 hover:shadow-lg transition-shadow">
                      <div className="aspect-square bg-gray-50 overflow-hidden">
                        {p.image_url ? (
                          <img src={p.image_url} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center"><Package className="h-8 w-8 text-gray-300" /></div>
                        )}
                      </div>
                      <div className="p-3">
                        <p className="text-sm font-medium line-clamp-2">{p.name}</p>
                        <p className="text-lg font-bold mt-1" style={{ color: primaryColor }}>{formatPrice(p.price)}</p>
                      </div>
                    </Card>
                  </Link>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="left-0" />
            <CarouselNext className="right-0" />
          </Carousel>
        </div>
      )}
      {cartNotif.notification && (
        <CartNotification
          productName={cartNotif.notification.productName}
          productImage={cartNotif.notification.productImage}
          basePath={basePath}
          buttonColor={buttonColor}
          buttonTextColor={buttonTextColor}
          onClose={cartNotif.hide}
        />
      )}
    </div>
  );
}
