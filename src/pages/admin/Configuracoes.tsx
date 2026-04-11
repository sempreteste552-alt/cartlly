import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Upload, X, Palette, Store, Globe, MapPin, Share2, Image, Clock, Trash2, Megaphone, KeyRound, Mail, Gift, LayoutDashboard, ShoppingBag, TrendingUp, Type, Bell, BadgeCheck, ArrowUp, ArrowDown } from "lucide-react";
import DomainConnector from "@/components/DomainConnector";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useStoreSettings, useUpdateStoreSettings, useUploadStoreLogo } from "@/hooks/useStoreSettings";
import { useStoreBanners, useCreateBanner, useUpdateBannerLink, useReorderBanners, useDeleteBanner } from "@/hooks/useStoreBanners";
import { useCategories } from "@/hooks/useCategories";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useTenantContext } from "@/hooks/useTenantContext";
import { canAccess } from "@/lib/planPermissions";
import { normalizeDomain } from "@/lib/storeDomain";
import { LockedFeature } from "@/components/LockedFeature";
import { toast } from "sonner";
import StoreAppearanceSettings from "@/components/admin/StoreAppearanceSettings";
import HomeBuilderManager from "@/components/admin/HomeBuilderManager";
import HighlightsManager from "@/components/admin/HighlightsManager";
import MarketingConversionSettings from "@/components/admin/MarketingConversionSettings";
import ProductPageSettings from "@/components/admin/ProductPageSettings";
import RestockAlertManager from "@/components/admin/RestockAlertManager";
import PushNotificationSettings from "@/components/admin/PushNotificationSettings";
import { FeatureTutorialCard } from "@/components/admin/FeatureTutorialCard";

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
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useStoreSettings();
  const updateSettings = useUpdateStoreSettings();
  const uploadLogo = useUploadStoreLogo();
  const { data: banners } = useStoreBanners();
  const createBanner = useCreateBanner();
  const updateBannerLink = useUpdateBannerLink();
  const reorderBanners = useReorderBanners();
  const deleteBanner = useDeleteBanner();
  const { data: categories } = useCategories();

  const moveBanner = (index: number, direction: "up" | "down") => {
    if (!banners) return;
    const arr = [...banners];
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= arr.length) return;
    [arr[index], arr[newIndex]] = [arr[newIndex], arr[index]];
    reorderBanners.mutate(arr.map((b) => b.id));
  };
  const { ctx } = useTenantContext();
  const fileRef = useRef<HTMLInputElement>(null);
  const bannerFileRef = useRef<HTMLInputElement>(null);
  const faviconFileRef = useRef<HTMLInputElement>(null);

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
  const [headerTextColor, setHeaderTextColor] = useState("#000000");
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
  const [bannerMobileFormat, setBannerMobileFormat] = useState("landscape");
  const [faviconUrl, setFaviconUrl] = useState("");
  const [isVerified, setIsVerified] = useState(false);
  const [storeCategory, setStoreCategory] = useState("");
  const [uploadingFavicon, setUploadingFavicon] = useState(false);

  useEffect(() => {
    if (settings) {
      setStoreName(settings.store_name);
      setStoreDescription((settings as any).store_description ?? "");
      setLogoUrl(settings.logo_url ?? "");
      setLogoSize((settings as any).logo_size ?? 32);
      setPrimaryColor(settings.primary_color);
      setPageBgColor((settings as any).page_bg_color ?? "#ffffff");
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
      setHeaderTextColor((settings as any).header_text_color ?? "#000000");
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
      setBannerMobileFormat((settings as any).banner_mobile_format ?? "landscape");
      setFaviconUrl((settings as any).favicon_url ?? "");
      setIsVerified((settings as any).is_verified ?? false);
      setStoreCategory((settings as any).store_category ?? "");
    }
  }, [settings]);

  const handleFaviconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 512 * 1024) { toast.error("Favicon deve ter no máximo 512KB"); return; }
    setUploadingFavicon(true);
    try {
      // Delete old favicon file if exists
      if (faviconUrl) {
        const oldPath = faviconUrl.split("/store-assets/")[1];
        if (oldPath) {
          await supabase.storage.from("store-assets").remove([decodeURIComponent(oldPath)]);
        }
      }
      const ext = file.name.split(".").pop();
      const fileName = `${user!.id}/favicon-${crypto.randomUUID().slice(0, 8)}.${ext}`;
      const { error } = await supabase.storage.from("store-assets").upload(fileName, file, { contentType: file.type, upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("store-assets").getPublicUrl(fileName);
      const newUrl = urlData.publicUrl;
      setFaviconUrl(newUrl);
      // Auto-save favicon and invalidate cache
      if (settings) {
        await supabase.from("store_settings").update({ favicon_url: newUrl } as any).eq("id", settings.id);
        queryClient.invalidateQueries({ queryKey: ["store_settings"] });
        toast.success("Favicon salvo!");
      }
    } catch (err: any) {
      toast.error("Erro ao enviar favicon: " + (err.message || "Erro"));
    } finally {
      setUploadingFavicon(false);
      if (faviconFileRef.current) faviconFileRef.current.value = "";
    }
  };

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
    const fileName = `${user!.id}/banners/banner-${crypto.randomUUID()}.${ext}`;
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
      page_bg_color: pageBgColor,
      secondary_color: secondaryColor,
      accent_color: accentColor,
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
      header_text_color: headerTextColor,
      footer_bg_color: footerBgColor,
      footer_text_color: footerTextColor,
      welcome_coupon_enabled: welcomeCouponEnabled,
      welcome_coupon_discount_type: welcomeCouponDiscountType,
      welcome_coupon_discount_value: welcomeCouponDiscountValue,
      welcome_coupon_min_order: welcomeCouponMinOrder ? Number(welcomeCouponMinOrder) : null,
      welcome_coupon_expires_days: welcomeCouponExpiresDays,
      banner_mobile_format: bannerMobileFormat,
      is_verified: isVerified,
      favicon_url: faviconUrl || null,
      store_category: storeCategory.trim() || null,
    } as any);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div id="config-header" className="space-y-6">
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
      
      {/* Verified Badge */}
      <LockedFeature isLocked={!canAccess("verified_badge", ctx)} featureName="Selo de Verificado">
        <Card className="border-border">
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <BadgeCheck className="h-5 w-5 text-blue-500 fill-blue-500 stroke-white" />
              <div>
                <p className="font-medium">Selo de Verificado</p>
                <p className="text-xs text-muted-foreground">Exibe um selo de verificado ao lado do nome da sua loja</p>
              </div>
            </div>
            <Switch checked={isVerified} onCheckedChange={setIsVerified} />
          </CardContent>
        </Card>
      </LockedFeature>

      {/* Marquee */}
      <LockedFeature isLocked={!canAccess("banners", ctx)} featureName="Letreiro (Marquee)">
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
      </LockedFeature>


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
            <Label>Categoria da Loja / Nicho (IA)</Label>
            <Select value={storeCategory} onValueChange={setStoreCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o nicho da sua loja" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Doceria">🍰 Doceria</SelectItem>
                <SelectItem value="Moda">👗 Moda</SelectItem>
                <SelectItem value="Pet Shop">🐾 Pet Shop</SelectItem>
                <SelectItem value="Eletrônicos">📱 Eletrônicos</SelectItem>
                <SelectItem value="Alimentação">🍴 Alimentação</SelectItem>
                <SelectItem value="Beleza">💄 Beleza</SelectItem>
                <SelectItem value="Infantil">🧸 Infantil</SelectItem>
                <SelectItem value="Joalheria">💍 Joalheria</SelectItem>
                <SelectItem value="Outros">⚙️ Outros</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Isso ajuda a IA a adaptar o tom e as frases para o seu público</p>
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
        <CardContent className="space-y-4">
          {/* Mobile format selector */}
          <div className="space-y-2">
            <Label>Formato do Banner em Mobile</Label>
            <Select value={bannerMobileFormat} onValueChange={setBannerMobileFormat}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="landscape">Paisagem (padrão)</SelectItem>
                <SelectItem value="square">Quadrado (Instagram Post)</SelectItem>
                <SelectItem value="portrait">Retrato (4:5)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Escolha como o banner aparece em celulares</p>
          </div>

          <Separator />

          <div className="space-y-3">
            {banners?.map((b, index) => (
              <div key={b.id} className="border border-border rounded-lg p-3 space-y-2">
                <div className="flex gap-3 items-start">
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <Button variant="ghost" size="icon" className="h-6 w-6" disabled={index === 0} onClick={() => moveBanner(index, "up")}>
                      <ArrowUp className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" disabled={index === (banners?.length ?? 1) - 1} onClick={() => moveBanner(index, "down")}>
                      <ArrowDown className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="relative group shrink-0">
                    {(b as any).media_type === "video" ? (
                      <video src={b.image_url} className="w-24 h-16 rounded object-cover border border-border" muted loop playsInline onMouseEnter={(e) => (e.target as HTMLVideoElement).play()} onMouseLeave={(e) => { const v = e.target as HTMLVideoElement; v.pause(); v.currentTime = 0; }} />
                    ) : (
                      <img src={b.image_url} alt="Banner" className="w-24 h-16 rounded object-cover border border-border" />
                    )}
                    <Badge variant="secondary" className="absolute bottom-0.5 left-0.5 text-[9px] px-1">{(b as any).media_type === "video" ? "Vídeo" : "Imagem"}</Badge>
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <Label className="text-xs">Link de redirecionamento</Label>
                    <div className="flex gap-1">
                      <Input
                        placeholder="https://..."
                        defaultValue={(b as any).link_url || ""}
                        className="h-8 text-xs"
                        onBlur={(e) => {
                          const val = e.target.value.trim() || null;
                          if (val !== ((b as any).link_url || null)) {
                            updateBannerLink.mutate({ id: b.id, link_url: val });
                          }
                        }}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground">Ao clicar no banner, redireciona para este link</p>
                    <Label className="text-xs mt-2">Ou redirecionar para categoria</Label>
                    <Select
                      value={(b as any).category_id || "none"}
                      onValueChange={(val) => {
                        const categoryId = val === "none" ? null : val;
                        updateBannerLink.mutate({ id: b.id, category_id: categoryId });
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Nenhuma categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhuma categoria</SelectItem>
                        {categories?.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[10px] text-muted-foreground">Se selecionada, o clique filtra pela categoria na loja</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      if (confirm("Remover este banner?")) {
                        deleteBanner.mutate(b.id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
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
      <LockedFeature isLocked={!canAccess("design_customization", ctx)} featureName="Personalização de Cores">
        <Card className="border-border">
          <CardHeader>
            <div className="flex items-center gap-2"><Palette className="h-5 w-5 text-primary" /><CardTitle className="text-lg">Cores da Loja</CardTitle></div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Primária", value: primaryColor, set: setPrimaryColor },
                { label: "Secundária", value: secondaryColor, set: setSecondaryColor },
                { label: "Destaque", value: accentColor, set: setAccentColor },
                { label: "Fundo Site", value: pageBgColor, set: setPageBgColor },
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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Fundo Cabeçalho", value: headerBgColor, set: setHeaderBgColor },
                { label: "Texto Cabeçalho", value: headerTextColor, set: setHeaderTextColor },
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
      </LockedFeature>

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

      <LockedFeature isLocked={!canAccess("custom_domain", ctx)} featureName="Domínio Personalizado">
        {settings?.id && <DomainConnector settingsId={settings.id} />}

        {/* Favicon Upload */}
        <Card className="border-border mt-4">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Image className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Favicon</CardTitle>
            </div>
            <CardDescription>Ícone exibido na aba do navegador da sua loja</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {faviconUrl && (
              <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30">
                <img src={faviconUrl} alt="Favicon" className="h-8 w-8 rounded object-contain" />
                <span className="text-xs text-muted-foreground truncate flex-1">{faviconUrl.split("/").pop()}</span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={async () => {
                  const oldUrl = faviconUrl;
                  setFaviconUrl("");
                  if (settings) {
                    // Delete file from storage
                    if (oldUrl) {
                      const oldPath = oldUrl.split("/store-assets/")[1];
                      if (oldPath) {
                        await supabase.storage.from("store-assets").remove([decodeURIComponent(oldPath)]);
                      }
                    }
                    await supabase.from("store_settings").update({ favicon_url: null } as any).eq("id", settings.id);
                    queryClient.invalidateQueries({ queryKey: ["store_settings"] });
                    toast.success("Favicon removido!");
                  }
                }}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                ref={faviconFileRef}
                type="file"
                accept="image/png,image/x-icon,image/svg+xml,image/jpeg"
                className="hidden"
                onChange={handleFaviconUpload}
              />
              <Button variant="outline" size="sm" onClick={() => faviconFileRef.current?.click()} disabled={uploadingFavicon}>
                {uploadingFavicon ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
                {faviconUrl ? "Alterar Favicon" : "Enviar Favicon"}
              </Button>
              <span className="text-xs text-muted-foreground">PNG, ICO ou SVG (máx. 512KB)</span>
            </div>
          </CardContent>
        </Card>
      </LockedFeature>

      {/* Welcome Coupon */}
      <LockedFeature isLocked={!canAccess("coupons", ctx)} featureName="Cupom de Boas-Vindas">
        <Card className="border-border">
          <CardHeader>
            <div className="flex items-center gap-2"><Gift className="h-5 w-5 text-primary" /><CardTitle className="text-lg">Cupom de Boas-Vindas</CardTitle></div>
            <CardDescription>Gere automaticamente um cupom de desconto para novos clientes</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Ativar cupom automático</p>
                <p className="text-xs text-muted-foreground">Envia um cupom exclusivo via e-mail ou exibe no site</p>
              </div>
              <Switch checked={welcomeCouponEnabled} onCheckedChange={setWelcomeCouponEnabled} />
            </div>
            {welcomeCouponEnabled && (
              <div className="grid gap-4 pt-2">
                <div className="grid grid-cols-2 gap-4">
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
                    <Input type="number" value={welcomeCouponDiscountValue} onChange={(e) => setWelcomeCouponDiscountValue(Number(e.target.value))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Valor Mínimo (Opcional)</Label>
                    <Input type="number" value={welcomeCouponMinOrder} onChange={(e) => setWelcomeCouponMinOrder(e.target.value)} placeholder="0,00" />
                  </div>
                  <div className="space-y-2">
                    <Label>Expira em (dias)</Label>
                    <Input type="number" value={welcomeCouponExpiresDays} onChange={(e) => setWelcomeCouponExpiresDays(Number(e.target.value))} />
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </LockedFeature>

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
  const { ctx } = useTenantContext();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") || "general";

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Configurações da Loja</h1>
        <p className="text-muted-foreground">Personalize a aparência, funcionalidades e marketing da sua loja</p>
      </div>

      <Tabs defaultValue={initialTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5 h-auto">
          <TabsTrigger value="general" className="flex items-center gap-1.5 text-xs py-2">
            <Store className="h-4 w-4" />
            <span className="hidden sm:inline">Geral</span>
          </TabsTrigger>
          <TabsTrigger value="appearance" className="flex items-center gap-1 text-xs py-2 relative">
            <Type className="h-4 w-4" />
            <span className="hidden sm:inline">Aparência</span>
            <span className="absolute -top-1 -right-1 text-[7px] font-bold uppercase px-1 py-0.5 rounded-full bg-primary text-primary-foreground animate-pulse leading-none">Novo</span>
          </TabsTrigger>
          <TabsTrigger value="home" className="flex items-center gap-1 text-xs py-2 relative">
            <LayoutDashboard className="h-4 w-4" />
            <span className="hidden sm:inline">Home</span>
            <span className="absolute -top-1 -right-1 text-[7px] font-bold uppercase px-1 py-0.5 rounded-full bg-primary text-primary-foreground animate-pulse leading-none">Novo</span>
          </TabsTrigger>
          <TabsTrigger value="product" className="flex items-center gap-1 text-xs py-2 relative">
            <ShoppingBag className="h-4 w-4" />
            <span className="hidden sm:inline">Produto</span>
            <span className="absolute -top-1 -right-1 text-[7px] font-bold uppercase px-1 py-0.5 rounded-full bg-primary text-primary-foreground animate-pulse leading-none">Novo</span>
          </TabsTrigger>
          <TabsTrigger value="marketing" className="flex items-center gap-1 text-xs py-2 relative">
            <TrendingUp className="h-4 w-4" />
            <span className="hidden sm:inline">Marketing</span>
            <span className="absolute -top-1 -right-1 text-[7px] font-bold uppercase px-1 py-0.5 rounded-full bg-primary text-primary-foreground animate-pulse leading-none">Novo</span>
          </TabsTrigger>
          <TabsTrigger value="push" className="flex items-center gap-1 text-xs py-2 relative">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Push</span>
            <span className="absolute -top-1 -right-1 text-[7px] font-bold uppercase px-1 py-0.5 rounded-full bg-primary text-primary-foreground animate-pulse leading-none">Novo</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-6">
          <GeneralSettingsTab />
        </TabsContent>

        <TabsContent value="appearance" className="mt-6">
          <LockedFeature isLocked={!canAccess("appearance_settings", ctx)} featureName="Personalização de Aparência">
          <FeatureTutorialCard
            id="appearance_settings"
            title="Personalização de Aparência"
            description="Ajuste os detalhes visuais para criar uma experiência única para seus clientes."
            steps={[
              "Escolha fontes para títulos e textos",
              "Ajuste bordas e sombras dos cards",
              "Defina colunas para celular e computador",
              "Estilize o cabeçalho e rodapé"
            ]}
          />
          <StoreAppearanceSettings />
          </LockedFeature>
        </TabsContent>

        <TabsContent value="home" className="mt-6 space-y-8">
          <LockedFeature isLocked={!canAccess("restock_alerts", ctx)} featureName="Alerta de Reposição">
            <RestockAlertManager />
          </LockedFeature>
          <LockedFeature isLocked={!canAccess("highlights_stories", ctx)} featureName="Destaques (Stories)">
            <HighlightsManager />
          </LockedFeature>
          <LockedFeature isLocked={!canAccess("home_builder", ctx)} featureName="Editor da Home">
            <HomeBuilderManager />
          </LockedFeature>
        </TabsContent>

        <TabsContent value="product" className="mt-6">
          <FeatureTutorialCard
            id="product_page_tutorial"
            title="Página de Produto"
            description="Configure como os detalhes e fotos do seu produto são exibidos."
            steps={[
              "Defina o layout da galeria de fotos",
              "Configure o botão de compra",
              "Ative ou desative visualizações",
              "Personalize o status de estoque"
            ]}
          />
          <ProductPageSettings />
        </TabsContent>

        <TabsContent value="marketing" className="mt-6">
          <FeatureTutorialCard
            id="marketing_tutorial"
            title="Marketing e Conversão"
            description="Ferramentas para aumentar suas vendas e rastrear resultados."
            steps={[
              "Configure Google e Facebook Pixels",
              "Otimize sua loja para o Google (SEO)",
              "Crie estratégias de cupons",
              "Ative selos de confiança"
            ]}
          />
          <MarketingConversionSettings />
        </TabsContent>

        <TabsContent value="push" className="mt-6">
          <LockedFeature isLocked={!canAccess("push_customers", ctx)} featureName="Push Notifications">
            <PushNotificationSettings />
          </LockedFeature>
        </TabsContent>
      </Tabs>
    </div>
  );
}
