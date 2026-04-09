import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useLojaContext } from "./LojaLayout";
import { supabase } from "@/integrations/supabase/client";
import { useValidateCoupon } from "@/hooks/useCoupons";
import { useCustomerAuth } from "@/hooks/useCustomerAuth";
import { useCreateReview } from "@/hooks/useProductReviews";
import { usePublicMarketingConfig } from "@/hooks/usePublicStoreConfig";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, MessageCircle, Ticket, X, Star, Share2, Receipt, CreditCard, QrCode, FileText, CalendarDays, Package, Heart, Download, Instagram } from "lucide-react";
import { toast } from "sonner";
import PaymentStep from "@/components/PaymentStep";
import ShippingCalculator from "@/components/ShippingCalculator";
import { CustomerAuthModal } from "@/components/CustomerAuthModal";
import { generateReceiptPdf } from "@/lib/generateReceiptPdf";
import confetti from "canvas-confetti";
import siteSeguro from "@/assets/site-seguro.webp";
import compraSegura from "@/assets/compra-segura.webp";
import paymentCards from "@/assets/payment-cards.webp";
import pixLogo from "@/assets/pix-logo.webp";

type CheckoutPhase = "info" | "payment" | "success";

export default function LojaCheckout() {
  const { cart, settings } = useLojaContext();
  const navigate = useNavigate();
  const { user, customer, loading: authLoading } = useCustomerAuth();
  const createReview = useCreateReview();
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<CheckoutPhase>("info");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null);
  const [paymentDate, setPaymentDate] = useState<Date | null>(null);
  const [savedFinalTotal, setSavedFinalTotal] = useState<number>(0);
  const [savedDiscountAmount, setSavedDiscountAmount] = useState<number>(0);
  const [savedShippingCost, setSavedShippingCost] = useState<number>(0);
  const [savedPayerCpf, setSavedPayerCpf] = useState<string | null>(null);
  const validateCoupon = useValidateCoupon();
  const { data: marketingConfig } = usePublicMarketingConfig(settings?.user_id);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");

  // Review state
  const [reviewRatings, setReviewRatings] = useState<Record<string, number>>({});
  const [reviewComments, setReviewComments] = useState<Record<string, string>>({});
  const [reviewsSubmitted, setReviewsSubmitted] = useState<Set<string>>(new Set());

  // Confetti on success
  useEffect(() => {
    if (phase === "success") {
      const duration = 3000;
      const end = Date.now() + duration;
      const frame = () => {
        confetti({ 
          particleCount: 5, 
          angle: 60, 
          spread: 70, 
          origin: { x: 0, y: 0.6 },
          colors: ["#6d28d9", "#3b82f6", "#10b981", "#f59e0b", "#ef4444"]
        });
        confetti({ 
          particleCount: 5, 
          angle: 120, 
          spread: 70, 
          origin: { x: 1, y: 0.6 },
          colors: ["#6d28d9", "#3b82f6", "#10b981", "#f59e0b", "#ef4444"]
        });
        if (Date.now() < end) requestAnimationFrame(frame);
      };
      frame();
    }
  }, [phase]);

  useEffect(() => {
    if (customer) {
      setName(customer.name || "");
      setEmail(customer.email || "");
      setPhone(customer.phone || "");
      const fullAddress = [customer.address, customer.city, customer.state, customer.cep].filter(Boolean).join(", ");
      if (fullAddress) setAddress(fullAddress);
    }
  }, [customer]);

  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [selectedShipping, setSelectedShipping] = useState<{ method: string; price: number; days: string } | null>(null);

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(price);

  const discountAmount = appliedCoupon
    ? appliedCoupon.discount_type === "percentage"
      ? (cart.total * appliedCoupon.discount_value) / 100
      : Math.min(appliedCoupon.discount_value, cart.total)
    : 0;

  const shippingCost = selectedShipping?.price || 0;
  const finalTotal = Math.max(0, cart.total - discountAmount + shippingCost);

  const hasGateway = settings?.payment_gateway && settings?.gateway_public_key;

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    if (!settings?.user_id) return toast.error("Loja não configurada");
    setCouponLoading(true);
    try {
      const coupon = await validateCoupon.mutateAsync({ code: couponCode, storeUserId: settings.user_id });
      if (coupon.min_order_value && cart.total < coupon.min_order_value) {
        toast.error(`Pedido mínimo de ${formatPrice(coupon.min_order_value)} para este cupom`);
        return;
      }
      setAppliedCoupon(coupon);
      toast.success("Cupom aplicado!");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCouponLoading(false);
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode("");
  };

  const createOrder = async () => {
    const userId = settings?.user_id;
    if (!userId) throw new Error("Loja não configurada");

    const orderId = globalThis.crypto?.randomUUID?.() ?? "00000000-0000-4000-8000-000000000000";

    const { error: orderErr } = await supabase
      .from("orders")
      .insert({
        id: orderId,
        user_id: userId,
        customer_name: name.trim(),
        customer_email: email.trim() || null,
        customer_phone: phone.trim(),
        customer_address: address.trim() || null,
        notes: notes.trim() || null,
        total: finalTotal,
        shipping_cost: shippingCost,
        shipping_method: selectedShipping?.method || null,
        shipping_cep: null,
        whatsapp_order: false,
        status: "pendente",
        coupon_code: appliedCoupon?.code || null,
        discount_amount: discountAmount,
      } as any)
    if (orderErr) throw orderErr;

    const items = cart.items.map((i) => ({
      order_id: orderId,
      product_id: i.id,
      product_name: i.name,
      product_image: i.image_url,
      quantity: i.quantity,
      unit_price: i.price,
    }));
    const { error: itemsErr } = await supabase.from("order_items").insert(items);
    if (itemsErr) throw itemsErr;

    const { error: historyErr } = await supabase.from("order_status_history").insert({ order_id: orderId, status: "pendente" });
    if (historyErr) throw historyErr;

    if (appliedCoupon && settings?.user_id) {
      await (supabase as any).rpc("increment_coupon_usage", {
        _coupon_code: appliedCoupon.code,
        _store_user_id: settings.user_id,
      });
    }

    return { id: orderId };
  };

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [pendingPayment, setPendingPayment] = useState(false);

  // Auto-proceed after login: when user becomes authenticated while pending
  useEffect(() => {
    if (pendingPayment && user && !authLoading) {
      setPendingPayment(false);
      setAuthModalOpen(false);
      // Small delay to let state settle
      setTimeout(() => handleSubmit(false), 300);
    }
  }, [user, authLoading, pendingPayment]);

  const handleSubmit = async (viaWhatsApp = false) => {
    if (!name.trim()) return toast.error("Informe seu nome");
    if (!phone.trim()) return toast.error("Informe seu telefone");
    if (cart.items.length === 0) return toast.error("Carrinho vazio");

    // Require customer login before payment (not for WhatsApp)
    if (!viaWhatsApp && authLoading) {
      toast.info("Aguarde, estamos confirmando seu login...");
      return;
    }

    if (!viaWhatsApp && !user) {
      setPendingPayment(true);
      toast.info("🔐 Faça login ou crie uma conta para prosseguir com o pagamento");
      setAuthModalOpen(true);
      return;
    }

    // Block if no gateway and not WhatsApp
    if (!viaWhatsApp && !hasGateway) {
      toast.error("🔧 Pagamento em manutenção. Envie seu pedido pelo WhatsApp!");
      return;
    }

    // Save items before clearing cart
    const savedItems = [...cart.items];

    setLoading(true);
    try {
      const order = await createOrder();
      setOrderId(order.id);
      setOrderItems(savedItems);

      if (viaWhatsApp && settings?.store_whatsapp) {
        const msg = cart.items.map((i) => `${i.quantity}x ${i.name} - ${formatPrice(i.price * i.quantity)}`).join("\n");
        const couponLine = appliedCoupon ? `\n🎟️ *Cupom:* ${appliedCoupon.code} (-${formatPrice(discountAmount)})` : "";
        const text = `🛒 *Novo Pedido #${order.id.slice(0, 8)}*\n\n*Cliente:* ${name}\n*Telefone:* ${phone}\n${address ? `*Endereço:* ${address}\n` : ""}${notes ? `*Obs:* ${notes}\n` : ""}\n*Itens:*\n${msg}${couponLine}\n\n*Total: ${formatPrice(finalTotal)}*`;
        window.open(`https://wa.me/${settings.store_whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`, "_blank");
        setSavedFinalTotal(finalTotal);
        setSavedDiscountAmount(discountAmount);
        setSavedShippingCost(shippingCost);
        cart.clearCart();
        setPaymentMethod("whatsapp");
        setPaymentDate(new Date());
        setPhase("success");
      } else if (hasGateway) {
        setPhase("payment");
      } else {
        setSavedFinalTotal(finalTotal);
        setSavedDiscountAmount(discountAmount);
        setSavedShippingCost(shippingCost);
        cart.clearCart();
        setPaymentMethod("whatsapp");
        setPaymentDate(new Date());
        setPhase("success");
      }
    } catch (err: any) {
      toast.error("Erro ao criar pedido: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitReview = async (productId: string) => {
    const rating = reviewRatings[productId];
    if (!rating) return toast.error("Selecione uma nota");
    try {
      await createReview.mutateAsync({
        product_id: productId,
        customer_name: name || "Cliente",
        customer_email: email || undefined,
        rating,
        comment: reviewComments[productId] || undefined,
      });
      setReviewsSubmitted((prev) => new Set(prev).add(productId));
      toast.success("Avaliação enviada! Obrigado!");
    } catch {
      toast.error("Erro ao enviar avaliação");
    }
  };

  const handleShareProduct = async (item: any) => {
    const url = `${window.location.origin}/loja/${settings?.store_slug || "loja"}/produto/${item.id}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: item.name, text: `Confira este produto na ${settings?.store_name}: ${item.name}`, url });
      } catch {}
    } else {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado!");
    }
  };

  const handleShareInstagram = async (item: any) => {
    const url = `${window.location.origin}/loja/${settings?.store_slug || "loja"}/produto/${item.id}`;
    const caption = `Acabei de comprar este ${item.name} na ${settings?.store_name}! 😍✨\n\nConfira aqui: ${url}`;
    
    try {
      await navigator.clipboard.writeText(caption);
      toast.success("Legenda educada copiada! Agora você pode colar no seu Instagram 📸", {
        description: "A legenda foi copiada para sua área de transferência.",
        duration: 5000,
      });
      
      // If store has Instagram, try to open it
      if (settings?.instagram_url) {
        setTimeout(() => {
          window.open(settings.instagram_url, "_blank");
        }, 1500);
      }
    } catch {
      toast.error("Erro ao copiar legenda");
    }
  };

  const getMethodLabel = (m: string | null) => {
    switch (m) {
      case "pix": return "PIX";
      case "credit_card": return "Cartão de Crédito";
      case "boleto": return "Boleto Bancário";
      case "whatsapp": return "WhatsApp";
      default: return "Pagamento Online";
    }
  };

  const getMethodIcon = (m: string | null) => {
    switch (m) {
      case "pix": return <QrCode className="h-5 w-5" />;
      case "credit_card": return <CreditCard className="h-5 w-5" />;
      case "boleto": return <FileText className="h-5 w-5" />;
      case "whatsapp": return <MessageCircle className="h-5 w-5 text-green-500" />;
      default: return <Receipt className="h-5 w-5" />;
    }
  };

  if (phase === "success") {
    const receiptDate = paymentDate || new Date();
    const formattedDate = new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    }).format(receiptDate);

    const handleDownloadReceipt = () => {
      generateReceiptPdf({
        orderId: orderId || "",
        date: formattedDate,
        storeName: settings?.store_name || "Loja",
        customerName: name,
        customerEmail: email,
        customerPhone: phone,
        customerAddress: address,
        customerCpf: savedPayerCpf || undefined,
        items: orderItems.map(i => ({ name: i.name, quantity: i.quantity, price: i.price, image_url: i.image_url })),
        subtotal: orderItems.reduce((acc, i) => acc + i.price * i.quantity, 0),
        discount: savedDiscountAmount,
        shipping: savedShippingCost,
        total: savedFinalTotal,
        paymentMethod: getMethodLabel(paymentMethod),
      });
    };

    return (
      <div className="max-w-lg mx-auto px-4 py-10 space-y-8 animate-in fade-in duration-700">
        {/* Success Header */}
        <div className="text-center space-y-4">
          <div className="mx-auto w-20 h-20 rounded-full bg-green-50 dark:bg-green-900/20 flex items-center justify-center border-4 border-white dark:border-gray-900 shadow-sm">
            <CheckCircle className="h-10 w-10 text-green-500" />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">Pagamento Realizado!</h1>
            <p className="text-muted-foreground text-sm">
              Seu pedido em <span className="font-semibold text-foreground">{settings?.store_name}</span> foi confirmado.
            </p>
          </div>
        </div>

        {/* Review prompt - MOVED TO THE BEGINNING */}
        {orderItems.length > 0 && (
          <Card className="border-primary/20 shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Star className="h-5 w-5 text-yellow-500" />
                Avalie seus produtos agora
              </CardTitle>
              <p className="text-sm text-muted-foreground">Sua opinião nos ajuda muito!</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {orderItems.map((item) => (
                <div key={item.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {item.image_url && <img src={item.image_url} alt={item.name} className="h-12 w-12 rounded object-cover" />}
                      <p className="font-medium text-sm line-clamp-1">{item.name}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleShareProduct(item)} title="Compartilhar">
                        <Share2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleShareInstagram(item)} title="Postar no Instagram" className="text-pink-600 hover:text-pink-700 hover:bg-pink-50">
                        <Instagram className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {reviewsSubmitted.has(item.id) ? (
                    <p className="text-sm text-green-600 flex items-center gap-1"><CheckCircle className="h-4 w-4" /> Avaliação enviada!</p>
                  ) : (
                    <>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            onClick={() => setReviewRatings((prev) => ({ ...prev, [item.id]: star }))}
                            className="transition-transform hover:scale-110"
                          >
                            <Star
                              className={`h-6 w-6 ${
                                (reviewRatings[item.id] || 0) >= star
                                  ? "fill-yellow-400 text-yellow-400"
                                  : "text-gray-300"
                              }`}
                            />
                          </button>
                        ))}
                      </div>
                      <Textarea
                        placeholder="Deixe um comentário (opcional)"
                        value={reviewComments[item.id] || ""}
                        onChange={(e) => setReviewComments((prev) => ({ ...prev, [item.id]: e.target.value }))}
                        className="text-sm"
                        rows={2}
                      />
                      <Button
                        size="sm"
                        className="w-full"
                        onClick={() => handleSubmitReview(item.id)}
                        disabled={!reviewRatings[item.id] || createReview.isPending}
                      >
                        {createReview.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                        Enviar Avaliação
                      </Button>
                    </>
                  )}
                </div>
              ))}

              {settings?.instagram_url && (
                <Button 
                  variant="outline" 
                  className="w-full border-pink-200 text-pink-600 hover:bg-pink-50 hover:border-pink-300 gap-2"
                  onClick={() => window.open(settings.instagram_url, "_blank")}
                >
                  <Instagram className="h-4 w-4" /> Siga a {settings?.store_name} no Instagram
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Bank-Style Receipt Slip */}
        <div className="relative bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 shadow-xl rounded-2xl overflow-hidden overflow-visible">
          {/* Decorative "cut" edge at top and bottom (optional, but sleek) */}
          <div className="absolute -top-2 left-0 right-0 h-4 bg-[radial-gradient(circle,transparent_8px,#fff_8px)] dark:bg-[radial-gradient(circle,transparent_8px,#09090b_8px)] bg-[length:24px_24px] bg-repeat-x z-10 opacity-50" />
          
          <div className="p-8 pt-10 space-y-8">
            {/* Main Value - Bank Style */}
            <div className="text-center space-y-1 pb-6 border-b border-dashed border-zinc-200 dark:border-zinc-800">
              <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-zinc-400">Valor Total</p>
              <h2 className="text-4xl font-extrabold text-zinc-900 dark:text-zinc-100 tracking-tighter">
                {formatPrice(savedFinalTotal)}
              </h2>
              <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-100 dark:bg-green-950 dark:text-green-400 dark:border-green-900 mt-2">
                Operação Finalizada
              </Badge>
            </div>

            {/* Receipt Details Grid */}
            <div className="space-y-6 text-sm">
              <div className="grid grid-cols-2 gap-y-4">
                <div className="space-y-1">
                  <p className="text-[10px] uppercase font-bold text-zinc-400">Data e Hora</p>
                  <p className="font-medium">{formattedDate}</p>
                </div>
                <div className="space-y-1 text-right">
                  <p className="text-[10px] uppercase font-bold text-zinc-400">ID da Transação</p>
                  <p className="font-mono font-medium text-xs break-all">#{orderId?.slice(0, 18).toUpperCase()}</p>
                </div>
                
                <div className="space-y-1">
                  <p className="text-[10px] uppercase font-bold text-zinc-400">Destinatário</p>
                  <p className="font-semibold">{settings?.store_name || "Loja Virtual"}</p>
                  <p className="text-xs text-zinc-500">Pagamento de Pedido</p>
                </div>
                <div className="space-y-1 text-right">
                  <p className="text-[10px] uppercase font-bold text-zinc-400">Pagador</p>
                  <p className="font-semibold">{name || "Cliente"}</p>
                  <p className="text-xs text-zinc-500">
                    {savedPayerCpf ? `CPF: ***.***.${savedPayerCpf.replace(/\D/g, "").slice(7, 9)}-${savedPayerCpf.replace(/\D/g, "").slice(9)}` : email || "—"}
                  </p>
                </div>
              </div>

              <div className="pt-6 border-t border-zinc-100 dark:border-zinc-900 space-y-4">
                <p className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Detalhamento</p>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                    <span>Subtotal</span>
                    <span>{formatPrice(orderItems.reduce((acc, i) => acc + i.price * i.quantity, 0))}</span>
                  </div>
                  
                  {savedDiscountAmount > 0 && (
                    <div className="flex justify-between text-green-600 font-medium">
                      <span className="flex items-center gap-1">Desconto Aplicado</span>
                      <span>-{formatPrice(savedDiscountAmount)}</span>
                    </div>
                  )}
                  
                  {savedShippingCost > 0 && (
                    <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                      <span>Frete e Manuseio</span>
                      <span>{formatPrice(savedShippingCost)}</span>
                    </div>
                  )}
                </div>

                <div className="bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-xl space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-white dark:bg-zinc-800 flex items-center justify-center shadow-sm border border-zinc-100 dark:border-zinc-700">
                      {getMethodIcon(paymentMethod)}
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-zinc-400">Meio de Pagamento</p>
                      <p className="font-semibold text-xs">{getMethodLabel(paymentMethod)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-center pt-8 border-t border-dashed border-zinc-100 dark:border-zinc-900 space-y-2">
              <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold">
                Autenticação Eletrônica
              </p>
              <p className="font-mono text-[8px] text-zinc-400 break-all px-4">
                {(orderId?.replace(/-/g, "").toUpperCase() + "BANKTRANS" + Date.now().toString(36).toUpperCase()).slice(0, 32)}
              </p>
              <p className="text-[9px] text-zinc-400 uppercase tracking-widest pt-2 opacity-50">
                Comprovante gerado eletronicamente
              </p>
            </div>
          </div>
          
          <div className="absolute -bottom-2 left-0 right-0 h-4 bg-[radial-gradient(circle,transparent_8px,#fff_8px)] dark:bg-[radial-gradient(circle,transparent_8px,#09090b_8px)] bg-[length:24px_24px] bg-repeat-x z-10 opacity-50 transform rotate-180" />
        </div>

        {/* Main Actions */}
        <div className="grid grid-cols-1 gap-3 sm:px-4">
          <Button 
            className="w-full h-12 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:opacity-90 transition-opacity font-bold rounded-xl"
            onClick={handleDownloadReceipt}
          >
            <Download className="mr-2 h-4 w-4" /> Baixar Comprovante PDF
          </Button>
          
          <div className="grid grid-cols-2 gap-3">
            <Button 
              variant="outline" 
              className="h-11 rounded-xl border-zinc-200 dark:border-zinc-800"
              onClick={() => navigate(`../rastreio/${orderId}`)}
            >
              <Package className="mr-2 h-4 w-4" /> Ver Pedido
            </Button>
            <Button 
              variant="ghost" 
              className="h-11 rounded-xl"
              onClick={() => navigate("..")}
            >
              🏠 Voltar à Loja
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "payment" && orderId) {
    return (
      <div className="max-w-lg mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Pagamento</h1>
        <PaymentStep
          orderId={orderId}
          storeUserId={settings?.user_id}
          total={finalTotal}
          settings={settings}
          onSuccess={(method, cpf) => {
            setSavedFinalTotal(finalTotal);
            setSavedDiscountAmount(discountAmount);
            setSavedShippingCost(shippingCost);
            setSavedPayerCpf(cpf || null);
            // We don't overwrite orderItems here as it was already set in handleSubmit
            // This prevents race conditions with cart.clearCart()
            setPaymentMethod(method || "gateway");
            setPaymentDate(new Date());
            cart.clearCart();
            setPhase("success");
          }}
        />
      </div>
    );
  }

  if (cart.items.length === 0) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <h1 className="text-xl font-bold">Carrinho vazio</h1>
        <Button className="mt-4" variant="outline" onClick={() => navigate(`/loja/${settings?.store_slug || ""}`)}>Ver Produtos</Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Finalizar Compra</h1>

      <div className="grid gap-6">
        {/* Items summary */}
        <Card>
          <CardHeader><CardTitle className="text-base">Resumo do Pedido</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {cart.items.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <span>{item.quantity}x {item.name}</span>
                <span className="font-medium">{formatPrice(item.price * item.quantity)}</span>
              </div>
            ))}
            <Separator />
            <div className="flex justify-between text-sm">
              <span>Subtotal</span>
              <span>{formatPrice(cart.total)}</span>
            </div>
            {appliedCoupon && (
              <div className="flex justify-between text-sm text-green-600">
                <span className="flex items-center gap-1">
                  <Ticket className="h-3.5 w-3.5" />
                  Cupom {appliedCoupon.code}
                  <button onClick={removeCoupon} className="text-gray-400 hover:text-destructive"><X className="h-3 w-3" /></button>
                </span>
                <span>-{formatPrice(discountAmount)}</span>
              </div>
            )}
            {shippingCost > 0 && (
              <div className="flex justify-between text-sm">
                <span>Frete ({selectedShipping?.method})</span>
                <span>{formatPrice(shippingCost)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg">
              <span>Total</span>
              <span>{formatPrice(finalTotal)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Shipping Calculator */}
        <Card>
          <CardContent className="p-4">
            <ShippingCalculator
              settings={settings}
              subtotal={cart.total}
              onSelectShipping={setSelectedShipping}
              selectedShipping={selectedShipping}
              storeUserId={settings?.user_id}
            />
          </CardContent>
        </Card>

        {/* Coupon */}
        <Card>
          <CardContent className="p-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Ticket className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Código do cupom"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  className="pl-9 font-mono"
                  disabled={!!appliedCoupon}
                />
              </div>
              {appliedCoupon ? (
                <Button variant="outline" onClick={removeCoupon}><X className="h-4 w-4" /></Button>
              ) : (
                <Button variant="outline" onClick={handleApplyCoupon} disabled={couponLoading || !couponCode.trim()}>
                  {couponLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Aplicar"}
                </Button>
              )}
            </div>
            {appliedCoupon && (
              <Badge className="mt-2 bg-green-100 text-green-800">
                {appliedCoupon.discount_type === "percentage" ? `${appliedCoupon.discount_value}% de desconto` : `${formatPrice(appliedCoupon.discount_value)} de desconto`}
              </Badge>
            )}
          </CardContent>
        </Card>

        {/* Customer info */}
        <Card>
          <CardHeader><CardTitle className="text-base">Seus Dados</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome completo" maxLength={100} />
              </div>
              <div className="space-y-2">
                <Label>Telefone *</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-9999" maxLength={20} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" maxLength={255} />
            </div>
            <div className="space-y-2">
              <Label>Endereço de Entrega</Label>
              <Textarea value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Rua, número, bairro, cidade, CEP" maxLength={500} />
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Alguma observação sobre o pedido?" maxLength={500} />
            </div>
          </CardContent>
        </Card>

        {/* Trust badges */}
        {marketingConfig?.trust_badges_enabled && (
          <>
            <div className="flex items-center justify-center gap-4 flex-wrap py-3">
              <img src={siteSeguro} alt="Site Seguro" className="h-14 w-auto" />
              <img src={compraSegura} alt="Compra Segura" className="h-14 w-auto" />
            </div>
            <div className="flex items-center justify-center gap-4 py-2">
              <img src={paymentCards} alt="Bandeiras aceitas" className="h-12 w-auto" />
              <img src={pixLogo} alt="PIX" className="h-12 w-auto" />
            </div>
          </>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-3">
          {hasGateway ? (
            <Button className="w-full bg-black text-white hover:bg-gray-800 h-12 text-base" onClick={() => handleSubmit(false)} disabled={loading || authLoading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Ir para Pagamento
            </Button>
          ) : settings?.sell_via_whatsapp && settings?.store_whatsapp ? (
            <>
              <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4 text-center space-y-2">
                <p className="text-4xl">🚧</p>
                <p className="text-sm font-medium text-yellow-800">Pagamento online em manutenção</p>
                <p className="text-xs text-yellow-700">Finalize seu pedido pelo WhatsApp</p>
              </div>
              <Button
                className="w-full bg-green-600 text-white hover:bg-green-700 h-12 text-base"
                onClick={() => handleSubmit(true)}
                disabled={loading}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <MessageCircle className="mr-2 h-5 w-5" /> Finalizar via WhatsApp
              </Button>
            </>
          ) : (
            <div className="bg-red-50 border border-red-300 rounded-lg p-4 text-center space-y-2">
              <p className="text-4xl">🚧</p>
              <p className="text-sm font-medium text-red-800">Checkout indisponível</p>
              <p className="text-xs text-red-700">A loja ainda não configurou um meio de pagamento.</p>
            </div>
          )}
          {hasGateway && settings?.sell_via_whatsapp && settings?.store_whatsapp && (
            <Button
              variant="outline"
              className="w-full border-green-500 text-green-600 hover:bg-green-50 h-12 text-base"
              onClick={() => handleSubmit(true)}
              disabled={loading}
            >
              <MessageCircle className="mr-2 h-5 w-5" /> Finalizar via WhatsApp
            </Button>
          )}
        </div>
      </div>

      {/* Auth modal for checkout gate */}
      {settings?.user_id && (
        <CustomerAuthModal
          open={authModalOpen}
          onOpenChange={setAuthModalOpen}
          storeUserId={settings.user_id}
        />
      )}
    </div>
  );
}
