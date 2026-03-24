import { useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { usePublicProducts } from "@/hooks/usePublicStore";
import { useLojaContext } from "./LojaLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ShoppingCart, Package, ArrowLeft, MessageCircle, Truck, ShieldCheck, RotateCcw } from "lucide-react";

export default function LojaProduto() {
  const { id } = useParams();
  const { data: products } = usePublicProducts();
  const { cart, settings } = useLojaContext();

  const product = products?.find((p) => p.id === id);
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
      {/* Breadcrumb */}
      <Link to="/loja" className="inline-flex items-center text-sm text-gray-500 hover:text-black mb-4">
        <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Product image */}
        <div className="aspect-square bg-gray-50 rounded-lg overflow-hidden border border-gray-200">
          {product.image_url ? (
            <img src={product.image_url} alt={product.name} className="w-full h-full object-contain" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="h-24 w-24 text-gray-200" />
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
            <p className="text-3xl font-bold">{formatPrice(product.price)}</p>
            <p className="text-sm text-green-600">
              ou 12x de {formatPrice(product.price / 12)} sem juros
            </p>
          </div>

          {product.stock > 0 ? (
            <Badge className="bg-green-100 text-green-800">Em estoque ({product.stock} unid.)</Badge>
          ) : (
            <Badge variant="destructive">Esgotado</Badge>
          )}

          <div className="flex gap-3">
            <Button
              className="flex-1 bg-black text-white hover:bg-gray-800 h-12 text-base"
              disabled={product.stock <= 0}
              onClick={() => cart.addItem({ id: product.id, name: product.name, price: product.price, image_url: product.image_url })}
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

          {/* Info cards */}
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

      {/* Similar products */}
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
