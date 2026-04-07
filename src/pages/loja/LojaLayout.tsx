import { useState, useEffect } from "react";
import { Outlet, Link, useNavigate, useParams, useLocation } from "react-router-dom";
import { usePublicMarketingConfig } from "@/hooks/usePublicStoreConfig";
import { AnnouncementBar, FreeShippingBar, PopupCoupon } from "@/components/storefront/MarketingWidgets";
import { usePublicStoreBySlug, usePublicThemeConfig } from "@/hooks/usePublicStore";
import { useCart } from "@/hooks/useCart";
import { useCustomerAuth } from "@/hooks/useCustomerAuth";
import { ShoppingCart, Menu, X, Search, MapPin, Phone, MessageCircle, Home, Package, Truck, User, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { StoreMarquee } from "@/components/StoreMarquee";
import { CustomerAuthModal } from "@/components/CustomerAuthModal";
import { CustomerProfileModal } from "@/components/CustomerProfileModal";
import { ThemeToggle, useThemeScope } from "@/components/ThemeToggle";
import siteSeguro from "@/assets/site-seguro.webp";
import compraSegura from "@/assets/compra-segura.webp";
import paymentCards from "@/assets/payment-cards.webp";
import pixLogo from "@/assets/pix-logo.webp";
import whatsappIcon from "@/assets/whatsapp-icon.png";
import iconInstagram from "@/assets/icon-instagram.png";
import iconTiktok from "@/assets/icon-tiktok.png";
import iconFacebook from "@/assets/icon-facebook.png";
import iconYoutube from "@/assets/icon-youtube.png";
import iconLocation from "@/assets/icon-location.png";

export interface LojaContextType {
  cart: ReturnType<typeof useCart>;
  settings: any;
  searchTerm: string;
  setSearchTerm: (s: string) => void;
  storeUserId?: string;
}

import { createContext, useContext } from "react";
const LojaContext = createContext<LojaContextType | null>(null);
export const useLojaContext = () => useContext(LojaContext)!;

export default function LojaLayout() {
  const { slug } = useParams();
  const storeThemeScope = `store-${slug || "default"}`;
  const { dark: storeDark } = useThemeScope(storeThemeScope);
  const { data: settingsBySlug, isLoading: slugLoading } = usePublicStoreBySlug(slug);
  const { user, customer, signOut } = useCustomerAuth();
  const cart = useCart();
  const [mobileMenu, setMobileMenu] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const settings = settingsBySlug;
  const isLoading = slugLoading;
  const { data: marketingConfig } = usePublicMarketingConfig(settings?.user_id);
  const { data: themeConfig } = usePublicThemeConfig(settings?.user_id);

  // Detect if current user is the store owner (admin previewing)
  const isAdminPreview = !!user && !!settingsBySlug && user.id === settingsBySlug.user_id;

  // Apply dark class based on user preference or store setting
  useEffect(() => {
    const isDark = themeConfig?.theme_mode === 'dark' || storeDark;
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    return () => {
      document.documentElement.classList.remove("dark");
    };
  }, [storeDark, themeConfig?.theme_mode]);

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(price);

  const basePath = slug ? `/loja/${slug}` : "/loja";
  const logoSize = settings?.logo_size || 32;

  // Apply store colors as CSS custom properties for the entire store
  useEffect(() => {
    if (settings || themeConfig) {
      const root = document.documentElement;
      
      // Use theme config if available, fallback to settings
      const primary = themeConfig?.primary_color || settings?.primary_color || "#6d28d9";
      const secondary = themeConfig?.secondary_color || settings?.secondary_color || "#f5f3ff";
      const bg = themeConfig?.background_color || (settings as any).page_bg_color || "#ffffff";
      const text = themeConfig?.text_color || "#000000";

      root.style.setProperty("--store-primary", primary);
      root.style.setProperty("--store-secondary", secondary);
      root.style.setProperty("--store-accent", settings?.accent_color || "#8b5cf6");
      root.style.setProperty("--store-button-bg", settings?.button_color || "#000000");
      root.style.setProperty("--store-button-text", settings?.button_text_color || "#ffffff");
      root.style.setProperty("--store-bg-base", bg);
      root.style.setProperty("--store-text-base", text);
      
      return () => {
        root.style.removeProperty("--store-primary");
        root.style.removeProperty("--store-secondary");
        root.style.removeProperty("--store-accent");
        root.style.removeProperty("--store-button-bg");
        root.style.removeProperty("--store-button-text");
        root.style.removeProperty("--store-bg-base");
        root.style.removeProperty("--store-text-base");
      };
    }
  }, [settings, themeConfig]);

  // Slug is required — no default store
  if (!slug) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <div className="text-center space-y-4 p-8">
          <div className="text-6xl">🔍</div>
          <h1 className="text-3xl font-bold">Loja não encontrada</h1>
          <p className="text-gray-400">Acesse uma loja pelo seu endereço específico.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-white border-t-transparent" />
      </div>
    );
  }

  if (slug && !settings) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <div className="text-center space-y-4 p-8">
          <div className="text-6xl">🔍</div>
          <h1 className="text-3xl font-bold">Loja não encontrada</h1>
          <p className="text-gray-400">A loja "{slug}" não existe ou foi removida.</p>
        </div>
      </div>
    );
  }

  // Store blocked by super admin
  if (settings && (settings as any).store_blocked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <div className="text-center space-y-4 p-8 max-w-md">
          <div className="text-6xl">🚫</div>
          <h1 className="text-3xl font-bold">Loja Indisponível</h1>
          <p className="text-gray-400">Esta loja está temporariamente indisponível. Entre em contato com o suporte.</p>
        </div>
      </div>
    );
  }

  if (settings && !settings.store_open) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <div className="text-center space-y-4 p-8">
          <div className="text-6xl">🚧</div>
          <h1 className="text-3xl font-bold">Loja Fechada</h1>
          <p className="text-gray-400">Estamos temporariamente fechados. Volte em breve!</p>
        </div>
      </div>
    );
  }

  const storeName = settings?.store_name || "Loja";
  const primaryColor = settings?.primary_color || "#6d28d9";
  const headerBgColor = settings?.header_bg_color || "#ffffff";
  const headerTextColor = settings?.header_text_color || "#000000";
  const footerBgColor = settings?.footer_bg_color || "#000000";
  const footerTextColor = settings?.footer_text_color || "#ffffff";
  const buttonColor = settings?.button_color || "#000000";
  const buttonTextColor = settings?.button_text_color || "#ffffff";

  // Bottom nav items for mobile
  const isHomePage = location.pathname === basePath || location.pathname === basePath + "/";
  const isCheckout = location.pathname.includes("/checkout");
  const isRastreio = location.pathname.includes("/rastreio");


  return (
    <LojaContext.Provider value={{ cart, settings, searchTerm, setSearchTerm, storeUserId: settings?.user_id }}>
      <div 
        className="min-h-screen pb-16 md:pb-0 transition-colors"
        style={{ 
          backgroundColor: themeConfig?.theme_mode === 'dark' ? 'hsl(var(--background))' : (themeConfig?.background_color || (settings as any).page_bg_color || "#ffffff"),
          color: themeConfig?.theme_mode === 'dark' ? 'hsl(var(--foreground))' : (themeConfig?.text_color || "#000000")
        }}
      >
        {/* Marketing: Announcement Bar */}
        {marketingConfig && <AnnouncementBar config={marketingConfig} />}

        {/* Marquee ticker */}
        {settings?.marquee_enabled && settings?.marquee_text && (
          <StoreMarquee
            text={settings.marquee_text}
            speed={settings.marquee_speed}
            bgColor={settings.marquee_bg_color}
            textColor={settings.marquee_text_color}
          />
        )}

        {/* Marketing: Free Shipping Bar */}
        {marketingConfig && <FreeShippingBar config={marketingConfig} cartTotal={cart.total} />}

        {/* Marketing: Popup Coupon */}
        {marketingConfig && <PopupCoupon config={marketingConfig} />}

        {/* Top bar */}
        <div className="text-xs py-1" style={{ backgroundColor: primaryColor, color: (primaryColor === '#ffffff' || primaryColor === 'white') ? '#000000' : '#ffffff' }}>
          <div className="max-w-7xl mx-auto px-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              {settings?.store_phone && (
                <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{settings.store_phone}</span>
              )}
              {settings?.store_location && (
                <span className="flex items-center gap-1 hidden sm:flex"><MapPin className="h-3 w-3" />{settings.store_location}</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {isAdminPreview ? (
                <span className="flex items-center gap-1 text-yellow-200 font-medium">
                  👁️ Modo Preview
                </span>
              ) : user ? (
                <div className="flex items-center gap-2">
                  <button onClick={() => setProfileModalOpen(true)} className="flex items-center gap-1 hover:opacity-80">
                    <User className="h-3 w-3" /> {customer?.name?.split(" ")[0] || "Conta"}
                  </button>
                  <button onClick={() => { signOut(); }} className="flex items-center gap-1 hover:opacity-80 ml-2">
                    <LogOut className="h-3 w-3" /> Sair
                  </button>
                </div>
              ) : (
                <button onClick={() => setAuthModalOpen(true)} className="flex items-center gap-1 hover:opacity-80">
                  <User className="h-3 w-3" /> Entrar
                </button>
              )}
              {settings?.instagram_url && <a href={settings.instagram_url} target="_blank" rel="noopener noreferrer" className="hover:opacity-80 hidden sm:inline">Instagram</a>}
              {settings?.facebook_url && <a href={settings.facebook_url} target="_blank" rel="noopener noreferrer" className="hover:opacity-80 hidden sm:inline">Facebook</a>}
              {settings?.store_whatsapp && (
                <a href={`https://wa.me/${settings.store_whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:opacity-80">
                  <MessageCircle className="h-3 w-3" /> WhatsApp
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Header */}
        <header className="sticky top-0 z-50 border-b border-border shadow-sm transition-colors" style={{ backgroundColor: headerBgColor, color: headerTextColor }}>
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileMenu(!mobileMenu)} style={{ color: headerTextColor }}>
              {mobileMenu ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>

            <Link to={basePath} className="flex items-center gap-2 shrink-0">
              {settings?.logo_url ? (
                <img
                  src={settings.logo_url}
                  alt={storeName}
                  style={{ height: `${logoSize}px`, maxWidth: `${Math.max(120, logoSize * 5)}px` }}
                  className="object-contain"
                />
              ) : (
                <span className="text-xl font-bold" style={{ color: headerTextColor }}>{storeName}</span>
              )}
            </Link>

            <div className="flex-1 max-w-xl mx-auto hidden sm:block">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50" style={{ color: headerTextColor }} />
                <Input
                  placeholder="Buscar produtos..."
                  className="pl-9 bg-secondary border-border rounded-full"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && navigate(basePath)}
                  style={{ "--tw-ring-color": primaryColor } as any}
                />
              </div>
            </div>

            <ThemeToggle className="hidden sm:flex" scope={storeThemeScope} applyToRoot={false} />

            {!isAdminPreview && (
              <Button variant="ghost" size="icon" className="sm:hidden" onClick={() => user ? setProfileModalOpen(true) : setAuthModalOpen(true)}>
                {user ? <LogOut className="h-5 w-5" /> : <User className="h-5 w-5" />}
              </Button>
            )}

            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="relative" style={{ color: headerTextColor }}>
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
                  <SheetTitle>Carrinho ({cart.count})</SheetTitle>
                </SheetHeader>
                <div className="mt-4 space-y-3 flex-1 overflow-auto">
                  {cart.items.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">Carrinho vazio</p>
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
                          <p className="text-sm text-muted-foreground">{formatPrice(item.price)}</p>
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
                      <span>Total</span>
                      <span>{formatPrice(cart.total)}</span>
                    </div>
                    <Button className="w-full" style={{ backgroundColor: buttonColor, color: buttonTextColor }} onClick={() => navigate(`${basePath}/checkout`)}>
                      Finalizar Compra
                    </Button>
                    {settings?.sell_via_whatsapp && settings?.store_whatsapp && (
                      <Button
                        variant="outline"
                        className="w-full border-green-500 text-green-600 hover:bg-green-50"
                        onClick={() => {
                          const msg = cart.items.map((i) => `${i.quantity}x ${i.name} - ${formatPrice(i.price * i.quantity)}`).join("\n");
                          const text = `Olá! Gostaria de fazer o pedido:\n\n${msg}\n\nTotal: ${formatPrice(cart.total)}`;
                          window.open(`https://wa.me/${settings.store_whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`, "_blank");
                        }}
                      >
                        <MessageCircle className="mr-2 h-4 w-4" /> Pedir via WhatsApp
                      </Button>
                    )}
                  </div>
                )}
              </SheetContent>
            </Sheet>
          </div>

          <div className="sm:hidden px-4 pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar produtos..."
                className="pl-9 bg-secondary border-border rounded-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </header>

        {/* Mobile Menu */}
        <div
          className={`lg:hidden overflow-hidden transition-all duration-500 ease-out border-b border-border ${
            mobileMenu ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
          }`}
          style={{ backgroundColor: headerBgColor, color: headerTextColor }}
        >
          <nav className="max-w-7xl mx-auto px-4 py-4 space-y-1">
            {[
              { icon: Home, label: "Início", to: basePath },
              { icon: Package, label: "Produtos", to: basePath },
              { icon: ShoppingCart, label: `Carrinho (${cart.count})`, to: `${basePath}/checkout` },
              { icon: Truck, label: "Rastrear Pedido", to: `${basePath}/rastreio` },
              ...(settings?.store_whatsapp ? [{ icon: MessageCircle, label: "WhatsApp", to: `https://wa.me/${settings.store_whatsapp.replace(/\D/g, "")}`, external: true }] : []),
            ].map((item: any, i) => (
              <div key={i}>
                {item.external ? (
                  <a
                    href={item.to}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium hover:bg-muted transition-colors"
                    onClick={() => setMobileMenu(false)}
                    style={{ color: headerTextColor }}
                  >
                    <item.icon className="h-5 w-5" style={{ color: primaryColor }} />
                    <span>{item.label}</span>
                  </a>
                ) : (
                  <Link
                    to={item.to}
                    className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium hover:bg-muted transition-colors"
                    onClick={() => setMobileMenu(false)}
                    style={{ color: headerTextColor }}
                  >
                    <item.icon className="h-5 w-5" style={{ color: primaryColor }} />
                    <span>{item.label}</span>
                  </Link>
                )}
              </div>
            ))}
          </nav>
        </div>

        <main>
          <Outlet />
        </main>

        {/* Footer */}
        <footer style={{ backgroundColor: footerBgColor, color: footerTextColor }} className="mt-12">
          <div className="max-w-7xl mx-auto px-4 py-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div>
                <h3 className="font-bold text-lg mb-3">{storeName}</h3>
                {settings?.store_description && <p className="opacity-60 text-sm">{settings.store_description}</p>}
              </div>
              <div>
                <h3 className="font-bold mb-3">Contato</h3>
                <div className="space-y-2 text-sm opacity-60">
                  {settings?.store_phone && <p>📞 {settings.store_phone}</p>}
                  {settings?.store_whatsapp && <p>💬 {settings.store_whatsapp}</p>}
                  {settings?.store_address && <p>📍 {settings.store_address}</p>}
                </div>
              </div>
              <div>
                <h3 className="font-bold mb-3">Redes Sociais</h3>
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
                    <span className="text-sm opacity-70">Ver no Google Maps</span>
                  </a>
                )}
              </div>
            </div>
            <Separator className="my-6" style={{ backgroundColor: `${footerTextColor}20` }} />
            <div className="flex items-center justify-center gap-4 flex-wrap mb-4">
              <img src={siteSeguro} alt="Site Seguro" className="h-8 brightness-0 invert opacity-70" />
              <img src={compraSegura} alt="Compra Segura" className="h-8 brightness-0 invert opacity-70" />
              <img src={paymentCards} alt="Bandeiras aceitas" className="h-5 brightness-0 invert opacity-60" />
              <img src={pixLogo} alt="PIX" className="h-5 brightness-0 invert opacity-60" />
            </div>
            <p className="text-center text-xs opacity-40">© {new Date().getFullYear()} {storeName}. Todos os direitos reservados.</p>
          </div>
        </footer>

        {/* Mobile Bottom Navigation */}
        <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t border-border bg-card shadow-[0_-2px_10px_rgba(0,0,0,0.08)]">
          <div className="flex items-center justify-around h-14">
            <Link
              to={basePath}
              className="flex flex-col items-center justify-center flex-1 h-full transition-colors"
              style={{ color: isHomePage ? primaryColor : undefined }}
            >
              <Home className={`h-5 w-5 ${!isHomePage ? "text-muted-foreground" : ""}`} />
              <span className="text-[10px] mt-0.5 font-medium">Início</span>
            </Link>
            <button
              onClick={() => {
                const searchInput = document.querySelector('input[placeholder="Buscar produtos..."]') as HTMLInputElement;
                if (searchInput) { searchInput.focus(); searchInput.scrollIntoView({ behavior: "smooth" }); }
                else navigate(basePath);
              }}
              className="flex flex-col items-center justify-center flex-1 h-full text-muted-foreground transition-colors"
            >
              <Search className="h-5 w-5" />
              <span className="text-[10px] mt-0.5 font-medium">Buscar</span>
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
              <span className="text-[10px] mt-0.5 font-medium">Carrinho</span>
            </Link>
            <Link
              to={`${basePath}/rastreio`}
              className="flex flex-col items-center justify-center flex-1 h-full transition-colors"
              style={{ color: isRastreio ? primaryColor : undefined }}
            >
              <Truck className="h-5 w-5" />
              <span className="text-[10px] mt-0.5 font-medium">Rastreio</span>
            </Link>
            {!isAdminPreview && (
              <button
                onClick={() => user && customer ? setProfileModalOpen(true) : setAuthModalOpen(true)}
                className="flex flex-col items-center justify-center flex-1 h-full transition-colors"
                style={{ color: user ? primaryColor : undefined }}
              >
                <User className="h-5 w-5" />
                <span className="text-[10px] mt-0.5 font-medium">{user ? "Conta" : "Entrar"}</span>
              </button>
            )}
          </div>
        </nav>

        {/* Floating WhatsApp Button - positioned above bottom nav on mobile */}
        {settings?.store_whatsapp && (
          <a
            href={`https://wa.me/${settings.store_whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent("Olá! Gostaria de mais informações.")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="fixed z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all duration-300 hover:scale-110 hover:shadow-green-500/40 animate-fade-in bottom-20 md:bottom-6 right-6"
            title="Fale conosco pelo WhatsApp"
            style={{ boxShadow: "0 4px 20px rgba(37, 211, 102, 0.35)" }}
          >
            <img src={whatsappIcon} alt="WhatsApp" className="h-14 w-14 rounded-full drop-shadow-md" />
          </a>
        )}

        {/* Auth modals */}
        {settings?.user_id && (
          <>
            <CustomerAuthModal open={authModalOpen} onOpenChange={setAuthModalOpen} storeUserId={settings.user_id} />
            <CustomerProfileModal open={profileModalOpen} onOpenChange={setProfileModalOpen} storeUserId={settings.user_id} />
          </>
        )}
      </div>
    </LojaContext.Provider>
  );
}
