import { useState, useCallback } from "react";
import { toast } from "sonner";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, DollarSign, ImageIcon, Loader2, Check, Copy, ArrowRight, Mic, MicOff, Share2, Instagram, Music2 } from "lucide-react";
import { useAIProductEnhance, type SEOResult, type PriceResult, type ImageAnalysisResult, type RestockPhrasesResult, type SocialPostResult } from "@/hooks/useAIProductEnhance";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import { useTenantContext } from "@/hooks/useTenantContext";

interface AIProductToolsProps {
  name: string;
  description: string;
  price: string;
  category: string;
  imageUrl: string;
  onApplyDescription: (desc: string) => void;
  onApplyName: (name: string) => void;
  onApplyPrice: (price: string) => void;
  onApplyBadge?: (badge: string) => void;
  locked?: boolean;
}

export function AIProductTools({
  name, description, price, category, imageUrl,
  onApplyDescription, onApplyName, onApplyPrice, onApplyBadge, locked = false,
}: AIProductToolsProps) {
  const { slug } = useParams();
  const { effectiveId } = useTenantContext();
  const aiEnhance = useAIProductEnhance();
  const [seoResult, setSeoResult] = useState<SEOResult | null>(null);
  const [priceResult, setPriceResult] = useState<PriceResult | null>(null);
  const [imageResult, setImageResult] = useState<ImageAnalysisResult | null>(null);
  const [restockResult, setRestockResult] = useState<RestockPhrasesResult | null>(null);
  const [socialResult, setSocialResult] = useState<SocialPostResult | null>(null);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [voiceText, setVoiceText] = useState("");

  const voiceRecorder = useVoiceRecorder({
    onTranscript: (text) => {
      setVoiceText(text);
      // Auto-apply voice text as description
      onApplyDescription(text);
    },
  });

  const handleGenerateSEO = async () => {
    setActiveAction("seo");
    const result = await aiEnhance.mutateAsync({
      action: "generate_description",
      productName: name,
      productDescription: description,
      productPrice: parseFloat(price) || undefined,
      productCategory: category,
      userId: effectiveId,
    });
    setSeoResult(result as SEOResult);
    setActiveAction(null);
  };

  const handleSuggestPrice = async () => {
    setActiveAction("price");
    const result = await aiEnhance.mutateAsync({
      action: "suggest_price",
      productName: name,
      productDescription: description,
      productPrice: parseFloat(price) || undefined,
      productCategory: category,
      userId: effectiveId,
    });
    setPriceResult(result as PriceResult);
    setActiveAction(null);
  };

  const handleAnalyzeImage = async () => {
    if (!imageUrl) return;
    setActiveAction("image");
    const result = await aiEnhance.mutateAsync({
      action: "analyze_image",
      imageUrl,
      userId: effectiveId,
    });
    setImageResult(result as ImageAnalysisResult);
    setActiveAction(null);
  };

  const handleGenerateRestock = async () => {
    setActiveAction("restock");
    const result = await aiEnhance.mutateAsync({
      action: "generate_restock_phrases",
      productName: name,
      productCategory: category,
      userId: effectiveId,
    });
    setRestockResult(result as RestockPhrasesResult);
    setActiveAction(null);
  };

  const handleGenerateSocialPost = async () => {
    setActiveAction("social");
    const result = await aiEnhance.mutateAsync({
      action: "generate_social_post",
      productName: name,
      productDescription: description,
      productCategory: category,
      userId: effectiveId,
    });
    setSocialResult(result as SocialPostResult);
    setActiveAction(null);
  };

  const formatPrice = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const isLoading = aiEnhance.isPending;
  const handleUpgrade = () => window.location.assign(`/painel/${slug}/plano`);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium text-foreground">Assistente IA</span>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button" variant="outline" size="sm"
          onClick={handleGenerateSEO}
          disabled={locked || isLoading || !name}
        >
          {activeAction === "seo" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
          Gerar Descrição SEO
        </Button>
        <Button
          type="button" variant="outline" size="sm"
          onClick={handleSuggestPrice}
          disabled={locked || isLoading || !name}
        >
          {activeAction === "price" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <DollarSign className="mr-1.5 h-3.5 w-3.5" />}
          Sugerir Preço
        </Button>
        <Button
          type="button" variant="outline" size="sm"
          onClick={handleAnalyzeImage}
          disabled={locked || isLoading || !imageUrl}
        >
          {activeAction === "image" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <ImageIcon className="mr-1.5 h-3.5 w-3.5" />}
          Analisar Imagem
        </Button>
        <Button
          type="button" variant="outline" size="sm"
          onClick={handleGenerateRestock}
          disabled={locked || isLoading || !name}
        >
          {activeAction === "restock" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
          Gerar Frases de Destaque
        </Button>
        <Button
          type="button" variant="outline" size="sm"
          onClick={handleGenerateSocialPost}
          disabled={locked || isLoading || !name}
        >
          {activeAction === "social" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5 text-primary" />}
          Gerar Post Redes Sociais
        </Button>
        {voiceRecorder.isSupported && (
          <Button
            type="button" variant={voiceRecorder.isRecording ? "destructive" : "outline"} size="sm"
            onClick={voiceRecorder.toggleRecording}
            disabled={locked || isLoading}
            title={voiceRecorder.isRecording ? "Parar gravação" : "Ditar descrição por voz"}
          >
            {voiceRecorder.isRecording ? <MicOff className="mr-1.5 h-3.5 w-3.5 animate-pulse" /> : <Mic className="mr-1.5 h-3.5 w-3.5" />}
            {voiceRecorder.isRecording ? "Parar" : "Ditar por Voz"}
          </Button>
        )}
      </div>

      {locked && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-3 space-y-2">
            <span className="text-sm font-semibold text-foreground">Assistente IA Premium</span>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Desbloqueie o Gerador de Posts para Redes Sociais, SEO Avançado, Análise de Imagem e Precificação Estratégica. 
              Utilize o <strong>Cérebro da Loja</strong> para criar conteúdo que combina 100% com sua marca.
            </p>
            <Button type="button" size="sm" className="gap-2" onClick={handleUpgrade}>
              <ArrowRight className="h-3.5 w-3.5" /> Desbloquear IA agora
            </Button>
          </CardContent>
        </Card>
      )}

      {/* SEO Result */}
      {seoResult && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-primary uppercase">Conteúdo SEO</span>
              <Button type="button" variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setSeoResult(null)}>Fechar</Button>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Título SEO:</p>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">{seoResult.seo_title}</p>
                <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => onApplyName(seoResult.seo_title)} title="Usar como nome">
                  <ArrowRight className="h-3 w-3" />
                </Button>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Descrição:</p>
              <p className="text-sm whitespace-pre-wrap">{seoResult.description}</p>
              <Button type="button" variant="outline" size="sm" className="mt-1 h-7 text-xs" onClick={() => onApplyDescription(seoResult.description)}>
                <Check className="mr-1 h-3 w-3" /> Usar descrição
              </Button>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Meta Description:</p>
              <p className="text-xs italic">{seoResult.meta_description}</p>
            </div>
            <div className="flex flex-wrap gap-1">
              {seoResult.tags.map((tag, i) => (
                <Badge key={i} variant="secondary" className="text-xs">{tag}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Price Result */}
      {priceResult && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-primary uppercase">Sugestão de Preço</span>
              <Button type="button" variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setPriceResult(null)}>Fechar</Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Sugerido", value: priceResult.suggested_price },
                { label: "Mínimo", value: priceResult.min_price },
                { label: "Premium", value: priceResult.premium_price },
                { label: `Promo (-${priceResult.promo_discount_percent}%)`, value: priceResult.promo_price },
              ].map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => onApplyPrice(item.value.toFixed(2))}
                  className="rounded-md border border-border p-2 text-left hover:border-primary/50 hover:bg-primary/5 transition-colors"
                >
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="text-sm font-bold">{formatPrice(item.value)}</p>
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground italic">{priceResult.reasoning}</p>
          </CardContent>
        </Card>
      )}

      {/* Image Analysis Result */}
      {imageResult && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-primary uppercase">Análise da Imagem</span>
              <Button type="button" variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setImageResult(null)}>Fechar</Button>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Nome sugerido:</p>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">{imageResult.suggested_name}</p>
                <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => onApplyName(imageResult.suggested_name)}>
                  <ArrowRight className="h-3 w-3" />
                </Button>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Descrição:</p>
              <p className="text-sm">{imageResult.description}</p>
              <Button type="button" variant="outline" size="sm" className="mt-1 h-7 text-xs" onClick={() => onApplyDescription(imageResult.description)}>
                <Check className="mr-1 h-3 w-3" /> Usar descrição
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <p className="text-xs text-muted-foreground">Categoria:</p>
              <Badge variant="secondary">{imageResult.suggested_category}</Badge>
            </div>
            <div className="flex items-center gap-2">
              <p className="text-xs text-muted-foreground">Cores:</p>
              <div className="flex gap-1">{imageResult.colors.map((c, i) => <Badge key={i} variant="outline" className="text-xs">{c}</Badge>)}</div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Faixa de preço estimada:</p>
              <p className="text-sm font-medium">{formatPrice(imageResult.estimated_price_min)} — {formatPrice(imageResult.estimated_price_max)}</p>
              <Button type="button" variant="outline" size="sm" className="mt-1 h-7 text-xs"
                onClick={() => onApplyPrice(((imageResult.estimated_price_min + imageResult.estimated_price_max) / 2).toFixed(2))}>
                <DollarSign className="mr-1 h-3 w-3" /> Usar preço médio
              </Button>
            </div>
            <div className="flex flex-wrap gap-1">
              {imageResult.tags.map((tag, i) => (
                <Badge key={i} variant="secondary" className="text-xs">{tag}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Restock Phrases Result */}
      {restockResult && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-primary uppercase">Sugestões de Destaque</span>
              <Button type="button" variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setRestockResult(null)}>Fechar</Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {restockResult.phrases.map((phrase, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onApplyBadge?.(phrase)}
                  className="rounded-full border border-border px-3 py-1 text-xs hover:border-primary/50 hover:bg-primary/5 transition-colors"
                >
                  {phrase}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground italic">Clique em uma frase para usar como selo/destaque do produto.</p>
          </CardContent>
        </Card>
      )}
      {/* Social Post Result */}
      {socialResult && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-3 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-primary uppercase">Post para Redes Sociais</span>
              <Button type="button" variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setSocialResult(null)}>Fechar</Button>
            </div>
            
            <div className="space-y-3">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-foreground mb-1">
                  <Instagram className="h-3.5 w-3.5" /> Instagram
                </div>
                <div className="relative group">
                  <p className="text-sm bg-background p-3 rounded-md border border-border whitespace-pre-wrap">{socialResult.instagram_caption}</p>
                  <Button 
                    type="button" variant="outline" size="sm" 
                    className="absolute top-2 right-2 h-7 px-2 text-[10px] gap-1 bg-background/80 backdrop-blur-sm border-primary/20 hover:bg-primary/10 transition-all"
                    onClick={() => {
                      navigator.clipboard.writeText(socialResult.instagram_caption);
                      toast.success("Legenda do Instagram copiada!");
                    }}
                  >
                    <Copy className="h-3 w-3" /> Copiar
                  </Button>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-foreground mb-1">
                  <Music2 className="h-3.5 w-3.5" /> TikTok / Reels
                </div>
                <div className="relative group">
                  <p className="text-sm bg-background p-3 rounded-md border border-border whitespace-pre-wrap">{socialResult.tiktok_caption}</p>
                  <Button 
                    type="button" variant="outline" size="sm" 
                    className="absolute top-2 right-2 h-7 px-2 text-[10px] gap-1 bg-background/80 backdrop-blur-sm border-primary/20 hover:bg-primary/10 transition-all"
                    onClick={() => {
                      navigator.clipboard.writeText(socialResult.tiktok_caption);
                      toast.success("Legenda do TikTok copiada!");
                    }}
                  >
                    <Copy className="h-3 w-3" /> Copiar
                  </Button>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-foreground mb-1">
                  <ImageIcon className="h-3.5 w-3.5" /> Sugestão de Arte
                </div>
                <div className="relative group">
                  <p className="text-xs text-muted-foreground bg-background/50 p-3 rounded-md border border-border border-dashed italic leading-relaxed">
                    {socialResult.art_suggestion}
                  </p>
                  <Button 
                    type="button" variant="outline" size="sm" 
                    className="absolute top-2 right-2 h-6 px-2 text-[9px] gap-1 bg-background/80 backdrop-blur-sm border-primary/20 hover:bg-primary/10 transition-all"
                    onClick={() => {
                      navigator.clipboard.writeText(socialResult.art_suggestion);
                      toast.success("Sugestão de arte copiada!");
                    }}
                  >
                    <Copy className="h-2.5 w-2.5" /> Copiar Arte
                  </Button>
                </div>
              </div>
            </div>

            <Button 
              type="button" variant="outline" size="sm" className="w-full gap-2 border-primary/30 text-primary"
              onClick={() => {
                const text = `Post para ${name}\n\nInstagram:\n${socialResult.instagram_caption}\n\nTikTok:\n${socialResult.tiktok_caption}\n\nSugestão de Arte:\n${socialResult.art_suggestion}`;
                navigator.clipboard.writeText(text);
                toast.success("Conteúdo completo copiado!");
              }}
            >
              <Copy className="h-3.5 w-3.5" /> Copiar Tudo
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
