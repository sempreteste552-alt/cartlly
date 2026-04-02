import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Loader2, Type, Layers, LayoutGrid, Monitor } from "lucide-react";
import { useStoreThemeConfig, useUpdateStoreThemeConfig } from "@/hooks/useStoreThemeConfig";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";
import { LockedFeature } from "@/components/LockedFeature";

const FONT_OPTIONS = [
  "Inter", "Poppins", "Roboto", "Open Sans", "Montserrat", "Playfair Display",
  "Lora", "Raleway", "Nunito", "Oswald", "Merriweather", "DM Sans",
  "Space Grotesk", "Plus Jakarta Sans", "Outfit",
];

const SHADOW_OPTIONS = [
  { value: "none", label: "Sem Sombra" },
  { value: "sm", label: "Sutil" },
  { value: "md", label: "Média" },
  { value: "lg", label: "Forte" },
  { value: "xl", label: "Extra Forte" },
];

const HEADER_STYLES = [
  { value: "standard", label: "Padrão" },
  { value: "centered", label: "Centralizado" },
  { value: "minimal", label: "Minimalista" },
];

const FOOTER_STYLES = [
  { value: "standard", label: "Padrão" },
  { value: "minimal", label: "Minimalista" },
  { value: "expanded", label: "Expandido" },
];

export default function StoreAppearanceSettings() {
  const { data: config, isLoading } = useStoreThemeConfig();
  const updateConfig = useUpdateStoreThemeConfig();
  const { isLocked } = usePlanFeatures();

  const [fontHeading, setFontHeading] = useState("Inter");
  const [fontBody, setFontBody] = useState("Inter");
  const [cardBorderRadius, setCardBorderRadius] = useState(8);
  const [cardShadow, setCardShadow] = useState("sm");
  const [layoutWidth, setLayoutWidth] = useState("contained");
  const [productGridColumns, setProductGridColumns] = useState(4);
  const [productGridColumnsMobile, setProductGridColumnsMobile] = useState(2);
  const [productGridGap, setProductGridGap] = useState(16);
  const [headerStyle, setHeaderStyle] = useState("standard");
  const [footerStyle, setFooterStyle] = useState("standard");
  const [customCss, setCustomCss] = useState("");

  useEffect(() => {
    if (config) {
      setFontHeading(config.font_heading);
      setFontBody(config.font_body);
      setCardBorderRadius(config.card_border_radius);
      setCardShadow(config.card_shadow);
      setLayoutWidth(config.layout_width);
      setProductGridColumns(config.product_grid_columns);
      setProductGridColumnsMobile(config.product_grid_columns_mobile);
      setProductGridGap(config.product_grid_gap);
      setHeaderStyle(config.header_style);
      setFooterStyle(config.footer_style);
      setCustomCss(config.custom_css || "");
    }
  }, [config]);

  const handleSave = () => {
    if (!config) return;
    updateConfig.mutate({
      id: config.id,
      font_heading: fontHeading,
      font_body: fontBody,
      card_border_radius: cardBorderRadius,
      card_shadow: cardShadow,
      layout_width: layoutWidth,
      product_grid_columns: productGridColumns,
      product_grid_columns_mobile: productGridColumnsMobile,
      product_grid_gap: productGridGap,
      header_style: headerStyle,
      footer_style: footerStyle,
      custom_css: customCss.trim() || null,
    });
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const isPremiumDesign = isLocked("custom_domain"); // PRO+ proxy

  return (
    <div className="space-y-6">
      {/* Tipografia */}
      <Card className="border-border">
        <CardHeader>
          <div className="flex items-center gap-2"><Type className="h-5 w-5 text-primary" /><CardTitle className="text-lg">Tipografia</CardTitle></div>
          <CardDescription>Escolha as fontes para títulos e textos da loja</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Fonte dos Títulos</Label>
              <Select value={fontHeading} onValueChange={setFontHeading}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FONT_OPTIONS.map((f) => (
                    <SelectItem key={f} value={f}><span style={{ fontFamily: f }}>{f}</span></SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Fonte do Corpo</Label>
              <Select value={fontBody} onValueChange={setFontBody}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FONT_OPTIONS.map((f) => (
                    <SelectItem key={f} value={f}><span style={{ fontFamily: f }}>{f}</span></SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {/* Preview */}
          <div className="rounded-lg border border-border p-4 bg-card">
            <h3 className="text-lg font-bold mb-1" style={{ fontFamily: fontHeading }}>Título de Exemplo</h3>
            <p className="text-sm text-muted-foreground" style={{ fontFamily: fontBody }}>
              Este é um exemplo de como o texto do corpo vai aparecer na sua loja com a fonte selecionada.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Cards e Componentes */}
      <Card className="border-border">
        <CardHeader>
          <div className="flex items-center gap-2"><Layers className="h-5 w-5 text-primary" /><CardTitle className="text-lg">Cards e Componentes</CardTitle></div>
          <CardDescription>Personalize o visual dos cards de produto</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Borda Arredondada ({cardBorderRadius}px)</Label>
            <Slider value={[cardBorderRadius]} onValueChange={([v]) => setCardBorderRadius(v)} min={0} max={24} step={2} />
          </div>
          <div className="space-y-2">
            <Label>Sombra</Label>
            <Select value={cardShadow} onValueChange={setCardShadow}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SHADOW_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* Preview Card */}
          <div className="flex items-center justify-center pt-2">
            <div
              className="w-48 bg-card border border-border overflow-hidden"
              style={{
                borderRadius: `${cardBorderRadius}px`,
                boxShadow: cardShadow === "none" ? "none"
                  : cardShadow === "sm" ? "0 1px 3px rgba(0,0,0,0.12)"
                  : cardShadow === "md" ? "0 4px 6px rgba(0,0,0,0.1)"
                  : cardShadow === "lg" ? "0 10px 15px rgba(0,0,0,0.1)"
                  : "0 20px 25px rgba(0,0,0,0.15)",
              }}
            >
              <div className="h-28 bg-muted" />
              <div className="p-3">
                <p className="text-sm font-medium">Produto Exemplo</p>
                <p className="text-xs text-primary font-bold">R$ 99,90</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Grid de Produtos */}
      <Card className="border-border">
        <CardHeader>
          <div className="flex items-center gap-2"><LayoutGrid className="h-5 w-5 text-primary" /><CardTitle className="text-lg">Grid de Produtos</CardTitle></div>
          <CardDescription>Controle o layout da listagem de produtos</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Colunas Desktop ({productGridColumns})</Label>
              <Slider value={[productGridColumns]} onValueChange={([v]) => setProductGridColumns(v)} min={2} max={6} step={1} />
            </div>
            <div className="space-y-2">
              <Label>Colunas Mobile ({productGridColumnsMobile})</Label>
              <Slider value={[productGridColumnsMobile]} onValueChange={([v]) => setProductGridColumnsMobile(v)} min={1} max={3} step={1} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Espaçamento ({productGridGap}px)</Label>
            <Slider value={[productGridGap]} onValueChange={([v]) => setProductGridGap(v)} min={4} max={32} step={4} />
          </div>
          <div className="space-y-2">
            <Label>Largura do Layout</Label>
            <Select value={layoutWidth} onValueChange={setLayoutWidth}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="contained">Contido (max 1280px)</SelectItem>
                <SelectItem value="wide">Largo (max 1440px)</SelectItem>
                <SelectItem value="full">Largura Total</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Header & Footer Style */}
      <Card className="border-border">
        <CardHeader>
          <div className="flex items-center gap-2"><Monitor className="h-5 w-5 text-primary" /><CardTitle className="text-lg">Estilos de Layout</CardTitle></div>
          <CardDescription>Defina o estilo do cabeçalho e rodapé</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Estilo do Header</Label>
              <Select value={headerStyle} onValueChange={setHeaderStyle}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {HEADER_STYLES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Estilo do Footer</Label>
              <Select value={footerStyle} onValueChange={setFooterStyle}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FOOTER_STYLES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Custom CSS - PREMIUM only */}
      <Card className="border-border relative">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg">CSS Personalizado</CardTitle>
            <Badge variant="secondary" className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px]">PREMIUM</Badge>
          </div>
          <CardDescription>Adicione CSS customizado à sua loja (avançado)</CardDescription>
        </CardHeader>
        <CardContent>
          {isPremiumDesign ? (
            <div className="relative">
              <Textarea
                value={customCss}
                onChange={(e) => setCustomCss(e.target.value)}
                placeholder={`.my-class {\n  color: red;\n}`}
                className="font-mono text-xs min-h-[120px]"
                disabled
              />
              <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center rounded-md">
                <p className="text-sm text-muted-foreground">Disponível no plano Premium</p>
              </div>
            </div>
          ) : (
            <Textarea
              value={customCss}
              onChange={(e) => setCustomCss(e.target.value)}
              placeholder={`.my-class {\n  color: red;\n}`}
              className="font-mono text-xs min-h-[120px]"
            />
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updateConfig.isPending} size="lg">
          {updateConfig.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Salvar Aparência
        </Button>
      </div>
    </div>
  );
}
