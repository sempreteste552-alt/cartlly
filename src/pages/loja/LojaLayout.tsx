import { useState, useEffect, useRef } from "react";
import { Outlet, Link, useNavigate, useParams } from "react-router-dom";
import { usePublicStoreSettings, usePublicStoreBySlug } from "@/hooks/usePublicStore";
import { useCart, type CartItem } from "@/hooks/useCart";
import { useCustomerAuth } from "@/hooks/useCustomerAuth";
import { ShoppingCart, Menu, X, Search, MapPin, Phone, MessageCircle, Home, Package, Tag, Mail, Info, Truck, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { StoreMarquee } from "@/components/StoreMarquee";
import { CustomerAuthModal } from "@/components/CustomerAuthModal";
import { CustomerProfileModal } from "@/components/CustomerProfileModal";

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
  const { data: settingsBySlug, isLoading: slugLoading } = usePublicStoreBySlug(slug);
  const { data: defaultSettings, isLoading: defaultLoading } = usePublicStoreSettings();
  const { user, customer } = useCustomerAuth();

  const settings = slug ? settingsBySlug : defaultSettings;
  const isLoading = slug ? slugLoading : defaultLoading;

  const cart = useCart();
  const [mobileMenu, setMobileMenu] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const navigate = useNavigate();

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(price);

  const basePath = slug ? `/loja/${slug}` : "/loja";

  // Logo size from settings (default 32 = h-8)
  const logoSize = (settings as any)?.logo_size || 32;
  const logoSizeClass = `max-w-[${Math.max(80, logoSize * 4)}px]`;

  // Apply store colors as CSS vars
  useEffect(() => {
    if (settings) {
      const root = document.documentElement;
      root.style.setProperty("--store-primary", settings.primary_color || "#000000");
      root.style.setProperty("--store-accent", settings.accent_color || "#333333");
      return () => {
        root.style.removeProperty("--store-primary");
        root.style.removeProperty("--store-accent");
      };
    }
  }, [settings]);

  if (!isLoading && slug && !settings) {
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

  if (!isLoading && settings && !settings.store_open) {
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

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-white border-t-transparent" />
      </div>
    );
  }

  const storeName = settings?.store_name || "Loja";

  return (
    <LojaContext.Provider value={{ cart, settings, searchTerm, setSearchTerm, storeUserId: settings?.user_id }}>
      <div className="min-h-screen bg-white text-black">
        {/* Marquee ticker */}
        {(settings as any)?.marquee_enabled && (settings as any)?.marquee_text && (
          <StoreMarquee
            text={(settings as any).marquee_text}
            speed={(settings as any).marquee_speed}
            bgColor={(settings as any).marquee_bg_color}
            textColor={(settings as any).marquee_text_color}
          />
        )}

        {/* Top bar */}
        <div className="bg-black text-white text-xs py-1">
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
              {/* Customer login/profile */}
              {user && customer ? (
                <button onClick={() => setProfileModalOpen(true)} className="flex items-center gap-1 hover:text-gray-300">
                  <User className="h-3 w-3" /> {customer.name?.split(" ")[0] || "Conta"}
                </button>
              ) : (
                <button onClick={() => setAuthModalOpen(true)} className="flex items-center gap-1 hover:text-gray-300">
                  <User className="h-3 w-3" /> Entrar
                </button>
              )}
              {settings?.instagram_url && <a href={settings.instagram_url} target="_blank" rel="noopener noreferrer" className="hover:text-gray-300 hidden sm:inline">Instagram</a>}
              {settings?.facebook_url && <a href={settings.facebook_url} target="_blank" rel="noopener noreferrer" className="hover:text-gray-300 hidden sm:inline">Facebook</a>}
              {settings?.store_whatsapp && (
                <a href={`https://wa.me/${settings.store_whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-gray-300">
                  <MessageCircle className="h-3 w-3" /> WhatsApp
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Header */}
        <header className="sticky top-0 z-50 border-b border-gray-200 shadow-sm" style={{ backgroundColor: settings?.header_bg_color || '#ffffff' }}>
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileMenu(!mobileMenu)}>
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
                <span className="text-xl font-bold">{storeName}</span>
              )}
            </Link>

            <div className="flex-1 max-w-xl mx-auto hidden sm:block">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Buscar produtos..."
                  className="pl-9 bg-gray-50 border-gray-300 rounded-full"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && navigate(basePath)}
                />
              </div>
            </div>

            {/* Customer icon on header for mobile */}
            <Button variant="ghost" size="icon" className="sm:hidden" onClick={() => user && customer ? setProfileModalOpen(true) : setAuthModalOpen(true)}>
              <User className="h-5 w-5" />
            </Button>

            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                  <ShoppingCart className="h-5 w-5" />
                  {cart.count > 0 && (
                    <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs bg-black text-white">
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
                    <p className="text-center text-gray-500 py-8">Carrinho vazio</p>
                  ) : (
                    cart.items.map((item) => (
                      <div key={item.id} className="flex items-center gap-3 border-b border-gray-100 pb-3">
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.name} className="h-16 w-16 rounded object-cover" />
                        ) : (
                          <div className="h-16 w-16 rounded bg-gray-100" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.name}</p>
                          <p className="text-sm text-gray-500">{formatPrice(item.price)}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => cart.updateQuantity(item.id, item.quantity - 1)}>-</Button>
                            <span className="text-sm w-6 text-center">{item.quantity}</span>
                            <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => cart.updateQuantity(item.id, item.quantity + 1)}>+</Button>
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400" onClick={() => cart.removeItem(item.id)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
                {cart.items.length > 0 && (
                  <div className="mt-4 space-y-3 border-t border-gray-200 pt-4">
                    <div className="flex justify-between font-bold text-lg">
                      <span>Total</span>
                      <span>{formatPrice(cart.total)}</span>
                    </div>
                    <Button className="w-full bg-black text-white hover:bg-gray-800" onClick={() => navigate(`${basePath}/checkout`)}>
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
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar produtos..."
                className="pl-9 bg-gray-50 border-gray-300 rounded-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </header>

        {/* Mobile Menu */}
        <div
          className={`lg:hidden overflow-hidden transition-all duration-500 ease-out bg-white border-b border-gray-100 ${
            mobileMenu ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          <nav className="max-w-7xl mx-auto px-4 py-4 space-y-1">
            {[
              { icon: Home, label: "Início", to: basePath, delay: "0ms" },
              { icon: Package, label: "Produtos", to: basePath, delay: "80ms" },
              { icon: ShoppingCart, label: `Carrinho (${cart.count})`, to: `${basePath}/checkout`, delay: "160ms" },
              { icon: Truck, label: "Rastrear Pedido", to: `${basePath}/rastreio`, delay: "200ms" },
              ...(settings?.store_whatsapp ? [{ icon: MessageCircle, label: "WhatsApp", to: `https://wa.me/${settings.store_whatsapp.replace(/\D/g, "")}`, external: true, delay: "240ms" }] : []),
              ...(settings?.instagram_url ? [{ icon: Tag, label: "Instagram", to: settings.instagram_url, external: true, delay: "320ms" }] : []),
              ...(settings?.store_phone ? [{ icon: Phone, label: settings.store_phone, to: `tel:${settings.store_phone}`, external: true, delay: "400ms" }] : []),
              ...(settings?.store_address ? [{ icon: MapPin, label: settings.store_address, to: settings.google_maps_url || "#", external: true, delay: "480ms" }] : []),
            ].map((item: any, i) => (
              <div
                key={i}
                className="transition-all duration-500 ease-out"
                style={{
                  transitionDelay: mobileMenu ? item.delay : "0ms",
                  opacity: mobileMenu ? 1 : 0,
                  transform: mobileMenu ? "translateX(0)" : "translateX(-24px)",
                }}
              >
                {item.external ? (
                  <a
                    href={item.to}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-black transition-colors"
                    onClick={() => setMobileMenu(false)}
                  >
                    <item.icon className="h-5 w-5 text-gray-400" />
                    <span>{item.label}</span>
                  </a>
                ) : (
                  <Link
                    to={item.to}
                    className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-black transition-colors"
                    onClick={() => setMobileMenu(false)}
                  >
                    <item.icon className="h-5 w-5 text-gray-400" />
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
        <footer style={{ backgroundColor: settings?.footer_bg_color || '#000000', color: settings?.footer_text_color || '#ffffff' }} className="mt-12">
          <div className="max-w-7xl mx-auto px-4 py-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div>
                <h3 className="font-bold text-lg mb-3">{storeName}</h3>
                {settings?.store_description && <p className="text-gray-400 text-sm">{settings.store_description}</p>}
              </div>
              <div>
                <h3 className="font-bold mb-3">Contato</h3>
                <div className="space-y-2 text-sm text-gray-400">
                  {settings?.store_phone && <p>📞 {settings.store_phone}</p>}
                  {settings?.store_whatsapp && <p>💬 {settings.store_whatsapp}</p>}
                  {settings?.store_address && <p>📍 {settings.store_address}</p>}
                </div>
              </div>
              <div>
                <h3 className="font-bold mb-3">Redes Sociais</h3>
                <div className="flex gap-3">
                  {settings?.instagram_url && <a href={settings.instagram_url} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white text-sm">Instagram</a>}
                  {settings?.facebook_url && <a href={settings.facebook_url} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white text-sm">Facebook</a>}
                  {settings?.tiktok_url && <a href={settings.tiktok_url} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white text-sm">TikTok</a>}
                  {settings?.youtube_url && <a href={settings.youtube_url} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white text-sm">YouTube</a>}
                  {settings?.twitter_url && <a href={settings.twitter_url} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white text-sm">Twitter</a>}
                </div>
                {settings?.google_maps_url && (
                  <a href={settings.google_maps_url} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white text-sm mt-3 inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> Ver no Google Maps
                  </a>
                )}
              </div>
            </div>
            <Separator className="my-6 bg-gray-800" />
            <p className="text-center text-xs text-gray-500">© {new Date().getFullYear()} {storeName}. Todos os direitos reservados.</p>
          </div>
        </footer>

        {/* Floating WhatsApp Button */}
        {settings?.store_whatsapp && (
          <a
            href={`https://wa.me/${settings.store_whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent("Olá! Gostaria de mais informações.")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-green-500 text-white shadow-lg hover:bg-green-600 transition-all duration-300 hover:scale-110 animate-fade-in"
            title="Fale conosco pelo WhatsApp"
          >
            <MessageCircle className="h-7 w-7" />
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
