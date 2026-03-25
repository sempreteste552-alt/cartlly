import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Upload, X, Palette, Store, Globe, MapPin, Share2, Image, Clock, Trash2 } from "lucide-react";
import { useStoreSettings, useUpdateStoreSettings, useUploadStoreLogo } from "@/hooks/useStoreSettings";
import { useStoreBanners, useCreateBanner, useDeleteBanner } from "@/hooks/useStoreBanners";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

  useEffect(() => {
    if (settings) {
      setStoreName(settings.store_name);
      setStoreDescription((settings as any).store_description ?? "");
      setLogoUrl(settings.logo_url ?? "");
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
    } as any);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Configurações da Loja</h1>
        <p className="text-muted-foreground">Personalize a aparência e dados da sua loja</p>
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
          <div className="space-y-2"><Label>Localização (exibida no topo)</Label><Input value={storeLocation} onChange={(e) => setStoreLocation(e.target.value)} placeholder="São Paulo, SP" maxLength={100} /></div>
          <div className="space-y-2"><Label>Link Google Maps</Label><Input value={googleMapsUrl} onChange={(e) => setGoogleMapsUrl(e.target.value)} placeholder="https://maps.google.com/..." maxLength={500} /></div>
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
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Slug da Loja</Label>
            <Input value={storeSlug} onChange={(e) => setStoreSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} placeholder="minha-loja" maxLength={50} />
            {storeSlug && <p className="text-xs text-muted-foreground">Acessível em: <span className="font-mono font-medium">/loja/{storeSlug}</span></p>}
          </div>
          <div className="space-y-2">
            <Label>Domínio personalizado</Label>
            <Input value={customDomain} onChange={(e) => setCustomDomain(e.target.value)} placeholder="minhaloja.com.br" maxLength={255} />
          </div>
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
