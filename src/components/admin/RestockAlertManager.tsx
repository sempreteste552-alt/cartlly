import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Package, Bell, X, Sparkles } from "lucide-react";
import { useRestockAlert, useUpsertRestockAlert } from "@/hooks/useRestockAlerts";
import { useProducts } from "@/hooks/useProducts";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export default function RestockAlertManager() {
  const { user } = useAuth();
  const { data: alert, isLoading } = useRestockAlert();
  const { data: products } = useProducts();
  const upsert = useUpsertRestockAlert();

  const [title, setTitle] = useState("🔥 Produtos de volta ao estoque!");
  const [subtitle, setSubtitle] = useState("Corra antes que acabe novamente!");
  const [ctaText, setCtaText] = useState("Conferir");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [active, setActive] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushTitle, setPushTitle] = useState("Reposição de estoque!");
  const [pushBody, setPushBody] = useState("Produtos que você estava esperando voltaram!");
  const [bgColor, setBgColor] = useState("#6d28d9");
  const [textColor, setTextColor] = useState("#ffffff");
  const [cardBgColor, setCardBgColor] = useState("#ffffff");
  const [accentColor, setAccentColor] = useState("#6d28d9");

  useEffect(() => {
    if (alert) {
      setTitle(alert.title || "");
      setSubtitle(alert.subtitle || "");
      setCtaText(alert.cta_text || "Conferir");
      setSelectedIds(alert.product_ids || []);
      setActive(alert.active);
      setPushEnabled(alert.push_enabled);
      setPushTitle(alert.push_title || "");
      setPushBody(alert.push_body || "");
      setBgColor(alert.bg_color || "#6d28d9");
      setTextColor(alert.text_color || "#ffffff");
      setCardBgColor(alert.card_bg_color || "#ffffff");
      setAccentColor(alert.accent_color || "#6d28d9");
    }
  }, [alert]);

  const handleSave = async () => {
    if (!user) return;
    if (selectedIds.length === 0) return toast.error("Selecione pelo menos um produto");
    try {
      await upsert.mutateAsync({
        id: alert?.id,
        user_id: user.id,
        title,
        subtitle,
        cta_text: ctaText,
        product_ids: selectedIds,
        active,
        push_enabled: pushEnabled,
        push_title: pushTitle,
        push_body: pushBody,
        bg_color: bgColor,
        text_color: textColor,
        card_bg_color: cardBgColor,
        accent_color: accentColor,
      });
      toast.success("Alerta de reposição salvo!");
    } catch {
      toast.error("Erro ao salvar");
    }
  };

  const toggleProduct = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Alerta de Reposição
        </CardTitle>
        <CardDescription>
          Exiba um card chamativo para clientes quando produtos forem repostos
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <Switch checked={active} onCheckedChange={setActive} />
          <Label>Alerta ativo</Label>
        </div>

        <div className="space-y-2">
          <Label>Título chamativo</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="🔥 Produtos de volta!" />
        </div>

        <div className="space-y-2">
          <Label>Subtítulo</Label>
          <Input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="Corra antes que acabe!" />
        </div>

        <div className="space-y-2">
          <Label>Texto do botão CTA</Label>
          <Input value={ctaText} onChange={(e) => setCtaText(e.target.value)} placeholder="Conferir" />
        </div>

        {/* Product selector */}
        <div className="space-y-2">
          <Label>Produtos repostos ({selectedIds.length} selecionados)</Label>
          <div className="max-h-48 overflow-y-auto border rounded-lg p-2 space-y-1">
            {products?.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => toggleProduct(p.id)}
                className={`w-full text-left flex items-center gap-2 p-2 rounded-md transition-colors text-sm ${
                  selectedIds.includes(p.id) ? "bg-primary/10 border border-primary/30" : "hover:bg-muted"
                }`}
              >
                {p.image_url ? (
                  <img src={p.image_url} alt="" className="h-8 w-8 rounded object-cover" />
                ) : (
                  <div className="h-8 w-8 rounded bg-muted flex items-center justify-center">
                    <Package className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
                <span className="flex-1 truncate">{p.name}</span>
                <span className="text-xs text-muted-foreground">
                  {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(p.price)}
                </span>
                {selectedIds.includes(p.id) && (
                  <Badge variant="secondary" className="text-[10px]">✓</Badge>
                )}
              </button>
            ))}
            {(!products || products.length === 0) && (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum produto cadastrado</p>
            )}
          </div>
        </div>

        {/* Selected badges */}
        {selectedIds.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {selectedIds.map((id) => {
              const p = products?.find((x) => x.id === id);
              return (
                <Badge key={id} variant="outline" className="gap-1">
                  {p?.name?.slice(0, 20) || id.slice(0, 8)}
                  <button onClick={() => toggleProduct(id)}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              );
            })}
          </div>
        )}

        {/* Color customization */}
        <div className="border rounded-lg p-4 space-y-3 mt-4">
          <Label className="font-semibold">🎨 Cores do Pop-up</Label>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Fundo do pop-up</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="h-8 w-10 rounded cursor-pointer border" />
                <Input value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="flex-1 text-xs" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Cor do texto</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} className="h-8 w-10 rounded cursor-pointer border" />
                <Input value={textColor} onChange={(e) => setTextColor(e.target.value)} className="flex-1 text-xs" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Fundo do card</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={cardBgColor} onChange={(e) => setCardBgColor(e.target.value)} className="h-8 w-10 rounded cursor-pointer border" />
                <Input value={cardBgColor} onChange={(e) => setCardBgColor(e.target.value)} className="flex-1 text-xs" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Cor de destaque</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="h-8 w-10 rounded cursor-pointer border" />
                <Input value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="flex-1 text-xs" />
              </div>
            </div>
          </div>
          {/* Preview swatch */}
          <div className="rounded-lg p-3 flex items-center gap-3" style={{ background: `linear-gradient(145deg, ${bgColor}30, ${bgColor}10)` }}>
            <div className="h-8 w-8 rounded-full" style={{ backgroundColor: accentColor }} />
            <div>
              <p className="text-sm font-bold" style={{ color: textColor === '#ffffff' ? '#000' : textColor }}>Preview</p>
              <p className="text-xs" style={{ color: accentColor }}>Cor de destaque</p>
            </div>
            <div className="ml-auto h-6 w-12 rounded" style={{ backgroundColor: cardBgColor, border: '1px solid #e5e7eb' }} />
          </div>
        </div>

        {/* Push notification settings */}
        <div className="border rounded-lg p-4 space-y-3 mt-4">
          <div className="flex items-center gap-3">
            <Bell className="h-4 w-4 text-muted-foreground" />
            <Label className="font-semibold">Notificação Push</Label>
            <Switch checked={pushEnabled} onCheckedChange={setPushEnabled} />
          </div>
          {pushEnabled && (
            <>
              <div className="space-y-2">
                <Label className="text-sm">Título do push</Label>
                <Input value={pushTitle} onChange={(e) => setPushTitle(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Mensagem do push</Label>
                <Textarea value={pushBody} onChange={(e) => setPushBody(e.target.value)} rows={2} />
              </div>
            </>
          )}
        </div>

        <Button onClick={handleSave} disabled={upsert.isPending} className="w-full">
          {upsert.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Salvar Alerta de Reposição
        </Button>
      </CardContent>
    </Card>
  );
}
