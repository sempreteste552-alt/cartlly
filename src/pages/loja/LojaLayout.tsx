import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { Outlet, Link, useNavigate, useParams, useLocation } from "react-router-dom";
import { useMemo } from "react";
import { StorefrontAIChat } from "@/components/storefront/StorefrontAIChat";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePublicMarketingConfig } from "@/hooks/usePublicStoreConfig";
import { AnnouncementBar, FreeShippingBar, PopupCoupon, CountdownBar } from "@/components/storefront/MarketingWidgets";
import { RestockAlertCard } from "@/components/storefront/RestockAlertCard";
import { PWAInstallBanner } from "@/components/storefront/PWAInstallBanner";
import { SmartSearchBar } from "@/components/storefront/SmartSearchBar";
import { StoreFilter } from "@/components/storefront/StoreFilter";
import { PushPermissionPrompt } from "@/components/storefront/PushPermissionPrompt";
import { usePublicThemeConfig, usePublicProductPageConfig, useResolvedPublicStore, usePublicProducts, usePublicCategories } from "@/hooks/usePublicStore";
import { usePwaManifest } from "@/hooks/usePwaManifest";
import { useCart } from "@/hooks/useCart";
import { useCustomerAuth } from "@/hooks/useCustomerAuth";
import { ShoppingCart, Menu, X, Search, MapPin, Phone, MessageCircle, Home, Package, Truck, User, LogOut, Bell, Ticket, BadgeCheck, LocateFixed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { StoreMarquee } from "@/components/StoreMarquee";
import { StorePushOptIn } from "@/components/storefront/StorePushOptIn";
import { CustomerAuthModal } from "@/components/CustomerAuthModal";
import { CustomerProfileModal } from "@/components/CustomerProfileModal";
import { CustomerNotificationsBell } from "@/components/storefront/CustomerNotificationsBell";
import { useCustomerNotifications } from "@/hooks/useCustomerNotifications";
import { ThemeToggle, useThemeScope } from "@/components/ThemeToggle";
import { LanguageSelector } from "@/components/LanguageSelector";
import { getLocaleTag, isLocale, useTranslation } from "@/i18n";
import { PromoBanner } from "@/components/storefront/PromoBanner";
import { CookieConsent } from "@/components/storefront/CookieConsent";
import { toast } from "sonner";
import paymentMethodsImg from "@/assets/payment-methods.png";
import securityBadgesImg from "@/assets/security-badges.png";
import whatsappIcon from "@/assets/whatsapp-icon.png";
import iconInstagram from "@/assets/icon-instagram.png";
import iconTiktok from "@/assets/icon-tiktok.png";
import iconFacebook from "@/assets/icon-facebook.png";
import iconYoutube from "@/assets/icon-youtube.png";
import iconLocation from "@/assets/icon-location.png";
import { useLocalizedText, useLocalizedTextList } from "@/hooks/useLocalizedStoreText";

export interface LojaContextType {
  cart: ReturnType<typeof useCart>;
  settings: any;
  productPageConfig?: any;
  searchTerm: string;
  setSearchTerm: (s: string) => void;
  storeUserId?: string;
  customer?: any;
  openCart: () => void;
  basePath: string;
  globalCep: string;
  setGlobalCep: (cep: string) => void;
}

import { createContext, useContext } from "react";
const LojaContext = createContext<LojaContextType | null>(null);
export const useLojaContext = () => useContext(LojaContext)!;

export default function LojaLayout() {
  const { slug } = useParams();
  const { t, locale, setLocale } = useTranslation();
  const storeThemeScope = `store-${slug || "default"}`;
  const { dark: storeDark } = useThemeScope(storeThemeScope);
  const { data: settingsBySlug, isLoading: slugLoading, refetch: refetchSettings } = useResolvedPublicStore(slug);

  // Clean up any leaked dark class from admin/superadmin on <html>
  useLayoutEffect(() => {
    document.documentElement.classList.remove("dark");
    return () => {
      document.documentElement.classList.remove("dark");
    };
  }, []);
  const { user, customer, signOut } = useCustomerAuth();
  const cart = useCart(slug, settingsBySlug?.user_id);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [globalCep, setGlobalCep] = useState("");
  const [globalCity, setGlobalCity] = useState("");
  const [isCepDialogOpen, setIsCepDialogOpen] = useState(false);
  const [tempCep, setTempCep] = useState("");
  const [showLocationHeader, setShowLocationHeader] = useState(true);
  const [scrollDir, setScrollDir] = useState<"up" | "down">("up");
  const lastScrollY = useRef(0);
  const [cartSheetOpen, setCartSheetOpen] = useState(false);
  const [locationBarOpen, setLocationBarOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const basePath = slug ? `/loja/${slug}` : "";
  const localeTag = getLocaleTag(locale);
  const storeText = {
    pt: {
      accessStore: "Acesse uma loja pelo seu endereço específico ou domínio.",
      storeRemoved: "A loja procurada não existe ou foi removida.",
      blockedDescription: "Esta loja está temporariamente indisponível. Entre em contato com o suporte.",
      defaultStore: "Loja",
      preview: "Preview",
      whatsappMessage: "Olá! Gostaria de mais informações.",
      whatsappTitle: "Fale conosco pelo WhatsApp",
    },
    en: {
      accessStore: "Open a store using its specific address or domain.",
      storeRemoved: "The requested store does not exist or has been removed.",
      blockedDescription: "This store is temporarily unavailable. Please contact support.",
      defaultStore: "Store",
      preview: "Preview",
      whatsappMessage: "Hello! I would like more information.",
      whatsappTitle: "Talk to us on WhatsApp",
    },
    es: {
      accessStore: "Acceda a una tienda por su dirección específica o dominio.",
      storeRemoved: "La tienda solicitada no existe o fue eliminada.",
      blockedDescription: "Esta tienda está temporalmente indisponible. Póngase en contacto con soporte.",
      defaultStore: "Tienda",
      preview: "Vista previa",
      whatsappMessage: "¡Hola! Me gustaría más información.",
      whatsappTitle: "Hable con nosotros por WhatsApp",
    },
    fr: {
      accessStore: "Accédez à une boutique via son adresse ou son domaine.",
      storeRemoved: "La boutique demandée n'existe pas ou a été supprimée.",
      blockedDescription: "Cette boutique est temporairement indisponible. Veuillez contacter le support.",
      defaultStore: "Boutique",
      preview: "Aperçu",
      whatsappMessage: "Bonjour ! Je voudrais plus d'informations.",
      whatsappTitle: "Parlez-nous sur WhatsApp",
    },
  }[locale];

  useEffect(() => {
    const nextLocale = (settingsBySlug as any)?.language;
    if (isLocale(nextLocale) && nextLocale !== locale) {
      setLocale(nextLocale);
    }
  }, [(settingsBySlug as any)?.language, locale, setLocale]);

  // Real-time store status monitoring
  const { refetch: refetchTheme } = usePublicThemeConfig(settingsBySlug?.user_id);
  const { refetch: refetchMarketing } = usePublicMarketingConfig(settingsBySlug?.user_id);

  useEffect(() => {
    if (!settingsBySlug?.id || !settingsBySlug?.user_id) return;

    const channel = supabase
      .channel(`store-updates-${settingsBySlug.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "store_settings",
          filter: `id=eq.${settingsBySlug.id}`,
        },
        () => {
          console.log("Store settings updated, refetching...");
          refetchSettings();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "store_theme_config",
          filter: `user_id=eq.${settingsBySlug.user_id}`,
        },
        () => {
          console.log("Theme config updated, refetching...");
          refetchTheme();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "store_marketing_config",
          filter: `user_id=eq.${settingsBySlug.user_id}`,
        },
        () => {
          console.log("Marketing config updated, refetching...");
          refetchMarketing();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [settingsBySlug?.id, settingsBySlug?.user_id, refetchSettings, refetchTheme, refetchMarketing]);

  const lookupCepCity = async (cepVal: string) => {
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cepVal}/json/`);
      const data = await res.json();
      if (data && !data.erro && data.localidade) {
        setGlobalCity(`${data.localidade} - ${data.uf}`);
        localStorage.setItem("global_city", `${data.localidade} - ${data.uf}`);
      }
    } catch { /* ignore */ }
  };

  useEffect(() => {
    const handleLojaSearch = (e: any) => {
      setSearchTerm(e.detail);
      navigate(basePath);
    };
    window.addEventListener('loja_search', handleLojaSearch as any);
    return () => window.removeEventListener('loja_search', handleLojaSearch as any);
  }, [basePath, navigate]);

  useEffect(() => {
    const savedCep = localStorage.getItem("global_cep");
    const savedCity = localStorage.getItem("global_city");
    if (savedCep) {
      setGlobalCep(savedCep);
      if (savedCity) setGlobalCity(savedCity);
      else lookupCepCity(savedCep);
      return;
    }

    const recognizeLocation = async () => {
      try {
        // Try ipapi.co first
        let response = await fetch("https://ipapi.co/json/", { signal: AbortSignal.timeout(5000) });
        let data = await response.json();
        if (data && data.postal) {
          const cleanCep = data.postal.replace(/\D/g, "");
          if (cleanCep.length === 8) {
            setGlobalCep(cleanCep);
            localStorage.setItem("global_cep", cleanCep);
            const cityName = data.city ? `${data.city} - ${data.region_code || ""}` : "";
            if (cityName) {
              setGlobalCity(cityName);
              localStorage.setItem("global_city", cityName);
            }
            toast.info(`📍 ${locale === "pt" ? "Localização detectada" : locale === "en" ? "Location detected" : locale === "es" ? "Ubicación detectada" : "Position détectée"}: ${data.city || (locale === "pt" ? "Sua região" : locale === "en" ? "Your area" : locale === "es" ? "Tu zona" : "Votre zone")}`);
            return;
          }
        }
      } catch {
        // ipapi failed, try fallback
      }
      try {
        const response = await fetch("https://ip-api.com/json/?fields=zip,city,regionName", { signal: AbortSignal.timeout(5000) });
        const data = await response.json();
        if (data && data.zip) {
          const cleanCep = data.zip.replace(/\D/g, "");
          if (cleanCep.length === 8) {
            setGlobalCep(cleanCep);
            localStorage.setItem("global_cep", cleanCep);
            const cityName = data.city ? `${data.city} - ${data.regionName || ""}` : "";
            if (cityName) {
              setGlobalCity(cityName);
              localStorage.setItem("global_city", cityName);
            }
            toast.info(`📍 ${locale === "pt" ? "Localização detectada" : locale === "en" ? "Location detected" : locale === "es" ? "Ubicación detectada" : "Position détectée"}: ${data.city || (locale === "pt" ? "Sua região" : locale === "en" ? "Your area" : locale === "es" ? "Tu zona" : "Votre zone")}`);
          }
        }
      } catch {
        console.error("All geolocation APIs failed");
      }
    };
    
    // Run immediately, no delay
    recognizeLocation();
  }, []);

  const handleGlobalCepChange = (val: string) => {
    const clean = val.replace(/\D/g, "").slice(0, 8);
    setGlobalCep(clean);
    if (clean.length === 8) {
      localStorage.setItem("global_cep", clean);
      lookupCepCity(clean);
    } else {
      setGlobalCity("");
    }
  };

  const detectMyLocation = async () => {
    try {
      toast.info(locale === "pt" ? "📍 Detectando sua localização..." : locale === "en" ? "📍 Detecting your location..." : locale === "es" ? "📍 Detectando tu ubicación..." : "📍 Détection de votre position...");
      const response = await fetch("https://ipapi.co/json/");
      const data = await response.json();
      if (data && data.postal) {
        const cleanCep = data.postal.replace(/\D/g, "");
        if (cleanCep.length === 8) {
          setGlobalCep(cleanCep);
          localStorage.setItem("global_cep", cleanCep);
          const cityName = data.city ? `${data.city} - ${data.region_code || ""}` : "";
          if (cityName) {
            setGlobalCity(cityName);
            localStorage.setItem("global_city", cityName);
          }
          toast.success(`📍 ${data.city || "Localização detectada"}`);
        }
      } else {
        toast.error(locale === "pt" ? "Não foi possível detectar sua localização" : locale === "en" ? "Could not detect your location" : locale === "es" ? "No se pudo detectar tu ubicación" : "Impossible de détecter votre position");
      }
    } catch {
      toast.error(locale === "pt" ? "Erro ao detectar localização" : locale === "en" ? "Error detecting location" : locale === "es" ? "Error al detectar la ubicación" : "Erreur lors de la détection de la position");
    }
  };

  const settings = settingsBySlug;
  const isLoading = slugLoading;
  const { data: smartSearchProducts } = usePublicProducts(settings?.user_id);
  const { data: categories } = usePublicCategories(settings?.user_id);
  const { unreadCount: notifUnread } = useCustomerNotifications(settings?.user_id);
  const { data: marketingConfig } = usePublicMarketingConfig(settings?.user_id);
  const { data: themeConfig } = usePublicThemeConfig(settings?.user_id);
  const { data: productPageConfig } = usePublicProductPageConfig(settings?.user_id);
  const { data: storePages } = useQuery({
    queryKey: ["store_pages_public", settings?.user_id],
    enabled: !!settings?.user_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_pages")
        .select("title, slug")
        .eq("user_id", settings!.user_id)
        .eq("published", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
  const { data: shippingZonesData } = useQuery({
    queryKey: ["store_shipping_zones_public", settings?.user_id],
    enabled: !!settings?.user_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shipping_zones")
        .select("id")
        .eq("user_id", settings!.user_id)
        .eq("active", true)
        .limit(1);
      if (error) throw error;
      return data;
    },
  });
  const hasShippingZones = (shippingZonesData?.length ?? 0) > 0;
  const localizedStoreDescription = useLocalizedText(settings?.store_description);
  const localizedStorePageTitles = useLocalizedTextList(storePages?.map((p) => p.title) || []);
  const localizedCategoryNames = useLocalizedTextList(categories?.map((c) => c.name) || []);

  const storeInstallName = slug || settings?.store_name?.trim() || "Loja";

  const storeStartUrl = slug ? `${window.location.origin}/loja/${slug}/` : undefined;
  const storeIconUrl = themeConfig?.favicon_url || settings?.favicon_url || settings?.logo_url || undefined;
  const storeIconVersion = themeConfig?.updated_at || settings?.updated_at || undefined;

  usePwaManifest({
    id: slug ? `cartlly-store-${slug}` : "cartlly-store-default",
    name: storeInstallName,
    shortName: storeInstallName.slice(0, 12),
    themeColor: settings?.primary_color || undefined,
    iconUrl: storeIconUrl,
    iconVersion: storeIconVersion,
    startUrl: storeStartUrl,
    scope: storeStartUrl,
  });

  const isAdminPreview = !!user && !!settingsBySlug && user.id === settingsBySlug.user_id;
  const isDarkMode = themeConfig?.theme_mode === 'dark' || storeDark;

  useEffect(() => {
    if (slug) {
      localStorage.setItem("last_visited_store", slug);
    }
  }, [slug]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref) {
      localStorage.setItem(`store_referral_${slug}`, ref);
      // Remove ref from URL to keep it clean
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [slug]);

  useEffect(() => {
    if (searchTerm.trim().length > 2 && settings?.user_id) {
      const timer = setTimeout(async () => {
        try {
          const lastSearch = localStorage.getItem(`last_search_${settings.user_id}`);
          const currentSearch = searchTerm.trim().toLowerCase();
          
          if (lastSearch !== currentSearch) {
            await supabase.from("search_logs").insert({
              user_id: settings.user_id,
              term: currentSearch
            });
            localStorage.setItem(`last_search_${settings.user_id}`, currentSearch);
          }
        } catch (error) {
          console.error("Error logging search:", error);
        }
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [searchTerm, settings?.user_id]);

  // Apply dark mode CSS vars to both the store container AND documentElement
  // (portaled elements like Dialogs/Sheets render outside the container)
  useLayoutEffect(() => {
    const container = document.getElementById(`store-theme-${slug}`);
    const root = document.documentElement;

    if (isDarkMode) {
      container?.classList.add("dark");
      root.classList.add("dark");
      // Set dark CSS vars on root for portaled elements
      const darkVars: Record<string, string> = {
        "--card": "0 0% 5%",
        "--card-foreground": "0 0% 98%",
        "--background": "0 0% 0%",
        "--foreground": "0 0% 98%",
        "--popover": "0 0% 5%",
        "--popover-foreground": "0 0% 98%",
        "--muted": "0 0% 10%",
        "--muted-foreground": "0 0% 65%",
        "--border": "0 0% 14%",
        "--input": "0 0% 14%",
        "--secondary": "0 0% 10%",
        "--secondary-foreground": "0 0% 98%",
        "--accent": "0 0% 12%",
        "--accent-foreground": "0 0% 98%",
      };
      Object.entries(darkVars).forEach(([k, v]) => root.style.setProperty(k, v));
    } else {
      container?.classList.remove("dark");
      root.classList.remove("dark");
      // Reset to light vars
      const lightVars: Record<string, string> = {
        "--card": "0 0% 100%",
        "--card-foreground": "224 30% 12%",
        "--background": "220 20% 97%",
        "--foreground": "224 30% 12%",
        "--popover": "0 0% 100%",
        "--popover-foreground": "224 30% 12%",
        "--muted": "220 14% 96%",
        "--muted-foreground": "220 9% 46%",
        "--border": "220 13% 91%",
        "--input": "220 13% 91%",
        "--secondary": "220 14% 96%",
        "--secondary-foreground": "224 30% 12%",
        "--accent": "243 75% 95%",
        "--accent-foreground": "243 75% 59%",
      };
      Object.entries(lightVars).forEach(([k, v]) => root.style.setProperty(k, v));
    }

    return () => {
      container?.classList.remove("dark");
      root.classList.remove("dark");
      // Clean up all overridden vars
      ["--card","--card-foreground","--background","--foreground","--popover","--popover-foreground",
       "--muted","--muted-foreground","--border","--input","--secondary","--secondary-foreground",
       "--accent","--accent-foreground"].forEach((k) => root.style.removeProperty(k));
    };
  }, [isDarkMode, slug]);

  useEffect(() => {
    if (settings || themeConfig) {
      // CRITICAL: Only use the scoped container — never fall back to documentElement
      // This prevents theme leaking between tenants
      const container = document.getElementById(`store-theme-${slug}`);
      if (!container) return;
      
      const primary = themeConfig?.primary_color || settings?.primary_color || "#6d28d9";
      const secondary = themeConfig?.secondary_color || settings?.secondary_color || "#f5f3ff";
      const bg = themeConfig?.background_color || (settings as any).page_bg_color || "#ffffff";
      const text = themeConfig?.text_color || "#000000";

      container.style.setProperty("--store-primary", primary);
      container.style.setProperty("--store-secondary", secondary);
      container.style.setProperty("--store-accent", settings?.accent_color || "#8b5cf6");
      container.style.setProperty("--store-button-bg", settings?.button_color || "#000000");
      container.style.setProperty("--store-button-text", settings?.button_text_color || "#ffffff");
      container.style.setProperty("--store-bg-base", bg);
      container.style.setProperty("--store-text-base", text);

      // Apply fonts from theme config
      const fontBody = themeConfig?.font_body || "Inter";
      const fontHeading = themeConfig?.font_heading || fontBody;
      
      // Load Google Fonts dynamically
      const fontsToLoad = new Set([fontBody, fontHeading].filter(f => f && f !== "Inter"));
      fontsToLoad.forEach((font) => {
        const linkId = `gfont-${font.replace(/\s+/g, "-")}`;
        if (!document.getElementById(linkId)) {
          const link = document.createElement("link");
          link.id = linkId;
          link.rel = "stylesheet";
          link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font)}:wght@300;400;500;600;700;800&display=swap`;
          document.head.appendChild(link);
        }
      });

      container.style.setProperty("--store-font-body", `'${fontBody}'`);
      container.style.setProperty("--store-font-heading", `'${fontHeading}'`);
      // Also set on root so body inherits when needed
      document.documentElement.style.setProperty("--store-font-body", `'${fontBody}'`);
      document.documentElement.style.setProperty("--store-font-heading", `'${fontHeading}'`);
      
      return () => {
        container.style.removeProperty("--store-primary");
        container.style.removeProperty("--store-secondary");
        container.style.removeProperty("--store-accent");
        container.style.removeProperty("--store-button-bg");
        container.style.removeProperty("--store-button-text");
        container.style.removeProperty("--store-bg-base");
        container.style.removeProperty("--store-text-base");
        container.style.removeProperty("--store-font-body");
        container.style.removeProperty("--store-font-heading");
        document.documentElement.style.removeProperty("--store-font-body");
        document.documentElement.style.removeProperty("--store-font-heading");
      };
    }
  }, [settings, themeConfig, slug]);

  const logoSize = (settings as any)?.logo_size || 40;

  if (!slug && !settingsBySlug && !isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="text-center space-y-4 p-8">
          <div className="text-6xl">🔍</div>
          <h1 className="text-3xl font-bold">{t.misc.storeNotFound}</h1>
          <p className="text-muted-foreground">{storeText.accessStore}</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin-slow rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!settings && !isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="text-center space-y-4 p-8">
          <div className="text-6xl">🔍</div>
          <h1 className="text-3xl font-bold">{t.misc.storeNotFound}</h1>
          <p className="text-muted-foreground">{storeText.storeRemoved}</p>
        </div>
      </div>
    );
  }

  if (settings && (settings as any).store_blocked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="text-center space-y-4 p-8 max-w-md">
          <div className="text-6xl">🚫</div>
          <h1 className="text-3xl font-bold">{t.misc.storeUnavailable}</h1>
          <p className="text-muted-foreground">{storeText.blockedDescription}</p>
        </div>
      </div>
    );
  }

  if (settings && !settings.store_open) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="text-center space-y-4 p-8">
          <div className="text-6xl">🚧</div>
            <h1 className="text-3xl font-bold">{t.misc.storeClosed}</h1>
            <p className="text-muted-foreground">{t.misc.storeClosedMessage}</p>
        </div>
      </div>
    );
  }

  const storeName = settings?.store_name || storeText.defaultStore;
  const primaryColor = settings?.primary_color || "#6d28d9";
  const headerBgColor = isDarkMode ? "#000000" : (settings?.header_bg_color || "#ffffff");
  const headerTextColor = isDarkMode ? "#fafafa" : (settings?.header_text_color || "#000000");
  const footerBgColor = isDarkMode ? "#080808" : (settings?.footer_bg_color || "#000000");
  const footerTextColor = isDarkMode ? "#e5e5e5" : (settings?.footer_text_color || "#ffffff");
  const buttonColor = isDarkMode ? primaryColor : (settings?.button_color || "#000000");
  const buttonTextColor = isDarkMode ? "#ffffff" : (settings?.button_text_color || "#ffffff");
  const isHomePage = location.pathname === basePath || location.pathname === basePath + "/";
  const isCheckout = location.pathname.includes("/checkout");

  return (
    <LojaContext.Provider value={{ cart, settings, productPageConfig, searchTerm, setSearchTerm, storeUserId: settings?.user_id, customer, openCart: () => setCartSheetOpen(true), basePath, globalCep, setGlobalCep }}>
      <div 
        id={`store-theme-${slug}`}
        data-tenant={settings?.user_id}
        className={`min-h-screen pb-16 md:pb-0 transition-colors bg-background text-foreground ${isDarkMode ? "dark" : ""}`}
        style={
          isDarkMode
            ? {
                "--card": "0 0% 5%",
                "--card-foreground": "0 0% 98%",
                "--background": "0 0% 0%",
                "--foreground": "0 0% 98%",
                "--popover": "0 0% 5%",
                "--popover-foreground": "0 0% 98%",
                "--muted": "0 0% 10%",
                "--muted-foreground": "0 0% 65%",
                "--border": "0 0% 14%",
                "--input": "0 0% 14%",
                "--secondary": "0 0% 10%",
                "--secondary-foreground": "0 0% 98%",
                "--accent": "0 0% 12%",
                "--accent-foreground": "0 0% 98%",
                "--destructive": "0 72% 51%",
                "--destructive-foreground": "0 0% 100%",
                "--ring": "243 75% 62%",
                backgroundColor: "hsl(0 0% 0%)",
                color: "hsl(0 0% 98%)",
              } as React.CSSProperties
            : {
                "--card": "0 0% 100%",
                "--card-foreground": "224 30% 12%",
                "--background": "220 20% 97%",
                "--foreground": "224 30% 12%",
                "--popover": "0 0% 100%",
                "--popover-foreground": "224 30% 12%",
                "--muted": "220 14% 96%",
                "--muted-foreground": "220 9% 46%",
                "--border": "220 13% 91%",
                "--input": "220 13% 91%",
                "--secondary": "220 14% 96%",
                "--secondary-foreground": "224 30% 12%",
                "--accent": "243 75% 95%",
                "--accent-foreground": "243 75% 59%",
                backgroundColor: themeConfig?.background_color || (settings as any)?.page_bg_color || undefined,
                color: themeConfig?.text_color || undefined,
              } as React.CSSProperties
        }
      >
        {/* Promotional banner */}
        <PromoBanner storeUserId={settings?.user_id} />

        <PWAInstallBanner 
          storeName={storeInstallName}
          logoUrl={storeIconUrl}
          primaryColor={settings?.primary_color}
          storeUserId={settings?.user_id}
        />


        <PushPermissionPrompt
          storeName={settings?.store_name}
          logoUrl={storeIconUrl}
          primaryColor={settings?.primary_color}
          storeUserId={settings?.user_id}
        />

        {marketingConfig && <CountdownBar config={marketingConfig} />}
        {marketingConfig && <AnnouncementBar config={marketingConfig} basePath={basePath} />}

        {settings?.marquee_enabled && settings?.marquee_text && (
          <StoreMarquee
            text={settings.marquee_text}
            speed={settings.marquee_speed}
            bgColor={settings.marquee_bg_color}
            textColor={settings.marquee_text_color}
          />
        )}

        {marketingConfig && <FreeShippingBar config={marketingConfig} cartTotal={cart.total} />}
        {marketingConfig && <PopupCoupon config={marketingConfig} />}

        {(settings?.store_phone || settings?.store_location) && (
          <div className="hidden sm:block text-xs py-1" style={{ backgroundColor: primaryColor, color: (primaryColor === '#ffffff' || primaryColor === 'white') ? '#000000' : '#ffffff' }}>
            <div className="max-w-7xl mx-auto px-4 flex items-center justify-center gap-6">
              {settings?.store_phone && (
                <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{settings.store_phone}</span>
              )}
              {settings?.store_location && (
                <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{settings.store_location}</span>
              )}
            </div>
          </div>
        )}

        <header className="sticky top-0 z-50 border-b border-border shadow-sm transition-colors" style={{ backgroundColor: headerBgColor, color: headerTextColor }}>
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileMenu(!mobileMenu)} style={{ color: headerTextColor }}>
              {mobileMenu ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>

            <Link to={basePath || "/"} className="flex items-center gap-2 shrink-0">
              <div className="relative inline-flex items-center">
                {settings?.logo_url ? (
                  <div className="relative">
                    <img
                      src={settings.logo_url}
                      alt={storeName}
                      style={{ height: `${logoSize}px`, maxWidth: `${Math.max(120, logoSize * 5)}px` }}
                      className="object-contain"
                    />
                    {settings?.is_verified && (
                      <BadgeCheck className="absolute -right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-[#0095f6] fill-[#0095f6] stroke-white stroke-[2.5px]" />
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xl font-bold" style={{ color: headerTextColor }}>{storeName}</span>
                    {settings?.is_verified && (
                      <BadgeCheck className="h-4 w-4 text-[#0095f6] fill-[#0095f6] stroke-white stroke-[1.5px] mt-0.5" />
                    )}
                  </div>
                )}
              </div>
            </Link>

            <div className="flex-1 max-w-2xl mx-auto hidden lg:flex items-center gap-2">
              <SmartSearchBar
                products={smartSearchProducts || []}
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                onProductClick={(pid) => navigate(`${basePath}/produto/${pid}`)}
                primaryColor={primaryColor}
                storeUserId={settings?.user_id}
                className="flex-1"
              />
              <StoreFilter 
                storeUserId={settings?.user_id || ""} 
                primaryColor={primaryColor} 
                products={smartSearchProducts || []} 
              />
            </div>

            <StorePushOptIn primaryColor={primaryColor} storeUserId={settings?.user_id} className="hidden sm:flex" />
            <CustomerNotificationsBell storeUserId={settings?.user_id} primaryColor={primaryColor} headerTextColor={headerTextColor} className="hidden sm:flex" />
            {settings?.is_premium_plan && (
              <LanguageSelector compact className="flex shrink-0" skipGate />
            )}
            <ThemeToggle className="hidden sm:flex" scope={storeThemeScope} applyToRoot={false} />

            <div className="flex items-center gap-1.5">
              {settings?.instagram_url && (
                <a href={settings.instagram_url} target="_blank" rel="noopener noreferrer" className="hover:scale-110 transition-transform">
                  <img src={iconInstagram} alt="Instagram" className="h-5 w-5 rounded" />
                </a>
              )}
            </div>

            <Button variant="ghost" size="icon" onClick={() => user ? setProfileModalOpen(true) : setAuthModalOpen(true)} style={{ color: headerTextColor }}>
              {user ? (
                isAdminPreview ? <span className="text-[10px] font-bold">{storeText.preview}</span> : <User className="h-5 w-5" />
              ) : (
                <User className="h-5 w-5" />
              )}
            </Button>

            <Sheet open={cartSheetOpen} onOpenChange={setCartSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="relative hidden md:inline-flex" style={{ color: headerTextColor }}>
                  <ShoppingCart className="h-5 w-5" />
                  {cart.count > 0 && (
                    <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs" style={{ backgroundColor: primaryColor, color: "#fff" }}>
                      {cart.count}
                    </Badge>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent className="w-full sm:max-w-md">
                <SheetHeader>
                  <SheetTitle>{t.store.cart} ({cart.count})</SheetTitle>
                </SheetHeader>
                <div className="mt-4 space-y-3 flex-1 overflow-auto">
                  {cart.items.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">{t.store.emptyCart}</p>
                  ) : (
                    cart.items.map((item) => (
                      <div key={item.id} className="flex items-center gap-3 border-b border-border pb-3">
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.name} className="h-16 w-16 rounded object-cover" />
                        ) : (
                          <div className="h-16 w-16 rounded bg-muted" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.name}</p>
                          <p className="text-sm text-muted-foreground">{new Intl.NumberFormat(localeTag, { style: "currency", currency: "BRL" }).format(item.price)}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => cart.updateQuantity(item.id, item.quantity - 1)}>-</Button>
                            <span className="text-sm w-6 text-center">{item.quantity}</span>
                            <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => cart.updateQuantity(item.id, item.quantity + 1)}>+</Button>
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => cart.removeItem(item.id)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
                {cart.items.length > 0 && (
                  <div className="mt-4 space-y-3 border-t border-border pt-4">
                    <div className="flex justify-between font-bold text-lg">
                      <span>{t.common.total}</span>
                      <span>{new Intl.NumberFormat(localeTag, { style: "currency", currency: "BRL" }).format(cart.total)}</span>
                    </div>
                    <Button className="w-full" style={{ backgroundColor: buttonColor, color: buttonTextColor }} onClick={() => { setCartSheetOpen(false); navigate(`${basePath}/checkout`); }}>
                      {t.store.goToCheckout}
                    </Button>
                    {settings?.sell_via_whatsapp && settings?.store_whatsapp && (
                      <Button
                        variant="outline"
                        className="w-full border-green-500 text-green-600 hover:bg-green-50"
                        onClick={() => {
                          const msg = cart.items.map((i) => `${i.quantity}x ${i.name} - ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(i.price * i.quantity)}`).join("\n");
                          const text = `Olá! Gostaria de fazer o pedido:\n\n${msg}\n\nTotal: ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cart.total)}`;
                          window.open(`https://wa.me/${settings.store_whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`, "_blank");
                        }}
                      >
                        <MessageCircle className="mr-2 h-4 w-4" /> {t.store.buyNow} WhatsApp
                      </Button>
                    )}
                  </div>
                )}
              </SheetContent>
            </Sheet>
          </div>

          <div className="sm:hidden px-4 pb-3 flex items-center gap-2">
            <SmartSearchBar
              products={smartSearchProducts || []}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              onProductClick={(pid) => navigate(`${basePath}/produto/${pid}`)}
              primaryColor={primaryColor}
              storeUserId={settings?.user_id}
              className="flex-1"
            />
            <StoreFilter 
              storeUserId={settings?.user_id || ""} 
              primaryColor={primaryColor} 
              products={smartSearchProducts || []} 
            />
          </div>

          {mobileMenu && (
            <div
              className="lg:hidden fixed inset-0 z-30 bg-black/30"
              style={{ top: "inherit" }}
              onClick={() => setMobileMenu(false)}
            />
          )}
          <div
            className={`lg:hidden overflow-hidden overflow-y-auto border-t border-border transition-all ease-[cubic-bezier(0.16,1,0.3,1)] relative z-40 ${
              mobileMenu ? "max-h-[80vh] opacity-100 duration-700" : "max-h-0 opacity-0 duration-500"
            }`}
            style={{ backgroundColor: headerBgColor, color: headerTextColor }}
          >
          <nav className="max-w-7xl mx-auto px-4 py-4 space-y-1">
            {settings?.instagram_url && (
              <div
                className="flex items-center gap-3 px-3 pb-3 mb-2 border-b border-border"
                style={{
                  opacity: mobileMenu ? 1 : 0,
                  transform: mobileMenu ? "translateY(0)" : "translateY(12px)",
                  transition: "opacity 0.4s cubic-bezier(0.16,1,0.3,1) 0ms, transform 0.4s cubic-bezier(0.16,1,0.3,1) 0ms",
                }}
              >
                <a href={settings.instagram_url} target="_blank" rel="noopener noreferrer" className="hover:scale-110 transition-transform">
                  <img src={iconInstagram} alt="Instagram" className="h-7 w-7 rounded-lg" />
                </a>
              </div>
            )}
            <div className="pt-2 pb-1">
              <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-1">{t.store.categories}</p>
              <div className="flex flex-wrap gap-2 px-3 mb-4">
                {categories?.map((cat, i) => (
                  <Badge
                    key={cat.id}
                    variant="outline"
                    className="shrink-0 cursor-pointer transition-all px-3 py-1 text-xs"
                    style={{
                      opacity: mobileMenu ? 1 : 0,
                      transform: mobileMenu ? "translateY(0)" : "translateY(10px)",
                      transition: `opacity 0.4s cubic-bezier(0.16,1,0.3,1) ${i * 50}ms, transform 0.4s cubic-bezier(0.16,1,0.3,1) ${i * 50}ms`,
                      borderColor: primaryColor,
                      color: primaryColor,
                    }}
                    onClick={() => {
                      setMobileMenu(false);
                      const el = document.getElementById(`category-${cat.name}`);
                      if (el) {
                        const yOffset = -80;
                        const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
                        window.scrollTo({ top: y, behavior: "smooth" });
                      } else {
                        navigate(`${basePath}?categoria=${cat.id}`);
                      }
                    }}
                  >
                    {localizedCategoryNames[i] || cat.name}
                  </Badge>
                ))}
              </div>
            </div>

            {[
              { icon: Home, label: t.store.home, to: basePath || "/" },
              { icon: Package, label: t.sidebar.products, to: basePath || "/" },
              { icon: Ticket, label: t.store.discountCoupons, to: `${basePath}/cupons` },
              { icon: Truck, label: t.store.trackOrder, to: `${basePath}/rastreio` },
              ...(user ? [{ icon: User, label: t.store.myAccount, to: "#", onClick: () => setProfileModalOpen(true) }] : [{ icon: User, label: t.auth.login, to: "#", onClick: () => setAuthModalOpen(true) }]),
              ...(user ? [{ icon: LogOut, label: t.auth.logout, to: "#", onClick: () => signOut() }] : []),
            ].map((item: any, i) => {
              const content = (
                <div className="flex items-center gap-3 w-full">
                  <item.icon
                    className="h-5 w-5 transition-all duration-500"
                    style={{
                      color: primaryColor,
                      opacity: mobileMenu ? 1 : 0,
                      transform: mobileMenu ? "translateX(0) scale(1)" : "translateX(-12px) scale(0.8)",
                      transitionDelay: mobileMenu ? `${i * 80 + 100}ms` : "0ms",
                    }}
                  />
                  <span
                    className="text-sm font-medium transition-all duration-500"
                    style={{
                      opacity: mobileMenu ? 1 : 0,
                      transform: mobileMenu ? "translateX(0)" : "translateX(-20px)",
                      transitionDelay: mobileMenu ? `${i * 80 + 160}ms` : "0ms",
                      filter: mobileMenu ? "blur(0)" : "blur(4px)",
                    }}
                  >
                    {item.label}
                  </span>
                </div>
              );

              const className = "flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-white/10 transition-colors duration-300";

              return (
                <div
                  key={i}
                  style={{
                    opacity: mobileMenu ? 1 : 0,
                    transform: mobileMenu ? "translateY(0)" : "translateY(12px)",
                    transition: `opacity 0.4s cubic-bezier(0.16,1,0.3,1) ${i * 80}ms, transform 0.4s cubic-bezier(0.16,1,0.3,1) ${i * 80}ms`,
                  }}
                >
                  {item.onClick ? (
                    <button className={className} onClick={() => { setMobileMenu(false); item.onClick(); }} style={{ color: headerTextColor, width: '100%', textAlign: 'left' }}>
                      {content}
                    </button>
                  ) : item.external ? (
                    <a href={item.to} target="_blank" rel="noopener noreferrer" className={className} onClick={() => setMobileMenu(false)} style={{ color: headerTextColor }}>
                      {content}
                    </a>
                  ) : (
                    <Link to={item.to} className={className} onClick={() => setMobileMenu(false)} style={{ color: headerTextColor }}>
                      {content}
                    </Link>
                  )}
                </div>
              );
            })}
            
            <div 
              className="px-3 py-4 border-t border-border mt-2 space-y-2"
              style={{
                opacity: mobileMenu ? 1 : 0,
                transform: mobileMenu ? "translateY(0)" : "translateY(12px)",
                transition: "opacity 0.4s cubic-bezier(0.16,1,0.3,1) 400ms, transform 0.4s cubic-bezier(0.16,1,0.3,1) 400ms",
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <MapPin className="h-4 w-4" style={{ color: primaryColor }} />
                <span className="text-sm font-semibold">{t.shipping.calculateShipping}</span>
              </div>
              {globalCity && (
                <p className="text-xs text-muted-foreground mb-1">📍 {globalCity}</p>
              )}
              <div className="flex gap-2">
                <Input
                  placeholder={t.store.zipPlaceholder}
                  className="bg-secondary border-border font-mono h-11"
                  value={globalCep ? globalCep.replace(/(\d{5})(\d{3})/, "$1-$2") : ""}
                  onChange={(e) => handleGlobalCepChange(e.target.value)}
                  inputMode="numeric"
                  maxLength={9}
                />
                <Button 
                  variant="outline" 
                  className="h-11 aspect-square p-0"
                  onClick={detectMyLocation}
                  title={t.store.detectLocation}
                >
                  <LocateFixed className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">{t.store.shippingHelpPrefix} <LocateFixed className="h-3 w-3 inline" /> {t.store.shippingHelpSuffix}</p>
            </div>

            <div className="px-3 py-2 border-t border-border mt-2 flex items-center gap-2">
              <ThemeToggle scope={storeThemeScope} applyToRoot={false} />
              <span className="text-sm" style={{ color: headerTextColor }}>{t.settings.darkMode}</span>
            </div>

            {settings?.is_premium_plan && (
              <div className="px-3 py-2 border-t border-border flex items-center gap-2">
                <LanguageSelector skipGate />
              </div>
            )}

            <div className="px-3 py-2">
              <StorePushOptIn primaryColor={primaryColor} storeUserId={settings?.user_id} />
            </div>
          </nav>
        </div>
        </header>

          <div className="border-b border-border bg-secondary/50">
            <div className="max-w-7xl mx-auto px-4">
              <button
                className="w-full flex items-center gap-2 py-2 text-sm hover:opacity-80 transition-opacity"
                onClick={() => setLocationBarOpen(!locationBarOpen)}
              >
                <MapPin className="h-4 w-4 shrink-0" style={{ color: primaryColor }} />
                <span className="font-medium truncate">
                  {globalCity || (globalCep ? `CEP: ${globalCep.replace(/(\d{5})(\d{3})/, "$1-$2")}` : t.shipping.calculateShipping)}
                </span>
                <span className="text-muted-foreground text-xs ml-auto shrink-0">
                  {locationBarOpen ? t.common.close : t.common.change}
                </span>
              </button>
              {locationBarOpen && (
                <div className="pb-3 space-y-2 animate-in slide-in-from-top-2 duration-200">
                  <div className="flex gap-2">
                    <Input
                      placeholder={t.store.zipPlaceholder}
                      className="bg-background border-border font-mono h-10"
                      value={globalCep ? globalCep.replace(/(\d{5})(\d{3})/, "$1-$2") : ""}
                      onChange={(e) => handleGlobalCepChange(e.target.value)}
                      inputMode="numeric"
                      maxLength={9}
                    />
                    <Button 
                      variant="outline" 
                      className="h-10 aspect-square p-0"
                      onClick={() => { detectMyLocation(); setLocationBarOpen(false); }}
                      title={t.store.detectLocation}
                    >
                      <LocateFixed className="h-4 w-4" />
                    </Button>
                  </div>
                  {globalCity && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      📍 {globalCity}
                    </p>
                  )}
                  <p className="text-[10px] text-muted-foreground">
                    {t.store.shippingDeliveryHelpPrefix} <LocateFixed className="h-3 w-3 inline" /> {t.store.shippingDeliveryHelpSuffix}
                  </p>
                </div>
              )}
            </div>
          </div>

        <main>
          <Outlet />
        </main>

        <RestockAlertCard
          storeUserId={settings?.user_id}
          basePath={basePath}
          primaryColor={primaryColor}
          buttonColor={buttonColor}
          buttonTextColor={buttonTextColor}
        />

        <footer style={{ backgroundColor: footerBgColor, color: footerTextColor }} className="mt-12">
          <div className="max-w-7xl mx-auto px-4 py-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              <div>
                <h3 className="font-bold text-lg mb-3 flex items-center gap-1.5">
                  {storeName}
                  {settings?.is_verified && (
                    <BadgeCheck className="h-4 w-4 text-[#0095f6] fill-[#0095f6] stroke-white stroke-[1.5px]" />
                  )}
                </h3>
                {localizedStoreDescription && <p className="opacity-60 text-sm">{localizedStoreDescription}</p>}
              </div>
              <div>
                <h3 className="font-bold mb-3">{t.store.links}</h3>
                <div className="space-y-2 text-sm opacity-60">
                  <Link to={`${basePath}/cupons`} className="flex items-center gap-1.5 hover:opacity-100 transition-opacity">
                    <Ticket className="h-3.5 w-3.5" /> {t.store.discountCoupons}
                  </Link>
                  <Link to={`${basePath}/rastreio`} className="flex items-center gap-1.5 hover:opacity-100 transition-opacity">
                    <Truck className="h-3.5 w-3.5" /> {t.store.trackOrder}
                  </Link>
                  {storePages?.map((page, idx) => (
                    <Link
                      key={page.slug}
                      to={`${basePath}/p/${page.slug}`}
                      className="block hover:opacity-100 transition-opacity"
                    >
                      {localizedStorePageTitles[idx] || page.title}
                    </Link>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="font-bold mb-3">{t.store.contact}</h3>
                <div className="space-y-2 text-sm opacity-60">
                  {settings?.store_phone && <p>📞 {settings.store_phone}</p>}
                  {settings?.store_whatsapp && <p>💬 {settings.store_whatsapp}</p>}
                  {settings?.store_address && <p>📍 {settings.store_address}</p>}
                  {settings?.google_maps_url && (
                    <a 
                      href={settings.google_maps_url} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="flex items-center gap-1.5 text-primary hover:underline mt-1"
                    >
                      <MapPin className="h-3.5 w-3.5" /> Ver no Google Maps
                    </a>
                  )}
                </div>
              </div>
              <div>
                <h3 className="font-bold mb-3">{t.settings.socialMedia}</h3>
                <div className="flex gap-4 flex-wrap items-center">
                  {settings?.instagram_url && (
                    <a href={settings.instagram_url} target="_blank" rel="noopener noreferrer" className="hover:scale-110 transition-transform">
                      <img src={iconInstagram} alt="Instagram" className="h-8 w-8 rounded-lg" />
                    </a>
                  )}
                  {settings?.facebook_url && (
                    <a href={settings.facebook_url} target="_blank" rel="noopener noreferrer" className="hover:scale-110 transition-transform">
                      <img src={iconFacebook} alt="Facebook" className="h-8 w-8 rounded-lg" />
                    </a>
                  )}
                  {settings?.tiktok_url && (
                    <a href={settings.tiktok_url} target="_blank" rel="noopener noreferrer" className="hover:scale-110 transition-transform">
                      <img src={iconTiktok} alt="TikTok" className="h-8 w-8 rounded-lg" />
                    </a>
                  )}
                  {settings?.youtube_url && (
                    <a href={settings.youtube_url} target="_blank" rel="noopener noreferrer" className="hover:scale-110 transition-transform">
                      <img src={iconYoutube} alt="YouTube" className="h-8 w-8 rounded-lg" />
                    </a>
                  )}
                  {settings?.twitter_url && (
                    <a href={settings.twitter_url} target="_blank" rel="noopener noreferrer" className="opacity-60 hover:opacity-100 text-sm">Twitter</a>
                  )}
                </div>
                {settings?.google_maps_url && (
                  <a href={settings.google_maps_url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-2 hover:scale-105 transition-transform">
                    <img src={iconLocation} alt="Localização" className="h-6 w-6" />
                    <span className="text-sm opacity-70">{t.store.viewOnGoogleMaps}</span>
                  </a>
                )}
              </div>
            </div>
            <Separator className="my-6" style={{ backgroundColor: `${footerTextColor}20` }} />
            <div className="flex flex-col items-center gap-6 mb-6 px-4">
              <div className="text-center">
                <p className="text-sm font-semibold mb-3 opacity-70">{t.store.paymentMethods}</p>
                <img src={paymentMethodsImg} alt="Formas de pagamento aceitas" className="w-full max-w-md mx-auto object-contain" />
              </div>
              <div className="bg-white/10 rounded-xl p-4 border border-white/20">
                <img src={securityBadgesImg} alt="Site Seguro - SSL Certificado" className="w-full max-w-lg mx-auto object-contain" />
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-4 mb-4 text-xs opacity-50">
              <Link to={`${basePath}/legal/politica-de-privacidade`} className="hover:opacity-100 transition-opacity underline">{t.store.privacyPolicy}</Link>
              <Link to={`${basePath}/legal/termos-de-uso`} className="hover:opacity-100 transition-opacity underline">{t.store.termsOfUse}</Link>
              <Link to={`${basePath}/legal/cookies`} className="hover:opacity-100 transition-opacity underline">{t.store.cookiePolicy}</Link>
            </div>
            <p className="text-center text-xs opacity-40">© {new Date().getFullYear()} {storeName}. {t.store.allRightsReserved}</p>
          </div>
        </footer>

        <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t border-border bg-card shadow-[0_-2px_10px_rgba(0,0,0,0.08)]">
          <div className="flex items-center justify-around h-14">
            <Link
              to={basePath}
              className="flex flex-col items-center justify-center flex-1 h-full transition-colors"
              style={{ color: isHomePage ? primaryColor : undefined }}
            >
              <Home className={`h-5 w-5 ${!isHomePage ? "text-muted-foreground" : ""}`} />
              <span className="text-[10px] mt-0.5 font-medium">{t.store.home}</span>
            </Link>
            <button
              onClick={() => {
                const searchInput = document.querySelector(`input[placeholder="${t.store.searchPlaceholder}"]`) as HTMLInputElement;
                if (searchInput) { searchInput.focus(); searchInput.scrollIntoView({ behavior: "smooth" }); }
                else navigate(basePath);
              }}
              className="flex flex-col items-center justify-center flex-1 h-full text-muted-foreground transition-colors"
            >
              <Search className="h-5 w-5" />
              <span className="text-[10px] mt-0.5 font-medium">{t.store.search}</span>
            </button>
            <Link
              to={`${basePath}/checkout`}
              className="flex flex-col items-center justify-center flex-1 h-full relative transition-colors"
              style={{ color: isCheckout ? primaryColor : undefined }}
            >
              <div className="relative">
                <ShoppingCart className="h-5 w-5" />
                {cart.count > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 h-4 w-4 rounded-full text-[10px] font-bold flex items-center justify-center text-white" style={{ backgroundColor: primaryColor }}>
                    {cart.count}
                  </span>
                )}
              </div>
              <span className="text-[10px] mt-0.5 font-medium">{t.store.cart}</span>
            </Link>
            <div className="flex flex-col items-center justify-center flex-1 h-full transition-colors text-muted-foreground">
              <CustomerNotificationsBell storeUserId={settings?.user_id} primaryColor={primaryColor} isMobileNav />
            </div>
            <button
              onClick={() => user ? setProfileModalOpen(true) : setAuthModalOpen(true)}
              className="flex flex-col items-center justify-center flex-1 h-full transition-colors"
              style={{ color: user ? primaryColor : undefined }}
            >
              <User className="h-5 w-5" />
              <span className="text-[10px] mt-0.5 font-medium">{user ? (isAdminPreview ? storeText.preview : t.store.account) : t.auth.login}</span>
            </button>
          </div>
        </nav>

        {settings?.user_id && ((settings as any).is_premium_plan || (settings as any).is_pro_plan) && (
          <StorefrontAIChat
            storeUserId={settings.user_id}
            storeName={settings.store_name || storeText.defaultStore}
            aiName={(settings as any).ai_name}
            aiAvatarUrl={(settings as any).ai_avatar_url}
            primaryColor={settings.primary_color}
            isPremium={(settings as any).is_premium_plan}
          />
        )}

        {settings?.store_whatsapp && (settings as any).is_pro_plan && (
          <a
            href={`https://wa.me/${settings.store_whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(storeText.whatsappMessage)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="fixed z-40 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all duration-300 hover:scale-110 hover:shadow-green-500/40 animate-fade-in bottom-36 md:bottom-24 right-6"
            title={storeText.whatsappTitle}
            style={{ boxShadow: "0 4px 20px rgba(37, 211, 102, 0.35)" }}
          >
            <img src={whatsappIcon} alt="WhatsApp" className="h-14 w-14 rounded-full drop-shadow-md" />
          </a>
        )}

        {settings?.user_id && (
          <>
            <CustomerAuthModal open={authModalOpen} onOpenChange={setAuthModalOpen} storeUserId={settings.user_id} />
            <CustomerProfileModal 
              open={profileModalOpen} 
              onOpenChange={setProfileModalOpen} 
              storeUserId={settings?.user_id} 
              basePath={basePath} 
              isPremium={settings?.is_premium_plan} 
            />
          </>
        )}
        <CookieConsent
          basePath={basePath}
          storeUserId={settings?.user_id}
          primaryColor={settings?.primary_color}
          buttonColor={settings?.button_color}
          buttonTextColor={settings?.button_text_color}
        />
      </div>
    </LojaContext.Provider>
  );
}
