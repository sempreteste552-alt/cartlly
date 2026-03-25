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
import { ShoppingCart, Package, ArrowLeft, MessageCircle, Truck, ShieldCheck, RotateCcw } from "lucide-react";
import { ProductReviews } from "@/components/ProductReviews";

export default function LojaProduto() {
  const { id } = useParams();
  const { data: products } = usePublicProducts();
  const { data: productImages } = useProductImages(id);
  const { data: variants } = useProductVariants(id);
  const { cart, settings } = useLojaContext();

  const product = products?.find((p) => p.id === id);

  // All images: main + additional
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
  // Group variants by type
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

  // Calculate price with variant modifiers
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
      .slice(0, 5);
  }, [product, products]);

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(price);

  if (!product) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 text-center">
        <Package className="h-16 w-16 mx-auto text-gray-300" />
        <h2 className="text-xl font-bold mt-4">Produto não encontrado</h2>
        <Link to="/loja" className="text-sm text-gray-500 hover:underline mt-2 inline-block">Voltar para a loja</Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <Link to="/loja" className="inline-flex items-center text-sm text-gray-500 hover:text-black mb-4">
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
          {/* Thumbnail strip */}
          {allImages.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {allImages.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedImageIndex(i)}
                  className={`shrink-0 h-16 w-16 rounded-md overflow-hidden border-2 transition-colors ${
                    selectedImageIndex === i ? "border-black" : "border-gray-200 hover:border-gray-400"
                  }`}
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
            <Badge variant="outline">{(product as any).categories.name}</Badge>
          )}

          <h1 className="text-2xl md:text-3xl font-bold">{product.name}</h1>

          <div className="space-y-1">
            <p className="text-3xl font-bold">{formatPrice(effectivePrice)}</p>
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
                        className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-all ${
                          selectedVariants[type] === v.id
                            ? "border-black bg-black text-white"
                            : v.stock === 0
                            ? "border-gray-200 text-gray-300 cursor-not-allowed line-through"
                            : "border-gray-300 hover:border-black"
                        }`}
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
          ) : (
            <Badge variant="destructive">Esgotado</Badge>
          )}

          <div className="flex gap-3">
            <Button
              className="flex-1 bg-black text-white hover:bg-gray-800 h-12 text-base"
              disabled={product.stock <= 0}
              onClick={() => cart.addItem({ id: product.id, name: product.name, price: effectivePrice, image_url: product.image_url })}
            >
              <ShoppingCart className="mr-2 h-5 w-5" /> Adicionar ao Carrinho
            </Button>
            {settings?.sell_via_whatsapp && settings?.store_whatsapp && (
              <Button
                variant="outline"
                className="border-green-500 text-green-600 hover:bg-green-50 h-12"
                onClick={() => {
                  const text = `Olá! Tenho interesse no produto:\n\n${product.name}\nPreço: ${formatPrice(product.price)}\n\n${product.image_url || ""}`;
                  window.open(`https://wa.me/${settings.store_whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`, "_blank");
                }}
              >
                <MessageCircle className="mr-2 h-5 w-5" /> WhatsApp
              </Button>
            )}
          </div>

          <Separator />

          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-3 rounded-lg bg-gray-50">
              <Truck className="h-5 w-5 mx-auto text-gray-600" />
              <p className="text-xs mt-1 text-gray-600">Entrega rápida</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-gray-50">
              <ShieldCheck className="h-5 w-5 mx-auto text-gray-600" />
              <p className="text-xs mt-1 text-gray-600">Compra segura</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-gray-50">
              <RotateCcw className="h-5 w-5 mx-auto text-gray-600" />
              <p className="text-xs mt-1 text-gray-600">Troca fácil</p>
            </div>
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

      {similarProducts.length > 0 && (
        <div className="mt-12">
          <h2 className="text-xl font-bold mb-4 border-b border-gray-200 pb-2">Produtos Similares</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {similarProducts.map((p) => (
              <Link key={p.id} to={`/loja/produto/${p.id}`} className="group">
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
                    <p className="text-lg font-bold mt-1">{formatPrice(p.price)}</p>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
