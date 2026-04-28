import { useState, useEffect, useLayoutEffect, useRef, Suspense } from "react";
import { Outlet, Link, useNavigate, useParams, useLocation } from "react-router-dom";
import { useMemo } from "react";
import { StorefrontAIChat } from "@/components/storefront/StorefrontAIChat";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePublicMarketingConfig } from "@/hooks/usePublicStoreConfig";
import { AnnouncementBar, FreeShippingBar, PopupCoupon, CountdownBar } from "@/components/storefront/MarketingWidgets";
import { RestockAlertCard } from "@/components/storefront/RestockAlertCard";
import { PWAInstallBanner } from "@/components/storefront/PWAInstallBanner";
import { SmartSearchBar } from "@/components/storefront/SmartSearchBar";
import { StoreFilter } from "@/components/storefront/StoreFilter";
import { PushPermissionPrompt } from "@/components/storefront/PushPermissionPrompt";
import { usePublicThemeConfig, usePublicProductPageConfig, useResolvedPublicStore, usePublicProducts, usePublicCategories } from "@/hooks/usePublicStore";
import { isPlatformHost } from "@/lib/storeDomain";
import { usePwaManifest } from "@/hooks/usePwaManifest";
import { useCart } from "@/hooks/useCart";
import { useCustomerAuth } from "@/hooks/useCustomerAuth";
import { ShoppingCart, Menu, X, Search, MapPin, Phone, MessageCircle, Home, Package, Truck, User, LogOut, Bell, Ticket, BadgeCheck, LocateFixed, ArrowLeft, Lock } from "lucide-react";
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
import { PaymentFlags } from "@/components/storefront/PaymentFlags";
import securityBadgesImg from "@/assets/security-badges.png";
import whatsappIcon from "@/assets/whatsapp-icon.png";
import { StoreLogoSplash } from "@/components/storefront/StoreLogoSplash";
import iconInstagram from "@/assets/icon-instagram.png";
import iconTiktok from "@/assets/icon-tiktok.png";
import iconFacebook from "@/assets/icon-facebook.png";
import iconYoutube from "@/assets/icon-youtube.png";
import iconLocation from "@/assets/icon-location.png";
import { useLocalizedText, useLocalizedTextList } from "@/hooks/useLocalizedStoreText";
import { VideoShopping } from "@/components/storefront/VideoShopping";
import { FlyToCart } from "@/components/storefront/FlyToCart";
import sidebarBg from "@/assets/sidebar-bg.png";

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

function useLogoCrop(src?: string) {
  const [crop, setCrop] = useState({ left: 0, right: 0, top: 0, bottom: 0, ratio: 4 });

  useEffect(() => {
    if (!src) return;
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        canvas.width = w;
        canvas.height = h;
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, w, h).data;
        let minX = w, minY = h, maxX = 0, maxY = 0;
        for (let y = 0; y < h; y += 2) {
          for (let x = 0; x < w; x += 2) {
            const i = (y * w + x) * 4;
            const a = data[i + 3];
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            if (a > 24 && Math.min(r, g, b) < 245) {
              minX = Math.min(minX, x);
              minY = Math.min(minY, y);
              maxX = Math.max(maxX, x);
              maxY = Math.max(maxY, y);
            }
          }
        }
        if (cancelled || minX >= maxX || minY >= maxY) return;
        const padX = Math.round(w * 0.015);
        const padY = Math.round(h * 0.04);
        minX = Math.max(0, minX - padX);
        maxX = Math.min(w, maxX + padX);
        minY = Math.max(0, minY - padY);
        maxY = Math.min(h, maxY + padY);
        setCrop({ left: minX / w, right: (w - maxX) / w, top: minY / h, bottom: (h - maxY) / h, ratio: (maxX - minX) / Math.max(1, maxY - minY) });
      } catch {
        setCrop({ left: 0, right: 0, top: 0, bottom: 0, ratio: img.naturalWidth / Math.max(1, img.naturalHeight) });
      }
    };
    img.src = src;
    return () => { cancelled = true; };
  }, [src]);

  return crop;
}

export default function LojaLayout() {
  const { slug: rawSlug } = useParams();
  const slug = rawSlug?.toLowerCase();
  const currentHostname = typeof window !== "undefined" ? window.location.hostname.toLowerCase().replace(/^www\./, "") : "";
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
  const [headerCompact, setHeaderCompact] = useState(false);
  const [showEntrySplash, setShowEntrySplash] = useState(true);
  const logoCrop = useLogoCrop((settingsBySlug as any)?.logo_url);

  // Shrink header on scroll for better navigation
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY || document.documentElement.scrollTop;
      setHeaderCompact(y > 40);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
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

  // Cache logo for splash screen on next visits
  useEffect(() => {
    if (typeof window === "undefined") return;
    const splashKey = slug || currentHostname;
    if (!splashKey) return;
    const logo = (settingsBySlug as any)?.logo_url;
    const name = (settingsBySlug as any)?.store_name;
    if (logo) localStorage.setItem(`splash_logo_${splashKey}`, logo);
    if (name) localStorage.setItem(`splash_name_${splashKey}`, name);
  }, [slug, currentHostname, (settingsBySlug as any)?.logo_url, (settingsBySlug as any)?.store_name]);

  useEffect(() => {
    setShowEntrySplash(true);
    const timer = window.setTimeout(() => setShowEntrySplash(false), 900);
    return () => window.clearTimeout(timer);
  }, [slug, currentHostname]);

  // Auto-redirect to custom domain when accessing via /loja/:slug on a platform host
  useEffect(() => {
    if (typeof window === "undefined") return;
    const customDomain = (settingsBySlug as any)?.custom_domain;
    const domainStatus = (settingsBySlug as any)?.domain_status;
    if (!customDomain) return;
    if (!(domainStatus === "verified" || domainStatus === "active")) return;
    const currentHost = window.location.hostname.toLowerCase().replace(/^www\./, "");
    const target = String(customDomain).toLowerCase().replace(/^www\./, "");
    if (!isPlatformHost(currentHost)) return;
    if (currentHost === target) return;
    // Strip the /loja/:slug prefix and redirect to the custom domain root
    const stripped = location.pathname.replace(/^\/loja\/[^/]+/, "") || "/";
    window.location.replace(`https://${target}${stripped}${location.search}`);
  }, [settingsBySlug, location.pathname, location.search]);

  // Real-time store status monitoring moved down to avoid hook violation


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
    const msgDetecting = locale === "pt" ? "📍 Detectando sua localização..." : locale === "en" ? "📍 Detecting your location..." : locale === "es" ? "📍 Detectando tu ubicación..." : "📍 Détection de votre position...";
    const msgFail = locale === "pt" ? "Não foi possível detectar sua localização" : locale === "en" ? "Could not detect your location" : locale === "es" ? "No se pudo detectar tu ubicación" : "Impossible de détecter votre position";
    toast.info(msgDetecting);

    const applyCep = (cep: string, city: string) => {
      setGlobalCep(cep);
      localStorage.setItem("global_cep", cep);
      if (city) {
        setGlobalCity(city);
        localStorage.setItem("global_city", city);
      }
      toast.success(`📍 ${city || (locale === "pt" ? "Localização detectada" : "Location detected")}`);
    };

    // Try ipapi.co
    try {
      const r = await fetch("https://ipapi.co/json/", { signal: AbortSignal.timeout(5000) });
      const d = await r.json();
      if (d?.postal) {
        const c = d.postal.replace(/\D/g, "");
        if (c.length === 8) { applyCep(c, d.city ? `${d.city} - ${d.region_code || ""}` : ""); return; }
      }
    } catch { /* fallback */ }

    // Try ip-api.com
    try {
      const r = await fetch("https://ip-api.com/json/?fields=zip,city,regionName", { signal: AbortSignal.timeout(5000) });
      const d = await r.json();
      if (d?.zip) {
        const c = d.zip.replace(/\D/g, "");
        if (c.length === 8) { applyCep(c, d.city ? `${d.city} - ${d.regionName || ""}` : ""); return; }
      }
    } catch { /* fallback */ }

    toast.error(msgFail);
  };

  const settings = settingsBySlug;
  const isLoading = slugLoading;
  const { data: smartSearchProducts } = usePublicProducts(settings?.user_id);
  const { data: categories } = usePublicCategories(settings?.user_id);
  const { unreadCount: notifUnread } = useCustomerNotifications(settings?.user_id);
  const { data: marketingConfig, refetch: refetchMarketing } = usePublicMarketingConfig(settings?.user_id);
  const { data: themeConfig, refetch: refetchTheme } = usePublicThemeConfig(settings?.user_id);
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

  const hostname = typeof window !== "undefined" ? window.location.hostname : "";
  const isCustomDomain = !slug && hostname && !isPlatformHost(hostname);
  
  const storeInstallName = useMemo(() => {
    if (slug) return slug.split('-')[0];
    if (isCustomDomain) return hostname.split('.')[0];
    return settings?.store_name?.trim() || "Loja";
  }, [slug, hostname, isCustomDomain, settings?.store_name]);

  const storeStartUrl = useMemo(() => {
    if (slug) return `${window.location.origin}/loja/${slug}/`;
    if (isCustomDomain) return `${window.location.origin}/`;
    return undefined;
  }, [slug, hostname, isCustomDomain]);

  const storeIconUrl = themeConfig?.favicon_url || settings?.favicon_url || settings?.logo_url || undefined;
  const storeIconVersion = themeConfig?.updated_at || settings?.updated_at || undefined;

  const manifestId = useMemo(() => {
    if (slug) return `cartlly-store-${slug}`;
    if (isCustomDomain) return `cartlly-store-domain-${hostname}`;
    if (settings?.id) return `cartlly-store-id-${settings.id}`;
    return "cartlly-store-default";
  }, [slug, hostname, isCustomDomain, settings?.id]);

  usePwaManifest({
    id: manifestId,
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
  const isMinimalMenu = themeConfig?.header_style === 'minimal';
  const queryClient = useQueryClient();

  // Prefetch critical data
  useEffect(() => {
    if (settings?.user_id) {
      // Products
      queryClient.prefetchQuery({
        queryKey: ["public_products", settings.user_id],
        queryFn: async () => {
          const { data, error } = await supabase
            .from("products")
            .select("*, categories(name)")
            .eq("published", true)
            .eq("user_id", settings.user_id)
            .or("is_prize.is.null,is_prize.eq.false")
            .order("created_at", { ascending: false });
          if (error) throw error;
          return data;
        },
        staleTime: 1000 * 60 * 5,
      });

      // Categories
      queryClient.prefetchQuery({
        queryKey: ["public_categories", settings.user_id],
        queryFn: async () => {
          const { data, error } = await supabase
            .from("categories")
            .select("*")
            .eq("user_id", settings.user_id)
            .order("name");
          if (error) throw error;
          return data;
        },
        staleTime: 1000 * 60 * 10,
      });
    }
  }, [settings?.user_id, queryClient]);

  useEffect(() => {
    if (!settingsBySlug?.id || !settingsBySlug?.user_id) return;

    const channel = supabase
      .channel(`store-updates-rt-${settingsBySlug.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "store_settings",
          filter: `id=eq.${settingsBySlug.id}`,
        },
        () => {
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
          refetchMarketing();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [settingsBySlug?.id, settingsBySlug?.user_id, refetchSettings, refetchTheme, refetchMarketing]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    
    if (ref) {
      localStorage.setItem(`store_referral_${slug}`, ref);
      if (settings?.user_id) {
        localStorage.setItem(`store_referral_${settings.user_id}`, ref);
      }
      // Remove ref from URL but keep other params
      params.delete("ref");
      const newSearch = params.toString();
      const newPath = window.location.pathname + (newSearch ? `?${newSearch}` : "") + window.location.hash;
      window.history.replaceState({}, document.title, newPath);
    } else if (settings?.user_id) {
      // If no ref in URL, check if we have a saved ref for this slug to sync with user_id
      const savedRef = localStorage.getItem(`store_referral_${slug}`);
      if (savedRef) {
        localStorage.setItem(`store_referral_${settings.user_id}`, savedRef);
      }
    }
  }, [slug, settings?.user_id]);

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

  const rawLogoSize = Number((settings as any)?.logo_size ?? 40);
  const logoSize = Number.isFinite(rawLogoSize) ? Math.max(24, Math.min(rawLogoSize, 180)) : 40;
  const logoBadgeSize = Math.max(11, Math.min(Math.round(logoSize * 0.20), 17));
  const logoBadgeGap = 1;
  const storefrontLogoWidth = Math.max(150, Math.min(Math.round(logoSize * 6), 340));
  const logoCropHeight = headerCompact ? Math.round(logoSize * 0.55) : logoSize;
  const croppedLogoWidth = Math.max(60, Math.min(Math.round(logoCropHeight * logoCrop.ratio), storefrontLogoWidth));
  const checkoutLogoHeight = Math.max(48, Math.min(Math.round(logoSize * 1.25), 130));
  const checkoutLogoWidth = Math.max(180, Math.min(Math.round(checkoutLogoHeight * 6), 380));
  const verifiedBadgeStyle = {
    width: `${logoBadgeSize}px`,
    height: `${logoBadgeSize}px`,
    color: "#0095f6",
    fill: "#0095f6",
  };

  if (!slug && !settingsBySlug && !isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground p-4">
        <div className="text-center space-y-6 max-w-md animate-in fade-in zoom-in duration-500">
          <div className="mx-auto w-20 h-20 bg-muted rounded-full flex items-center justify-center">
            <Search className="w-10 h-10 text-muted-foreground" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">{t.misc.storeNotFound}</h1>
            <p className="text-muted-foreground text-lg">{storeText.accessStore}</p>
          </div>
          <Button asChild variant="default" size="lg" className="w-full">
            <Link to="/">{t.misc.returnHome}</Link>
          </Button>
        </div>
      </div>
    );
  }

  const splashKey = slug || currentHostname;
  const cachedLogo = typeof window !== "undefined" && splashKey ? localStorage.getItem(`splash_logo_${splashKey}`) : null;
  const cachedName = typeof window !== "undefined" && splashKey ? localStorage.getItem(`splash_name_${splashKey}`) : null;
  const splashLogo = (settingsBySlug as any)?.logo_url || cachedLogo;
  const splashName = (settingsBySlug as any)?.store_name || cachedName || slug || currentHostname || "Loja";
  const splash = <StoreLogoSplash logoUrl={splashLogo} storeName={splashName} cacheKey={splashKey} />;

  if (isLoading) {
    return splash;
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
      {showEntrySplash && splash}
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
        <div className="sticky top-0 z-50 w-full transition-all duration-300">
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

          {isCheckout ? (
            <header
              className="border-b border-border shadow-sm transition-colors backdrop-blur-md bg-opacity-95 sticky top-0 z-40"
              style={{ backgroundColor: headerBgColor, color: headerTextColor }}
            >
              <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 grid grid-cols-[auto_1fr_auto] items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate(-1)}
                  className="hover:bg-white/10"
                  style={{ color: headerTextColor }}
                  aria-label="Voltar"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>

                 <Link to={basePath || "/"} className="flex items-center justify-center gap-2 min-w-0">
                   {settings?.logo_url ? (
                     <div className="inline-flex items-center justify-center shrink-0" style={{ gap: `${logoBadgeGap}px` }}>
                       <img
                         src={settings.logo_url}
                         alt={storeName}
                          style={{ height: `${checkoutLogoHeight}px`, maxWidth: `min(${checkoutLogoWidth}px, calc(100% - ${logoBadgeSize + logoBadgeGap}px))`, width: "auto" }}
                         className="object-contain block"
                       />
                       {settings?.is_verified && (
                         <BadgeCheck
                            className="shrink-0 stroke-white stroke-[2.5px] drop-shadow-md"
                            style={verifiedBadgeStyle}
                         />
                       )}
                     </div>
                   ) : (
                    <div className="flex items-center gap-1.5">
                      <span className="text-2xl sm:text-3xl font-bold truncate" style={{ color: headerTextColor }}>{storeName}</span>
                      {settings?.is_verified && (
                        <BadgeCheck className="h-5 w-5 text-[#0095f6] fill-[#0095f6] stroke-white stroke-[1.5px]" />
                      )}
                    </div>
                  )}
                </Link>

                <div
                  className="hidden sm:flex items-center gap-1.5 text-xs font-semibold opacity-80"
                  style={{ color: headerTextColor }}
                >
                  <Lock className="h-3.5 w-3.5" />
                  <span>Compra segura</span>
                </div>
                <div className="sm:hidden w-9" aria-hidden />
              </div>
            </header>
          ) : (
          <header className="border-b border-border shadow-sm transition-all duration-300 backdrop-blur-md bg-opacity-95" style={{ backgroundColor: headerBgColor, color: headerTextColor }}>
            <div className={`max-w-7xl mx-auto pl-2 pr-1 sm:px-4 flex items-center gap-1 sm:gap-4 overflow-hidden transition-all duration-300 ${headerCompact ? 'py-0.5 sm:py-1' : 'py-1.5 sm:py-2'}`}>
              <Button variant="ghost" size="icon" className="lg:hidden h-8 w-8" onClick={() => setMobileMenu(!mobileMenu)} style={{ color: headerTextColor }}>
                {mobileMenu ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>

              <Link to={basePath || "/"} className="flex flex-1 min-w-0 lg:flex-none items-center gap-1 sm:gap-2">
                <div className="relative inline-block min-w-0 max-w-full">
                  {settings?.logo_url ? (
                    <div className="inline-flex max-w-full items-center" style={{ gap: `${logoBadgeGap}px` }}>
                      <div
                        className="overflow-hidden shrink-0 transition-[height,width] duration-300"
                        style={{
                          height: `${logoCropHeight}px`,
                          width: `min(${croppedLogoWidth}px, calc(100% - ${logoBadgeSize + logoBadgeGap}px))`,
                        }}
                      >
                        <img
                          src={settings.logo_url}
                          alt={storeName}
                          style={{
                            height: `${logoCropHeight / Math.max(0.1, 1 - logoCrop.top - logoCrop.bottom)}px`,
                            maxWidth: "none",
                            width: "auto",
                            transform: `translate(-${logoCrop.left * 100}%, -${logoCrop.top * 100}%)`,
                          }}
                          className="object-contain block"
                        />
                      </div>
                      {settings?.is_verified && (
                        <BadgeCheck
                          className="shrink-0 stroke-white stroke-[2.5px] drop-shadow-md"
                          style={verifiedBadgeStyle}
                        />
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

              {!isCheckout && (
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
              )}

              <div className="ml-auto flex shrink-0 items-center justify-end gap-0.5 sm:gap-1">
                <StorePushOptIn primaryColor={primaryColor} storeUserId={settings?.user_id} className="hidden sm:flex" />
                <CustomerNotificationsBell storeUserId={settings?.user_id} primaryColor={primaryColor} headerTextColor={headerTextColor} className="hidden sm:flex" />
                {settings?.is_premium_plan && (
                  <LanguageSelector compact className="flex shrink-0" skipGate />
                )}
                <ThemeToggle className="hidden sm:flex" scope={storeThemeScope} applyToRoot={false} />

                {settings?.instagram_url && (
                  <a href={settings.instagram_url} target="_blank" rel="noopener noreferrer" className="flex h-8 w-8 items-center justify-center hover:scale-110 transition-transform sm:h-9 sm:w-9">
                    <img src={iconInstagram} alt="Instagram" className="h-5 w-5 rounded" />
                  </a>
                )}

                <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9" onClick={() => user ? setProfileModalOpen(true) : setAuthModalOpen(true)} style={{ color: headerTextColor }}>
                  {user ? (
                    isAdminPreview ? <span className="text-[10px] font-bold">{storeText.preview}</span> : <User className="h-5 w-5" />
                  ) : (
                    <User className="h-5 w-5" />
                  )}
                </Button>
              </div>

              <Sheet open={cartSheetOpen} onOpenChange={setCartSheetOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative hidden md:inline-flex" style={{ color: headerTextColor }}>
                    <ShoppingCart className="h-5 w-5" data-cart-icon />
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

            {!isCheckout && (
              <div className="sm:hidden px-2 pb-3 flex items-center gap-2 overflow-hidden">
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
            )}

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
              <nav className="max-w-7xl mx-auto px-4 py-4 space-y-1 relative z-10">
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
                {!isMinimalMenu && (
                  <>
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

                      const className = "flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-white/10 active:opacity-70 transition-all duration-300 focus:outline-none select-none touch-manipulation";

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
                  </>
                )}

                {!isMinimalMenu && (
                  <>
                    <div className="px-3 py-2 border-t border-border mt-2 flex items-center gap-2">
                      <ThemeToggle scope={storeThemeScope} applyToRoot={false} />
                      <span className="text-sm">{t.misc.darkMode}</span>
                    </div>
                    {settings?.is_premium_plan && (
                      <LanguageSelector compact className="flex shrink-0 px-3 py-2 border-t" skipGate />
                    )}
                  </>
                )}

                <div className="px-3 py-2">
                  <StorePushOptIn primaryColor={primaryColor} storeUserId={settings?.user_id} />
                </div>
              </nav>
            </div>
          </header>
          )}

          {/* Categories bar for desktop with background image */}
          <div className="hidden lg:block relative border-b border-border shadow-sm overflow-hidden" style={{ backgroundColor: headerBgColor }}>
            <div className="max-w-7xl mx-auto px-4 py-2 relative z-10">
              <div className="flex items-center gap-6 overflow-x-auto no-scrollbar scroll-smooth">
                {categories?.map((cat, i) => (
                  <button
                    key={cat.id}
                    className="whitespace-nowrap text-sm font-medium hover:opacity-70 transition-opacity flex items-center gap-1.5 py-1 px-3 rounded-full hover:bg-black/5"
                    style={{ color: headerTextColor }}
                    onClick={() => {
                      const el = document.getElementById(`category-${cat.name}`);
                      if (el) {
                        const yOffset = -140; // Space for the double header
                        const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
                        window.scrollTo({ top: y, behavior: "smooth" });
                      } else {
                        navigate(`${basePath}?categoria=${cat.id}`);
                      }
                    }}
                  >
                    <div className="w-1 h-1 rounded-full" style={{ backgroundColor: primaryColor }} />
                    {localizedCategoryNames[i] || cat.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

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
          <Suspense fallback={splash}>
            <Outlet />
            <FlyToCart />
          </Suspense>
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
                <PaymentFlags acceptedMethods={(settings as any)?.accepted_payment_methods} />
              </div>
              <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                <img src={securityBadgesImg} alt="Site Seguro - SSL Certificado" className="w-full max-w-xl mx-auto object-contain" />
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
            <button
              type="button"
              onClick={() => setCartSheetOpen(true)}
              className="flex flex-col items-center justify-center flex-1 h-full relative transition-colors"
              style={{ color: isCheckout ? primaryColor : undefined }}
            >
              <div className="relative">
                <ShoppingCart className="h-5 w-5" data-cart-icon />
                {cart.count > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 h-4 w-4 rounded-full text-[10px] font-bold flex items-center justify-center text-white" style={{ backgroundColor: primaryColor }}>
                    {cart.count}
                  </span>
                )}
              </div>
              <span className="text-[10px] mt-0.5 font-medium">{t.store.cart}</span>
            </button>
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
              isPremium={settings?.is_premium_plan || settings?.is_pro_plan} 
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
        <VideoShopping />
      </div>
    </LojaContext.Provider>
  );
}
