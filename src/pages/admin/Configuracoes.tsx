import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Upload, X, Palette, Store, Globe, MapPin, Share2, Image, Clock, Trash2, Megaphone, KeyRound, Mail, Gift, LayoutDashboard, ShoppingBag, TrendingUp, Type } from "lucide-react";
import DomainConnector from "@/components/DomainConnector";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useStoreSettings, useUpdateStoreSettings, useUploadStoreLogo } from "@/hooks/useStoreSettings";
import { useStoreBanners, useCreateBanner, useDeleteBanner } from "@/hooks/useStoreBanners";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTenantContext } from "@/hooks/useTenantContext";
import { canAccess } from "@/lib/planPermissions";
import { LockedFeature } from "@/components/LockedFeature";
import { toast } from "sonner";
import StoreAppearanceSettings from "@/components/admin/StoreAppearanceSettings";
import HomeBuilderManager from "@/components/admin/HomeBuilderManager";
import MarketingConversionSettings from "@/components/admin/MarketingConversionSettings";
import ProductPageSettings from "@/components/admin/ProductPageSettings";


function AccountEmailChanger() {
  const [newEmail, setNewEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChangeEmail = async () => {
    if (!newEmail.trim()) return toast.error("Informe o novo e-mail");
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
      if (error) throw error;
      toast.success("E-mail de confirmação enviado para o novo endereço!");
      setNewEmail("");
    } catch (err: any) {
      toast.error(err.message || "Erro ao alterar e-mail");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label>Novo E-mail</Label>
      <div className="flex gap-2">
        <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="novo@email.com" />
        <Button onClick={handleChangeEmail} disabled={loading} variant="outline">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Alterar"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Você receberá um e-mail de confirmação nos dois endereços</p>
    </div>
  );
}

function AccountPasswordChanger() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChangePassword = async () => {
    if (!newPassword.trim()) return toast.error("Informe a nova senha");
    if (newPassword.length < 6) return toast.error("Senha deve ter no mínimo 6 caracteres");
    if (newPassword !== confirmPassword) return toast.error("As senhas não coincidem");
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Senha alterada com sucesso!");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast.error(err.message || "Erro ao alterar senha");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label>Nova Senha</Label>
      <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
      <Label>Confirmar Senha</Label>
      <div className="flex gap-2">
        <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repita a nova senha" />
        <Button onClick={handleChangePassword} disabled={loading} variant="outline">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Alterar"}
        </Button>
      </div>
    </div>
  );
}

function GeneralSettingsTab() {
  const { user } = useAuth();
  const { data: settings, isLoading } = useStoreSettings();
  const updateSettings = useUpdateStoreSettings();
  const uploadLogo = useUploadStoreLogo();
  const { data: banners } = useStoreBanners();
  const createBanner = useCreateBanner();
  const deleteBanner = useDeleteBanner();
  const { ctx } = useTenantContext();
  const fileRef = useRef<HTMLInputElement>(null);
  const bannerFileRef = useRef<HTMLInputElement>(null);

  const [storeName, setStoreName] = useState("");
  const [storeDescription, setStoreDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [logoSize, setLogoSize] = useState(32);
  const [primaryColor, setPrimaryColor] = useState("#6d28d9");
  const [pageBgColor, setPageBgColor] = useState("#ffffff");
  const [secondaryColor, setSecondaryColor] = useState("#f5f3ff");
  const [accentColor, setAccentColor] = useState("#8b5cf6");
  const [customDomain, setCustomDomain] = useState("");
  const [storeAddress, setStoreAddress] = useState("");
  const [storePhone, setStorePhone] = useState("");
  const [storeWhatsapp, setStoreWhatsapp] = useState("");
  const [googleMapsUrl, setGoogleMapsUrl] = useState("");
  const [facebookUrl, setFacebookUrl] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [tiktokUrl, setTiktokUrl] = useState("");
  const [twitterUrl, setTwitterUrl] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [storeOpen, setStoreOpen] = useState(true);
  const [storeLocation, setStoreLocation] = useState("");
  const [storeSlug, setStoreSlug] = useState("");
  const [adminPrimaryColor, setAdminPrimaryColor] = useState("#6d28d9");
  const [adminAccentColor, setAdminAccentColor] = useState("#8b5cf6");
  const [buttonColor, setButtonColor] = useState("#000000");
  const [buttonTextColor, setButtonTextColor] = useState("#ffffff");
  const [headerBgColor, setHeaderBgColor] = useState("#ffffff");
  const [footerBgColor, setFooterBgColor] = useState("#000000");
  const [footerTextColor, setFooterTextColor] = useState("#ffffff");
  const [marqueeEnabled, setMarqueeEnabled] = useState(false);
  const [marqueeText, setMarqueeText] = useState("");
  const [marqueeSpeed, setMarqueeSpeed] = useState(50);
  const [marqueeBgColor, setMarqueeBgColor] = useState("#000000");
  const [marqueeTextColor, setMarqueeTextColor] = useState("#ffffff");
  const [welcomeCouponEnabled, setWelcomeCouponEnabled] = useState(false);
  const [welcomeCouponDiscountType, setWelcomeCouponDiscountType] = useState("percentage");
  const [welcomeCouponDiscountValue, setWelcomeCouponDiscountValue] = useState(10);
  const [welcomeCouponMinOrder, setWelcomeCouponMinOrder] = useState<string>("");
  const [welcomeCouponExpiresDays, setWelcomeCouponExpiresDays] = useState(30);

  useEffect(() => {
    if (settings) {
      setStoreName(settings.store_name);
      setStoreDescription((settings as any).store_description ?? "");
      setLogoUrl(settings.logo_url ?? "");
      setLogoSize((settings as any).logo_size ?? 32);
      setPrimaryColor(settings.primary_color);
      setSecondaryColor(settings.secondary_color);
      setAccentColor(settings.accent_color);
      setCustomDomain(settings.custom_domain ?? "");
      setStoreAddress((settings as any).store_address ?? "");
      setStorePhone((settings as any).store_phone ?? "");
      setStoreWhatsapp((settings as any).store_whatsapp ?? "");
      setGoogleMapsUrl((settings as any).google_maps_url ?? "");
      setFacebookUrl((settings as any).facebook_url ?? "");
      setInstagramUrl((settings as any).instagram_url ?? "");
      setTiktokUrl((settings as any).tiktok_url ?? "");
      setTwitterUrl((settings as any).twitter_url ?? "");
      setYoutubeUrl((settings as any).youtube_url ?? "");
      setStoreOpen((settings as any).store_open ?? true);
      setStoreLocation((settings as any).store_location ?? "");
      setStoreSlug((settings as any).store_slug ?? "");
      setAdminPrimaryColor((settings as any).admin_primary_color ?? "#6d28d9");
      setAdminAccentColor((settings as any).admin_accent_color ?? "#8b5cf6");
      setButtonColor((settings as any).button_color ?? "#000000");
      setButtonTextColor((settings as any).button_text_color ?? "#ffffff");
      setHeaderBgColor((settings as any).header_bg_color ?? "#ffffff");
      setFooterBgColor((settings as any).footer_bg_color ?? "#000000");
      setFooterTextColor((settings as any).footer_text_color ?? "#ffffff");
      setMarqueeEnabled((settings as any).marquee_enabled ?? false);
      setMarqueeText((settings as any).marquee_text ?? "");
      setMarqueeSpeed((settings as any).marquee_speed ?? 50);
      setMarqueeBgColor((settings as any).marquee_bg_color ?? "#000000");
      setMarqueeTextColor((settings as any).marquee_text_color ?? "#ffffff");
      setWelcomeCouponEnabled(settings.welcome_coupon_enabled ?? false);
      setWelcomeCouponDiscountType(settings.welcome_coupon_discount_type ?? "percentage");
      setWelcomeCouponDiscountValue(settings.welcome_coupon_discount_value ?? 10);
      setWelcomeCouponMinOrder(settings.welcome_coupon_min_order ? String(settings.welcome_coupon_min_order) : "");
      setWelcomeCouponExpiresDays(settings.welcome_coupon_expires_days ?? 30);
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
      custom_domain: customDomain.trim() || null,
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
      store_open: storeOpen,
      store_location: storeLocation.trim() || null,
      store_slug: storeSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "") || null,
      admin_primary_color: adminPrimaryColor,
      admin_accent_color: adminAccentColor,
      marquee_enabled: marqueeEnabled,
      marquee_text: marqueeText.trim(),
      marquee_speed: marqueeSpeed,
      marquee_bg_color: marqueeBgColor,
      marquee_text_color: marqueeTextColor,
      logo_size: logoSize,
      button_color: buttonColor,
      button_text_color: buttonTextColor,
      header_bg_color: headerBgColor,
      footer_bg_color: footerBgColor,
      footer_text_color: footerTextColor,
      welcome_coupon_enabled: welcomeCouponEnabled,
      welcome_coupon_discount_type: welcomeCouponDiscountType,
      welcome_coupon_discount_value: welcomeCouponDiscountValue,
      welcome_coupon_min_order: welcomeCouponMinOrder ? Number(welcomeCouponMinOrder) : null,
      welcome_coupon_expires_days: welcomeCouponExpiresDays,
    } as any);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
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

      {/* Marquee */}
      <Card className="border-border">
        <CardHeader>
          <div className="flex items-center gap-2"><Megaphone className="h-5 w-5 text-primary" /><CardTitle className="text-lg">Letreiro (Marquee)</CardTitle></div>
          <CardDescription>Texto animado exibido no topo da loja</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Ativar Letreiro</Label>
            <Switch checked={marqueeEnabled} onCheckedChange={setMarqueeEnabled} />
          </div>
          {marqueeEnabled && (
            <>
              <div className="space-y-2">
                <Label>Texto do Letreiro</Label>
                <Input value={marqueeText} onChange={(e) => setMarqueeText(e.target.value)} placeholder="🔥 Promoção de verão! Até 50% OFF em todos os produtos!" maxLength={300} />
              </div>
              <div className="space-y-2">
                <Label>Velocidade ({marqueeSpeed}%)</Label>
                <Slider value={[marqueeSpeed]} onValueChange={([v]) => setMarqueeSpeed(v)} min={10} max={100} step={5} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Cor de Fundo</Label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={marqueeBgColor} onChange={(e) => setMarqueeBgColor(e.target.value)} className="h-9 w-12 cursor-pointer rounded border border-border" />
                    <Input value={marqueeBgColor} onChange={(e) => setMarqueeBgColor(e.target.value)} className="font-mono text-xs" maxLength={7} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Cor do Texto</Label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={marqueeTextColor} onChange={(e) => setMarqueeTextColor(e.target.value)} className="h-9 w-12 cursor-pointer rounded border border-border" />
                    <Input value={marqueeTextColor} onChange={(e) => setMarqueeTextColor(e.target.value)} className="font-mono text-xs" maxLength={7} />
                  </div>
                </div>
              </div>
              <div className="rounded-lg overflow-hidden border border-border">
                <div className="overflow-hidden whitespace-nowrap py-2 text-sm font-medium" style={{ backgroundColor: marqueeBgColor, color: marqueeTextColor }}>
                  <span className="inline-block animate-pulse">{marqueeText || "Preview do letreiro..."}</span>
                </div>
              </div>
            </>
          )}
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
                  <img src={logoUrl} alt="Logo" className="rounded-lg object-contain border border-border bg-card p-1" style={{ height: `${logoSize}px` }} />
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
          <div className="space-y-2">
            <Label>Tamanho da Logo ({logoSize}px)</Label>
            <Slider value={[logoSize]} onValueChange={([v]) => setLogoSize(v)} min={24} max={120} step={4} />
          </div>
        </CardContent>
      </Card>

      {/* Banners */}
      <Card className="border-border">
        <CardHeader>
          <div className="flex items-center gap-2"><Image className="h-5 w-5 text-primary" /><CardTitle className="text-lg">Banners</CardTitle></div>
          <CardDescription>Carrossel de banners na página inicial</CardDescription>
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
            <Upload className="mr-2 h-4 w-4" /> Adicionar Banner
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
            <div className="space-y-2"><Label>Telefone</Label><Input value={storePhone} onChange={(e) => setStorePhone(e.target.value)} placeholder="(11) 3333-3333" maxLength={20} /></div>
            <div className="space-y-2"><Label>WhatsApp</Label><Input value={storeWhatsapp} onChange={(e) => setStoreWhatsapp(e.target.value)} placeholder="5511999999999" maxLength={20} /></div>
          </div>
          <div className="space-y-2"><Label>Endereço</Label><Input value={storeAddress} onChange={(e) => setStoreAddress(e.target.value)} placeholder="Rua, número, cidade - UF" maxLength={300} /></div>
          <div className="space-y-2"><Label>Localização</Label><Input value={storeLocation} onChange={(e) => setStoreLocation(e.target.value)} placeholder="São Paulo, SP" maxLength={100} /></div>
          <div className="space-y-2"><Label>Link Google Maps</Label><Input value={googleMapsUrl} onChange={(e) => setGoogleMapsUrl(e.target.value)} placeholder="https://maps.google.com/..." maxLength={500} /></div>
        </CardContent>
      </Card>

      {/* Social */}
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
          <Separator />
          <p className="text-sm font-medium text-foreground">Botões</p>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "Cor do Botão", value: buttonColor, set: setButtonColor },
              { label: "Texto do Botão", value: buttonTextColor, set: setButtonTextColor },
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
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">Preview:</span>
            <button className="px-4 py-2 rounded-md text-sm font-medium" style={{ backgroundColor: buttonColor, color: buttonTextColor }}>Comprar Agora</button>
          </div>
          <Separator />
          <p className="text-sm font-medium text-foreground">Cabeçalho e Rodapé</p>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Fundo Cabeçalho", value: headerBgColor, set: setHeaderBgColor },
              { label: "Fundo Rodapé", value: footerBgColor, set: setFooterBgColor },
              { label: "Texto Rodapé", value: footerTextColor, set: setFooterTextColor },
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

      {/* Admin Colors */}
      <Card className="border-border">
        <CardHeader>
          <div className="flex items-center gap-2"><Palette className="h-5 w-5 text-primary" /><CardTitle className="text-lg">Cores do Painel Admin</CardTitle></div>
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

      {/* Slug & Domain */}
      <Card className="border-border">
        <CardHeader>
          <div className="flex items-center gap-2"><Globe className="h-5 w-5 text-primary" /><CardTitle className="text-lg">URL e Domínio</CardTitle></div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Slug da Loja</Label>
            <div className="flex items-center gap-0">
              <span className="inline-flex h-10 items-center rounded-l-md border border-r-0 border-input bg-muted px-3 text-xs text-muted-foreground">/loja/</span>
              <Input value={storeSlug} onChange={(e) => setStoreSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} placeholder="minha-loja" maxLength={50} className="rounded-l-none" />
            </div>
            {storeSlug && (
              <p className="text-xs text-muted-foreground">Acessível em: <span className="font-mono font-medium text-primary">{window.location.origin}/loja/{storeSlug}</span></p>
            )}
          </div>
        </CardContent>
      </Card>

      <DomainConnector settingsId={settings?.id} currentDomain={customDomain} domainStatus={(settings as any)?.domain_status || "none"} lastCheck={(settings as any)?.domain_last_check} storeSlug={storeSlug} onDomainChange={setCustomDomain} onSave={handleSave} />

      {/* Welcome Coupon */}
      <Card className="border-border">
        <CardHeader>
          <div className="flex items-center gap-2"><Gift className="h-5 w-5 text-primary" /><CardTitle className="text-lg">Cupom de Boas-Vindas</CardTitle></div>
          <CardDescription>Gere automaticamente um cupom de desconto para novos clientes</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">Ativar cupom automático</p>
              <p className="text-xs text-muted-foreground">Novos clientes recebem cupom ao se cadastrar</p>
            </div>
            <Switch checked={welcomeCouponEnabled} onCheckedChange={setWelcomeCouponEnabled} />
          </div>
          {welcomeCouponEnabled && (
            <div className="space-y-4 pt-2 border-t border-border">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Tipo de Desconto</Label>
                  <Select value={welcomeCouponDiscountType} onValueChange={setWelcomeCouponDiscountType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Porcentagem (%)</SelectItem>
                      <SelectItem value="fixed">Valor Fixo (R$)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Valor do Desconto</Label>
                  <Input type="number" value={welcomeCouponDiscountValue} onChange={(e) => setWelcomeCouponDiscountValue(Number(e.target.value))} min={1} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Pedido Mínimo (R$)</Label>
                  <Input type="number" value={welcomeCouponMinOrder} onChange={(e) => setWelcomeCouponMinOrder(e.target.value)} placeholder="Sem mínimo" />
                </div>
                <div className="space-y-2">
                  <Label>Validade (dias)</Label>
                  <Input type="number" value={welcomeCouponExpiresDays} onChange={(e) => setWelcomeCouponExpiresDays(Number(e.target.value))} min={1} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">O cliente receberá um cupom único ao se cadastrar, válido por {welcomeCouponExpiresDays} dia(s).</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Account */}
      <Card className="border-border">
        <CardHeader>
          <div className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-primary" /><CardTitle className="text-lg">Conta e Segurança</CardTitle></div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-border p-3">
            <div className="flex items-center gap-2 mb-1">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">E-mail atual</span>
            </div>
            <p className="text-sm text-muted-foreground ml-6">{user?.email || "—"}</p>
          </div>
          <AccountEmailChanger />
          <Separator />
          <AccountPasswordChanger />
        </CardContent>
      </Card>

      <div className="flex justify-end pb-6">
        <Button onClick={handleSave} disabled={updateSettings.isPending} size="lg">
          {updateSettings.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Salvar Configurações
        </Button>
      </div>
    </div>
  );
}


export default function Configuracoes() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Configurações da Loja</h1>
        <p className="text-muted-foreground">Personalize a aparência, funcionalidades e marketing da sua loja</p>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-5 h-auto">
          <TabsTrigger value="general" className="flex items-center gap-1.5 text-xs py-2">
            <Store className="h-4 w-4" />
            <span className="hidden sm:inline">Geral</span>
          </TabsTrigger>
          <TabsTrigger value="appearance" className="flex items-center gap-1.5 text-xs py-2">
            <Type className="h-4 w-4" />
            <span className="hidden sm:inline">Aparência</span>
          </TabsTrigger>
          <TabsTrigger value="home" className="flex items-center gap-1.5 text-xs py-2">
            <LayoutDashboard className="h-4 w-4" />
            <span className="hidden sm:inline">Home</span>
          </TabsTrigger>
          <TabsTrigger value="product" className="flex items-center gap-1.5 text-xs py-2">
            <ShoppingBag className="h-4 w-4" />
            <span className="hidden sm:inline">Produto</span>
          </TabsTrigger>
          <TabsTrigger value="marketing" className="flex items-center gap-1.5 text-xs py-2">
            <TrendingUp className="h-4 w-4" />
            <span className="hidden sm:inline">Marketing</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-6">
          <GeneralSettingsTab />
        </TabsContent>

        <TabsContent value="appearance" className="mt-6">
          <StoreAppearanceSettings />
        </TabsContent>

        <TabsContent value="home" className="mt-6">
          <HomeBuilderManager />
        </TabsContent>

        <TabsContent value="product" className="mt-6">
          <ProductPageSettings />
        </TabsContent>

        <TabsContent value="marketing" className="mt-6">
          <MarketingConversionSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
