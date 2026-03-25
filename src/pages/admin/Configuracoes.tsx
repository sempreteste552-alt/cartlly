import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Upload, X, Palette, CreditCard, Store, Globe, ShieldCheck, Zap, MapPin, Phone, MessageCircle, Share2, Image, Clock, Trash2 } from "lucide-react";
import { useStoreSettings, useUpdateStoreSettings, useUploadStoreLogo } from "@/hooks/useStoreSettings";
import { useStoreBanners, useCreateBanner, useDeleteBanner } from "@/hooks/useStoreBanners";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const GATEWAYS = [
  { id: "mercadopago", name: "Mercado Pago", description: "Gateway líder na América Latina.", publicKeyLabel: "Public Key", publicKeyPlaceholder: "APP_USR-xxxxxxxx", docsUrl: "https://www.mercadopago.com.br/developers/pt/docs", color: "#009ee3" },
  { id: "pagbank", name: "PagBank (PagSeguro)", description: "Soluções completas de pagamento.", publicKeyLabel: "Token Público", publicKeyPlaceholder: "XXXXXXXX-XXXX", docsUrl: "https://dev.pagbank.uol.com.br", color: "#41b64f" },
  { id: "pagarme", name: "Pagar.me", description: "Infraestrutura de pagamentos da Stone Co.", publicKeyLabel: "Public Key", publicKeyPlaceholder: "pk_xxxxxxxx", docsUrl: "https://docs.pagar.me", color: "#65a300" },
];

export default function Configuracoes() {
  const { data: settings, isLoading } = useStoreSettings();
  const updateSettings = useUpdateStoreSettings();
  const uploadLogo = useUploadStoreLogo();
  const { data: banners } = useStoreBanners();
  const createBanner = useCreateBanner();
  const deleteBanner = useDeleteBanner();
  const fileRef = useRef<HTMLInputElement>(null);
  const bannerFileRef = useRef<HTMLInputElement>(null);

  const [storeName, setStoreName] = useState("");
  const [storeDescription, setStoreDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#6d28d9");
  const [secondaryColor, setSecondaryColor] = useState("#f5f3ff");
  const [accentColor, setAccentColor] = useState("#8b5cf6");
  const [paymentPix, setPaymentPix] = useState(false);
  const [paymentBoleto, setPaymentBoleto] = useState(false);
  const [paymentCreditCard, setPaymentCreditCard] = useState(false);
  const [paymentDebitCard, setPaymentDebitCard] = useState(false);
  const [customDomain, setCustomDomain] = useState("");
  const [paymentGateway, setPaymentGateway] = useState("");
  const [gatewayPublicKey, setGatewayPublicKey] = useState("");
  const [gatewayEnvironment, setGatewayEnvironment] = useState("sandbox");
  // New fields
  const [storeAddress, setStoreAddress] = useState("");
  const [storePhone, setStorePhone] = useState("");
  const [storeWhatsapp, setStoreWhatsapp] = useState("");
  const [googleMapsUrl, setGoogleMapsUrl] = useState("");
  const [facebookUrl, setFacebookUrl] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [tiktokUrl, setTiktokUrl] = useState("");
  const [twitterUrl, setTwitterUrl] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [sellViaWhatsapp, setSellViaWhatsapp] = useState(false);
  const [storeOpen, setStoreOpen] = useState(true);
  const [storeLocation, setStoreLocation] = useState("");
  const [storeSlug, setStoreSlug] = useState("");
  const [adminPrimaryColor, setAdminPrimaryColor] = useState("#6d28d9");
  const [adminAccentColor, setAdminAccentColor] = useState("#8b5cf6");

  useEffect(() => {
    if (settings) {
      setStoreName(settings.store_name);
      setStoreDescription((settings as any).store_description ?? "");
      setLogoUrl(settings.logo_url ?? "");
      setPrimaryColor(settings.primary_color);
      setSecondaryColor(settings.secondary_color);
      setAccentColor(settings.accent_color);
      setPaymentPix(settings.payment_pix);
      setPaymentBoleto(settings.payment_boleto);
      setPaymentCreditCard(settings.payment_credit_card);
      setPaymentDebitCard(settings.payment_debit_card);
      setCustomDomain(settings.custom_domain ?? "");
      setPaymentGateway(settings.payment_gateway ?? "");
      setGatewayPublicKey(settings.gateway_public_key ?? "");
      setGatewayEnvironment(settings.gateway_environment ?? "sandbox");
      setStoreAddress((settings as any).store_address ?? "");
      setStorePhone((settings as any).store_phone ?? "");
      setStoreWhatsapp((settings as any).store_whatsapp ?? "");
      setGoogleMapsUrl((settings as any).google_maps_url ?? "");
      setFacebookUrl((settings as any).facebook_url ?? "");
      setInstagramUrl((settings as any).instagram_url ?? "");
      setTiktokUrl((settings as any).tiktok_url ?? "");
      setTwitterUrl((settings as any).twitter_url ?? "");
      setYoutubeUrl((settings as any).youtube_url ?? "");
      setSellViaWhatsapp((settings as any).sell_via_whatsapp ?? false);
      setStoreOpen((settings as any).store_open ?? true);
      setStoreLocation((settings as any).store_location ?? "");
      setStoreSlug((settings as any).store_slug ?? "");
      setAdminPrimaryColor((settings as any).admin_primary_color ?? "#6d28d9");
      setAdminAccentColor((settings as any).admin_accent_color ?? "#8b5cf6");
    }
  }, [settings]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return alert("Máximo 2MB para logo.");
    const url = await uploadLogo.mutateAsync(file);
    setLogoUrl(url);
  };

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) return toast.error("Máximo 50MB para banner.");
    const isVideo = file.type.startsWith("video/");
    const ext = file.name.split(".").pop();
    const fileName = `banner-${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("store-assets").upload(fileName, file, { contentType: file.type });
    if (error) { toast.error("Erro no upload: " + error.message); return; }
    const { data: urlData } = supabase.storage.from("store-assets").getPublicUrl(fileName);
    createBanner.mutate({ imageUrl: urlData.publicUrl, mediaType: isVideo ? "video" : "image" });
  };

  const handleSave = () => {
    if (!settings) return;
    updateSettings.mutate({
      id: settings.id,
      store_name: storeName.trim() || "Minha Loja",
      logo_url: logoUrl || null,
      primary_color: primaryColor,
      secondary_color: secondaryColor,
      accent_color: accentColor,
      payment_pix: paymentPix,
      payment_boleto: paymentBoleto,
      payment_credit_card: paymentCreditCard,
      payment_debit_card: paymentDebitCard,
      custom_domain: customDomain.trim() || null,
      payment_gateway: paymentGateway || null,
      gateway_public_key: gatewayPublicKey.trim() || null,
      gateway_environment: gatewayEnvironment,
      store_address: storeAddress.trim() || null,
      store_phone: storePhone.trim() || null,
      store_whatsapp: storeWhatsapp.trim() || null,
      google_maps_url: googleMapsUrl.trim() || null,
      store_description: storeDescription.trim() || null,
      facebook_url: facebookUrl.trim() || null,
      instagram_url: instagramUrl.trim() || null,
      tiktok_url: tiktokUrl.trim() || null,
      twitter_url: twitterUrl.trim() || null,
      youtube_url: youtubeUrl.trim() || null,
      sell_via_whatsapp: sellViaWhatsapp,
      store_open: storeOpen,
      store_location: storeLocation.trim() || null,
      store_slug: storeSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "") || null,
      admin_primary_color: adminPrimaryColor,
      admin_accent_color: adminAccentColor,
    } as any);
  };

  const selectedGateway = GATEWAYS.find((g) => g.id === paymentGateway);

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Configurações</h1>
        <p className="text-muted-foreground">Personalize sua loja</p>
      </div>

      {/* Store Open/Closed */}
      <Card className="border-border">
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-primary" />
            <div>
              <p className="font-medium">Status da Loja</p>
              <p className="text-xs text-muted-foreground">Quando fechada, exibe "Loja em manutenção"</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={storeOpen ? "default" : "secondary"}>{storeOpen ? "Aberta" : "Fechada"}</Badge>
            <Switch checked={storeOpen} onCheckedChange={setStoreOpen} />
          </div>
        </CardContent>
      </Card>

      {/* Store Info */}
      <Card className="border-border">
        <CardHeader>
          <div className="flex items-center gap-2"><Store className="h-5 w-5 text-primary" /><CardTitle className="text-lg">Informações da Loja</CardTitle></div>
          <CardDescription>Nome, descrição e identidade visual</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Nome da Loja</Label>
            <Input value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder="Minha Loja" maxLength={100} />
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea value={storeDescription} onChange={(e) => setStoreDescription(e.target.value)} placeholder="Breve descrição da sua loja" maxLength={500} />
          </div>
          <div className="space-y-2">
            <Label>Logo</Label>
            <div className="flex items-center gap-4">
              {logoUrl ? (
                <div className="relative">
                  <img src={logoUrl} alt="Logo" className="h-20 w-20 rounded-lg object-contain border border-border bg-card p-1" />
                  <button type="button" onClick={() => setLogoUrl("")} className="absolute -right-2 -top-2 rounded-full bg-destructive p-1 text-destructive-foreground"><X className="h-3 w-3" /></button>
                </div>
              ) : (
                <div onClick={() => fileRef.current?.click()} className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-border hover:border-primary/50 transition-colors">
                  {uploadLogo.isPending ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : <Upload className="h-5 w-5 text-muted-foreground" />}
                </div>
              )}
              <p className="text-xs text-muted-foreground">PNG ou JPG, máximo 2MB</p>
            </div>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/svg+xml" className="hidden" onChange={handleLogoUpload} />
          </div>
        </CardContent>
      </Card>

      {/* Banners */}
      <Card className="border-border">
        <CardHeader>
          <div className="flex items-center gap-2"><Image className="h-5 w-5 text-primary" /><CardTitle className="text-lg">Banners</CardTitle></div>
          <CardDescription>Carrossel de banners na página inicial da loja</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {banners?.map((b) => (
              <div key={b.id} className="relative group">
                {(b as any).media_type === "video" ? (
                  <video src={b.image_url} className="w-full h-24 rounded-lg object-cover border border-border" muted loop playsInline onMouseEnter={(e) => (e.target as HTMLVideoElement).play()} onMouseLeave={(e) => { const v = e.target as HTMLVideoElement; v.pause(); v.currentTime = 0; }} />
                ) : (
                  <img src={b.image_url} alt="Banner" className="w-full h-24 rounded-lg object-cover border border-border" />
                )}
                <Badge variant="secondary" className="absolute bottom-1 left-1 text-[10px] px-1.5">{(b as any).media_type === "video" ? "Vídeo" : "Imagem"}</Badge>
                <Button variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => deleteBanner.mutate(b.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={() => bannerFileRef.current?.click()}>
            <Upload className="mr-2 h-4 w-4" /> Adicionar Banner (Imagem ou Vídeo)
          </Button>
          <input ref={bannerFileRef} type="file" accept="image/*,video/mp4,video/webm,video/ogg" className="hidden" onChange={handleBannerUpload} />
        </CardContent>
      </Card>

      {/* Contact & Location */}
      <Card className="border-border">
        <CardHeader>
          <div className="flex items-center gap-2"><MapPin className="h-5 w-5 text-primary" /><CardTitle className="text-lg">Contato e Localização</CardTitle></div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input value={storePhone} onChange={(e) => setStorePhone(e.target.value)} placeholder="(11) 3333-3333" maxLength={20} />
            </div>
            <div className="space-y-2">
              <Label>WhatsApp</Label>
              <Input value={storeWhatsapp} onChange={(e) => setStoreWhatsapp(e.target.value)} placeholder="5511999999999" maxLength={20} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Endereço</Label>
            <Input value={storeAddress} onChange={(e) => setStoreAddress(e.target.value)} placeholder="Rua, número, cidade - UF" maxLength={300} />
          </div>
          <div className="space-y-2">
            <Label>Localização (exibida no topo)</Label>
            <Input value={storeLocation} onChange={(e) => setStoreLocation(e.target.value)} placeholder="São Paulo, SP" maxLength={100} />
          </div>
          <div className="space-y-2">
            <Label>Link Google Maps</Label>
            <Input value={googleMapsUrl} onChange={(e) => setGoogleMapsUrl(e.target.value)} placeholder="https://maps.google.com/..." maxLength={500} />
          </div>
        </CardContent>
      </Card>

      {/* WhatsApp selling */}
      <Card className="border-border">
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <MessageCircle className="h-5 w-5 text-green-500" />
            <div>
              <p className="font-medium">Vender via WhatsApp</p>
              <p className="text-xs text-muted-foreground">Permite que clientes finalizem pedidos pelo WhatsApp</p>
            </div>
          </div>
          <Switch checked={sellViaWhatsapp} onCheckedChange={setSellViaWhatsapp} />
        </CardContent>
      </Card>

      {/* Social URLs */}
      <Card className="border-border">
        <CardHeader>
          <div className="flex items-center gap-2"><Share2 className="h-5 w-5 text-primary" /><CardTitle className="text-lg">Redes Sociais</CardTitle></div>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { label: "Instagram", value: instagramUrl, set: setInstagramUrl, placeholder: "https://instagram.com/sualoja" },
            { label: "Facebook", value: facebookUrl, set: setFacebookUrl, placeholder: "https://facebook.com/sualoja" },
            { label: "TikTok", value: tiktokUrl, set: setTiktokUrl, placeholder: "https://tiktok.com/@sualoja" },
            { label: "YouTube", value: youtubeUrl, set: setYoutubeUrl, placeholder: "https://youtube.com/@sualoja" },
            { label: "Twitter / X", value: twitterUrl, set: setTwitterUrl, placeholder: "https://x.com/sualoja" },
          ].map((s) => (
            <div key={s.label} className="space-y-1">
              <Label className="text-xs">{s.label}</Label>
              <Input value={s.value} onChange={(e) => s.set(e.target.value)} placeholder={s.placeholder} maxLength={300} />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Colors */}
      <Card className="border-border">
        <CardHeader>
          <div className="flex items-center gap-2"><Palette className="h-5 w-5 text-primary" /><CardTitle className="text-lg">Cores da Loja</CardTitle></div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Primária", value: primaryColor, set: setPrimaryColor },
              { label: "Secundária", value: secondaryColor, set: setSecondaryColor },
              { label: "Destaque", value: accentColor, set: setAccentColor },
            ].map((c) => (
              <div key={c.label} className="space-y-2">
                <Label>{c.label}</Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={c.value} onChange={(e) => c.set(e.target.value)} className="h-9 w-12 cursor-pointer rounded border border-border" />
                  <Input value={c.value} onChange={(e) => c.set(e.target.value)} className="font-mono text-xs" maxLength={7} />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Payment Methods */}
      <Card className="border-border">
        <CardHeader>
          <div className="flex items-center gap-2"><CreditCard className="h-5 w-5 text-primary" /><CardTitle className="text-lg">Formas de Pagamento</CardTitle></div>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { label: "PIX", desc: "Pagamento instantâneo", value: paymentPix, set: setPaymentPix },
            { label: "Boleto Bancário", desc: "1-3 dias úteis", value: paymentBoleto, set: setPaymentBoleto },
            { label: "Cartão de Crédito", desc: "Parcelamento", value: paymentCreditCard, set: setPaymentCreditCard },
            { label: "Cartão de Débito", desc: "Débito à vista", value: paymentDebitCard, set: setPaymentDebitCard },
          ].map((m) => (
            <div key={m.label} className="flex items-center justify-between rounded-lg border border-border p-3">
              <div><p className="text-sm font-medium">{m.label}</p><p className="text-xs text-muted-foreground">{m.desc}</p></div>
              <Switch checked={m.value} onCheckedChange={m.set} />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Payment Gateway */}
      <Card className="border-border">
        <CardHeader>
          <div className="flex items-center gap-2"><Zap className="h-5 w-5 text-primary" /><CardTitle className="text-lg">Gateway de Pagamento</CardTitle></div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select value={paymentGateway || "none"} onValueChange={(v) => setPaymentGateway(v === "none" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhum</SelectItem>
              {GATEWAYS.map((gw) => <SelectItem key={gw.id} value={gw.id}>{gw.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {selectedGateway && (
            <div className="space-y-4 rounded-lg border border-border p-4">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" style={{ color: selectedGateway.color }} />
                <span className="font-medium text-sm">{selectedGateway.name}</span>
                <Badge variant={gatewayEnvironment === "production" ? "default" : "secondary"} className="ml-auto">
                  {gatewayEnvironment === "production" ? "Produção" : "Sandbox"}
                </Badge>
              </div>
              <Select value={gatewayEnvironment} onValueChange={setGatewayEnvironment}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sandbox">Sandbox</SelectItem>
                  <SelectItem value="production">Produção</SelectItem>
                </SelectContent>
              </Select>
              <div className="space-y-2">
                <Label>{selectedGateway.publicKeyLabel}</Label>
                <Input value={gatewayPublicKey} onChange={(e) => setGatewayPublicKey(e.target.value)} placeholder={selectedGateway.publicKeyPlaceholder} className="font-mono text-xs" maxLength={500} />
              </div>
              <div className="flex items-start gap-2 rounded-md bg-muted p-3">
                <ShieldCheck className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                <p className="text-xs text-muted-foreground">A chave secreta deve ser configurada no backend.</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Store Slug (Multi-tenant) */}
      <Card className="border-border">
        <CardHeader>
          <div className="flex items-center gap-2"><Globe className="h-5 w-5 text-primary" /><CardTitle className="text-lg">URL da Loja (Slug)</CardTitle></div>
          <CardDescription>Identificador único da sua loja para acesso por URL</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label>Slug</Label>
            <Input value={storeSlug} onChange={(e) => setStoreSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} placeholder="minha-loja" maxLength={50} />
            {storeSlug && (
              <p className="text-xs text-muted-foreground">
                Sua loja ficará acessível em: <span className="font-mono font-medium">/loja/{storeSlug.toLowerCase().replace(/[^a-z0-9-]/g, "")}</span>
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Admin Colors */}
      <Card className="border-border">
        <CardHeader>
          <div className="flex items-center gap-2"><Palette className="h-5 w-5 text-primary" /><CardTitle className="text-lg">Cores do Painel Admin</CardTitle></div>
          <CardDescription>Personalize as cores do painel administrativo</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "Primária Admin", value: adminPrimaryColor, set: setAdminPrimaryColor },
              { label: "Destaque Admin", value: adminAccentColor, set: setAdminAccentColor },
            ].map((c) => (
              <div key={c.label} className="space-y-2">
                <Label>{c.label}</Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={c.value} onChange={(e) => c.set(e.target.value)} className="h-9 w-12 cursor-pointer rounded border border-border" />
                  <Input value={c.value} onChange={(e) => c.set(e.target.value)} className="font-mono text-xs" maxLength={7} />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Domain */}
      <Card className="border-border">
        <CardHeader>
          <div className="flex items-center gap-2"><Globe className="h-5 w-5 text-primary" /><CardTitle className="text-lg">Domínio</CardTitle></div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>Domínio personalizado</Label>
            <Input value={customDomain} onChange={(e) => setCustomDomain(e.target.value)} placeholder="minhaloja.com.br" maxLength={255} />
          </div>
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex justify-end pb-6">
        <Button onClick={handleSave} disabled={updateSettings.isPending} size="lg">
          {updateSettings.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Salvar Configurações
        </Button>
      </div>
    </div>
  );
}
