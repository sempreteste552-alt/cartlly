import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Loader2, Type, Layers, LayoutGrid, Monitor, Palette, Eye, Upload, Image, X } from "lucide-react";
import { useStoreThemeConfig, useUpdateStoreThemeConfig } from "@/hooks/useStoreThemeConfig";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";
import { LockedFeature } from "@/components/LockedFeature";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
  const [primaryColor, setPrimaryColor] = useState("#000000");
  const [secondaryColor, setSecondaryColor] = useState("#666666");
  const [backgroundColor, setBackgroundColor] = useState("#ffffff");
  const [textColor, setTextColor] = useState("#000000");
  const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'system'>('light');

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
      setPrimaryColor(config.primary_color || "#000000");
      setSecondaryColor(config.secondary_color || "#666666");
      setBackgroundColor(config.background_color || "#ffffff");
      setTextColor(config.text_color || "#000000");
      setThemeMode(config.theme_mode || 'light');
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
      primary_color: primaryColor,
      secondary_color: secondaryColor,
      background_color: backgroundColor,
      text_color: textColor,
      theme_mode: themeMode,
    });
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const isPremiumDesign = isLocked("custom_domain"); // PRO+ proxy

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Coluna de Configurações */}
      <div className="space-y-6">
        {/* Cores e Tema */}
        <Card className="border-border">
          <CardHeader>
            <div className="flex items-center gap-2"><Palette className="h-5 w-5 text-primary" /><CardTitle className="text-lg">Cores e Tema</CardTitle></div>
            <CardDescription>Personalize o esquema de cores e o modo de visualização</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cor Principal</Label>
                <div className="flex gap-2">
                  <Input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="w-12 p-1 h-9" />
                  <Input type="text" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="flex-1" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Cor Secundária</Label>
                <div className="flex gap-2">
                  <Input type="color" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} className="w-12 p-1 h-9" />
                  <Input type="text" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} className="flex-1" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Fundo da Loja</Label>
                <div className="flex gap-2">
                  <Input type="color" value={backgroundColor} onChange={(e) => setBackgroundColor(e.target.value)} className="w-12 p-1 h-9" />
                  <Input type="text" value={backgroundColor} onChange={(e) => setBackgroundColor(e.target.value)} className="flex-1" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Cor do Texto</Label>
                <div className="flex gap-2">
                  <Input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} className="w-12 p-1 h-9" />
                  <Input type="text" value={textColor} onChange={(e) => setTextColor(e.target.value)} className="flex-1" />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Modo de Tema Padrão</Label>
              <Select value={themeMode} onValueChange={(v: any) => setThemeMode(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Claro</SelectItem>
                  <SelectItem value="dark">Escuro</SelectItem>
                  <SelectItem value="system">Sistema (Automático)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

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
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3 pt-4">
          <Button onClick={handleSave} disabled={updateConfig.isPending} size="lg">
            {updateConfig.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar Aparência
          </Button>
        </div>
      </div>

      {/* Coluna de Preview */}
      <div className="sticky top-20 h-[calc(100vh-140px)] space-y-4 hidden lg:flex flex-col">
        <div className="flex items-center gap-2 text-muted-foreground mb-2">
          <Eye className="h-4 w-4" />
          <span className="text-sm font-medium">Prévia em Tempo Real</span>
        </div>
        
        <div 
          className="flex-1 border-4 border-muted rounded-xl overflow-hidden shadow-2xl bg-white flex flex-col"
          style={{ 
            backgroundColor: themeMode === 'dark' ? '#0f172a' : backgroundColor,
            color: themeMode === 'dark' ? '#f8fafc' : textColor,
            fontFamily: fontBody
          }}
        >
          {/* Header Preview */}
          <div 
            className="p-4 border-b border-border/10 flex justify-between items-center"
            style={{ backgroundColor: themeMode === 'dark' ? '#1e293b' : 'rgba(255,255,255,0.8)' }}
          >
            <div className="font-bold text-xl" style={{ fontFamily: fontHeading, color: primaryColor }}>LOJA</div>
            <div className="flex gap-3 text-xs opacity-70">
              <span>Início</span>
              <span>Produtos</span>
              <span>Contato</span>
            </div>
            <div className="w-8 h-8 rounded-full" style={{ backgroundColor: primaryColor }} />
          </div>

          {/* Body Preview */}
          <div className="p-6 space-y-6 flex-1 overflow-auto">
            <h2 className="text-2xl font-bold" style={{ fontFamily: fontHeading }}>Nossos Produtos</h2>
            
            <div 
              className="grid gap-4" 
              style={{ 
                gridTemplateColumns: `repeat(2, 1fr)`,
                gap: `${productGridGap / 2}px` 
              }}
            >
              {[1, 2].map((i) => (
                <div 
                  key={i}
                  className="bg-card border border-border/20 overflow-hidden"
                  style={{ 
                    borderRadius: `${cardBorderRadius}px`,
                    boxShadow: cardShadow === "none" ? "none" : "0 4px 6px -1px rgba(0,0,0,0.1)",
                    backgroundColor: themeMode === 'dark' ? '#1e293b' : 'white'
                  }}
                >
                  <div className="aspect-square bg-muted/30" />
                  <div className="p-3 space-y-2">
                    <div className="h-3 w-3/4 bg-muted/50 rounded" />
                    <div className="h-4 w-1/2 rounded" style={{ backgroundColor: `${primaryColor}20`, color: primaryColor, fontWeight: 'bold', fontSize: '12px' }}>
                      R$ 99,90
                    </div>
                    <Button 
                      className="w-full h-8 text-[10px]" 
                      style={{ backgroundColor: primaryColor }}
                    >
                      Comprar
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div 
              className="p-4 rounded-lg space-y-2"
              style={{ backgroundColor: `${secondaryColor}10`, border: `1px dashed ${secondaryColor}` }}
            >
              <p className="text-sm font-medium" style={{ color: secondaryColor }}>Banner Informativo</p>
              <p className="text-xs opacity-70">Este elemento usa a sua cor secundária.</p>
            </div>
          </div>

          {/* Footer Preview */}
          <div 
            className="p-4 mt-auto border-t border-border/10 text-[10px] text-center opacity-50"
            style={{ backgroundColor: themeMode === 'dark' ? '#1e293b' : 'rgba(0,0,0,0.02)' }}
          >
            © 2024 Sua Loja - Todos os direitos reservados
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          As alterações são visíveis aqui imediatamente, mas só serão aplicadas à loja após salvar.
        </p>
      </div>
    </div>
  );
}
