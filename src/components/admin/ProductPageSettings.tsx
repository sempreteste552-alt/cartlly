import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, Video, ZoomIn, ShoppingCart, Star, HelpCircle, Ruler, Package, ShoppingBag, Eye, TrendingUp, AlertTriangle, Truck, ShieldCheck } from "lucide-react";
import { useStoreProductPageConfig, useUpdateStoreProductPageConfig } from "@/hooks/useStoreProductPageConfig";
import { useTenantContext } from "@/hooks/useTenantContext";
import { canAccess } from "@/lib/planPermissions";
import { LockedFeature } from "@/components/LockedFeature";

interface FeatureToggleProps {
  icon: React.ReactNode;
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  badge?: string;
  badgeColor?: string;
}

function FeatureToggle({ icon, label, description, checked, onCheckedChange, badge, badgeColor }: FeatureToggleProps) {
  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
          {icon}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium text-sm">{label}</p>
            {badge && (
              <Badge
                variant="secondary"
                className={`text-[10px] px-1.5 ${badgeColor || ""}`}
              >
                {badge}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

export default function ProductPageSettings() {
  const { data: config, isLoading } = useStoreProductPageConfig();
  const updateConfig = useUpdateStoreProductPageConfig();

  const [videoGallery, setVideoGallery] = useState(false);
  const [imageZoom, setImageZoom] = useState(true);
  const [stickyCart, setStickyCart] = useState(false);
  const [reviews, setReviews] = useState(true);
  const [faq, setFaq] = useState(false);
  const [sizeGuide, setSizeGuide] = useState(false);
  const [sizeGuideContent, setSizeGuideContent] = useState("");
  const [relatedProducts, setRelatedProducts] = useState(true);
  const [buyTogether, setBuyTogether] = useState(false);
  const [recentlyViewed, setRecentlyViewed] = useState(false);
  const [categoryBestSellers, setCategoryBestSellers] = useState(false);
  const [stockUrgency, setStockUrgency] = useState(false);
  const [stockThreshold, setStockThreshold] = useState(5);
  const [deliveryEstimation, setDeliveryEstimation] = useState(false);
  const [deliveryText, setDeliveryText] = useState("3-7 dias úteis");
  const [trustBadges, setTrustBadges] = useState(false);

  useEffect(() => {
    if (config) {
      setVideoGallery(config.enable_video_gallery);
      setImageZoom(config.enable_image_zoom);
      setStickyCart(config.enable_sticky_add_to_cart);
      setReviews(config.enable_reviews);
      setFaq(config.enable_faq);
      setSizeGuide(config.enable_size_guide);
      setSizeGuideContent(config.size_guide_content || "");
      setRelatedProducts(config.enable_related_products);
      setBuyTogether(config.enable_buy_together);
      setRecentlyViewed(config.enable_recently_viewed);
      setCategoryBestSellers(config.enable_category_best_sellers);
      setStockUrgency(config.enable_stock_urgency);
      setStockThreshold(config.stock_urgency_threshold);
      setDeliveryEstimation(config.enable_delivery_estimation);
      setDeliveryText(config.delivery_estimation_text);
      setTrustBadges(config.enable_trust_badges);
    }
  }, [config]);

  const handleSave = () => {
    if (!config) return;
    updateConfig.mutate({
      id: config.id,
      enable_video_gallery: videoGallery,
      enable_image_zoom: imageZoom,
      enable_sticky_add_to_cart: stickyCart,
      enable_reviews: reviews,
      enable_faq: faq,
      enable_size_guide: sizeGuide,
      size_guide_content: sizeGuideContent.trim() || null,
      enable_related_products: relatedProducts,
      enable_buy_together: buyTogether,
      enable_recently_viewed: recentlyViewed,
      enable_category_best_sellers: categoryBestSellers,
      enable_stock_urgency: stockUrgency,
      stock_urgency_threshold: stockThreshold,
      enable_delivery_estimation: deliveryEstimation,
      delivery_estimation_text: deliveryText,
      enable_trust_badges: trustBadges,
    });
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Galeria e Mídia */}
      <LockedFeature isLocked={!canAccess("image_zoom", ctx)} featureName="Galeria e Mídia">
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-lg">Galeria e Mídia</CardTitle>
          <CardDescription>Configure como as imagens e vídeos aparecem na página do produto</CardDescription>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          <FeatureToggle icon={<Video className="h-4 w-4" />} label="Galeria de Vídeo" description="Permite adicionar vídeos na galeria do produto" checked={videoGallery} onCheckedChange={setVideoGallery} badge="PRO+" />
          <FeatureToggle icon={<ZoomIn className="h-4 w-4" />} label="Zoom na Imagem" description="Zoom ao passar o mouse sobre a imagem" checked={imageZoom} onCheckedChange={setImageZoom} />
        </CardContent>
      </Card>
      </LockedFeature>

      {/* Ações de Compra */}
      <LockedFeature isLocked={!canAccess("sticky_cart", ctx)} featureName="Ações de Compra">
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-lg">Ações de Compra</CardTitle>
          <CardDescription>Ferramentas para aumentar a conversão</CardDescription>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          <FeatureToggle icon={<ShoppingCart className="h-4 w-4" />} label="Botão Fixo de Compra" description="Botão 'Adicionar ao Carrinho' fixo na tela ao rolar" checked={stickyCart} onCheckedChange={setStickyCart} badge="PRO+" />
          <FeatureToggle icon={<ShoppingBag className="h-4 w-4" />} label="Compre Junto" description="Sugere produtos para comprar junto com desconto" checked={buyTogether} onCheckedChange={setBuyTogether} badge="PREMIUM" badgeColor="bg-gradient-to-r from-amber-500 to-orange-500 text-white" />
        </CardContent>
      </Card>
      </LockedFeature>

      {/* Social Proof */}
      <LockedFeature isLocked={!canAccess("reviews", ctx)} featureName="Prova Social">
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-lg">Prova Social</CardTitle>
          <CardDescription>Avaliações e informações que geram confiança</CardDescription>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          <FeatureToggle icon={<Star className="h-4 w-4" />} label="Avaliações" description="Exibir avaliações de clientes" checked={reviews} onCheckedChange={setReviews} badge="STARTER+" />
          <FeatureToggle icon={<ShieldCheck className="h-4 w-4" />} label="Selos de Confiança" description="Selos de segurança e garantia" checked={trustBadges} onCheckedChange={setTrustBadges} badge="STARTER+" />
          <FeatureToggle icon={<AlertTriangle className="h-4 w-4" />} label="Urgência de Estoque" description="Exibe 'Últimas X unidades!' quando estoque baixo" checked={stockUrgency} onCheckedChange={setStockUrgency} badge="PRO+" />
          {stockUrgency && (
            <div className="py-3 pl-12">
              <Label className="text-xs">Exibir alerta quando estoque ≤</Label>
              <Input type="number" value={stockThreshold} onChange={(e) => setStockThreshold(Number(e.target.value))} min={1} max={50} className="w-24 mt-1" />
            </div>
          )}
        </CardContent>
      </Card>
      </LockedFeature>

      {/* Informações Extras */}
      <LockedFeature isLocked={!canAccess("product_faq", ctx)} featureName="Informações Extras">
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-lg">Informações Extras</CardTitle>
          <CardDescription>FAQ, guia de tamanhos e estimativa de entrega</CardDescription>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          <FeatureToggle icon={<HelpCircle className="h-4 w-4" />} label="FAQ do Produto" description="Perguntas frequentes no produto" checked={faq} onCheckedChange={setFaq} badge="PRO+" />
          <FeatureToggle icon={<Ruler className="h-4 w-4" />} label="Guia de Tamanhos" description="Tabela de medidas para roupas/sapatos" checked={sizeGuide} onCheckedChange={setSizeGuide} badge="PRO+" />
          {sizeGuide && (
            <div className="py-3 pl-12">
              <Label className="text-xs">Conteúdo do Guia</Label>
              <Textarea value={sizeGuideContent} onChange={(e) => setSizeGuideContent(e.target.value)} placeholder="P: 36-38 | M: 40-42 | G: 44-46 | GG: 48-50" className="mt-1" />
            </div>
          )}
          <FeatureToggle icon={<Truck className="h-4 w-4" />} label="Estimativa de Entrega" description="Prazo estimado de entrega" checked={deliveryEstimation} onCheckedChange={setDeliveryEstimation} />
          {deliveryEstimation && (
            <div className="py-3 pl-12">
              <Label className="text-xs">Texto de Estimativa</Label>
              <Input value={deliveryText} onChange={(e) => setDeliveryText(e.target.value)} placeholder="3-7 dias úteis" className="mt-1" />
            </div>
          )}
        </CardContent>
      </Card>
      </LockedFeature>

      {/* Produtos Relacionados */}
      <LockedFeature isLocked={!canAccess("related_products", ctx)} featureName="Recomendações">
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-lg">Recomendações</CardTitle>
          <CardDescription>Seções de produtos relacionados e sugestões</CardDescription>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          <FeatureToggle icon={<Package className="h-4 w-4" />} label="Produtos Relacionados" description="Mostra produtos da mesma categoria" checked={relatedProducts} onCheckedChange={setRelatedProducts} />
          <FeatureToggle icon={<Eye className="h-4 w-4" />} label="Vistos Recentemente" description="Produtos que o cliente visualizou" checked={recentlyViewed} onCheckedChange={setRecentlyViewed} badge="PRO+" />
          <FeatureToggle icon={<TrendingUp className="h-4 w-4" />} label="Mais Vendidos da Categoria" description="Top vendas da categoria atual" checked={categoryBestSellers} onCheckedChange={setCategoryBestSellers} badge="PREMIUM" badgeColor="bg-gradient-to-r from-amber-500 to-orange-500 text-white" />
        </CardContent>
      </Card>
      </LockedFeature>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updateConfig.isPending} size="lg">
          {updateConfig.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Salvar Configurações do Produto
        </Button>
      </div>
    </div>
  );
}
