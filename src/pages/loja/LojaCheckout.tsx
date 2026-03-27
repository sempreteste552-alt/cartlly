import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useLojaContext } from "./LojaLayout";
import { supabase } from "@/integrations/supabase/client";
import { useValidateCoupon } from "@/hooks/useCoupons";
import { useCustomerAuth } from "@/hooks/useCustomerAuth";
import { useCreateReview } from "@/hooks/useProductReviews";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, MessageCircle, Ticket, X, Star, Share2, Receipt, CreditCard, QrCode, FileText, CalendarDays, Package, Heart, Download } from "lucide-react";
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
  const validateCoupon = useValidateCoupon();

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
      const duration = 2000;
      const end = Date.now() + duration;
      const frame = () => {
        confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0 } });
        confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1 } });
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

  const hasGateway = settings?.payment_gateway && (settings as any)?.gateway_secret_key;

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

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .insert({
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
      .select()
      .single();
    if (orderErr) throw orderErr;

    const items = cart.items.map((i) => ({
      order_id: order.id,
      product_id: i.id,
      product_name: i.name,
      product_image: i.image_url,
      quantity: i.quantity,
      unit_price: i.price,
    }));
    const { error: itemsErr } = await supabase.from("order_items").insert(items);
    if (itemsErr) throw itemsErr;

    await supabase.from("order_status_history").insert({ order_id: order.id, status: "pendente" });

    if (appliedCoupon) {
      await supabase
        .from("coupons")
        .update({ used_count: appliedCoupon.used_count + 1 } as any)
        .eq("id", appliedCoupon.id);
    }

    return order;
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
    const url = `${window.location.origin}/loja/produto/${item.id}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: item.name, text: `Confira: ${item.name}`, url });
      } catch {}
    } else {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado!");
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
        items: orderItems.map(i => ({ name: i.name, quantity: i.quantity, price: i.price, image_url: i.image_url })),
        subtotal: orderItems.reduce((acc, i) => acc + i.price * i.quantity, 0),
        discount: savedDiscountAmount,
        shipping: savedShippingCost,
        total: savedFinalTotal,
        paymentMethod: getMethodLabel(paymentMethod),
      });
    };

    return (
      <div className="max-w-lg mx-auto px-4 py-10 space-y-6">
        {/* Thank you header */}
        <div className="text-center space-y-3">
          <div className="mx-auto w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <Heart className="h-10 w-10 text-green-500 fill-green-500" />
          </div>
          <h1 className="text-2xl font-bold">Obrigado pela sua compra! 🎉</h1>
          <p className="text-muted-foreground">
            {name ? `${name}, s` : "S"}eu pedido foi realizado com sucesso.
          </p>
          {settings?.store_name && (
            <p className="text-sm text-muted-foreground">
              Loja <span className="font-semibold text-foreground">{settings.store_name}</span> agradece sua preferência! 💜
            </p>
          )}
        </div>

        {/* Receipt card */}
        <Card className="border-2 border-green-200 dark:border-green-800">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Receipt className="h-5 w-5 text-primary" />
                Recibo do Pedido
              </CardTitle>
              <Badge variant="outline" className="text-green-600 border-green-300 dark:border-green-700">
                <CheckCircle className="h-3 w-3 mr-1" /> Confirmado
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Order ID & Date */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="space-y-1">
                <p className="text-muted-foreground text-xs flex items-center gap-1">
                  <Package className="h-3 w-3" /> Pedido
                </p>
                <code className="font-mono font-bold text-foreground">#{orderId?.slice(0, 8)}</code>
              </div>
              <div className="space-y-1 text-right">
                <p className="text-muted-foreground text-xs flex items-center gap-1 justify-end">
                  <CalendarDays className="h-3 w-3" /> Data
                </p>
                <p className="font-medium text-foreground">{formattedDate}</p>
              </div>
            </div>

            <Separator />

            {/* Items */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Itens</p>
              {orderItems.map((item, idx) => (
                <div key={idx} className="flex items-center gap-3 text-sm">
                  {item.image_url && (
                    <img src={item.image_url} alt={item.name} className="h-10 w-10 rounded object-cover border" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{item.quantity}x {formatPrice(item.price)}</p>
                  </div>
                  <p className="font-semibold shrink-0">{formatPrice(item.price * item.quantity)}</p>
                </div>
              ))}
            </div>

            <Separator />

            {/* Totals */}
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatPrice(orderItems.reduce((acc, i) => acc + i.price * i.quantity, 0))}</span>
              </div>
              {savedDiscountAmount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span className="flex items-center gap-1"><Ticket className="h-3 w-3" /> Desconto</span>
                  <span>-{formatPrice(savedDiscountAmount)}</span>
                </div>
              )}
              {savedShippingCost > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Frete</span>
                  <span>{formatPrice(savedShippingCost)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between text-lg font-bold pt-1">
                <span>Total</span>
                <span className="text-green-600">{formatPrice(savedFinalTotal)}</span>
              </div>
            </div>

            <Separator />

            {/* Payment method */}
            <div className="flex items-center gap-3 bg-muted/50 rounded-lg p-3">
              {getMethodIcon(paymentMethod)}
              <div>
                <p className="text-xs text-muted-foreground">Forma de Pagamento</p>
                <p className="font-semibold text-sm">{getMethodLabel(paymentMethod)}</p>
              </div>
            </div>

            {/* Customer info */}
            {(name || email || phone) && (
              <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-sm">
                <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Dados do Cliente</p>
                {name && <p><span className="text-muted-foreground">Nome:</span> {name}</p>}
                {email && <p><span className="text-muted-foreground">E-mail:</span> {email}</p>}
                {phone && <p><span className="text-muted-foreground">Telefone:</span> {phone}</p>}
                {address && <p><span className="text-muted-foreground">Endereço:</span> {address}</p>}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <Button className="w-full" onClick={() => navigate("..")}>
            🏠 Voltar à Loja
          </Button>
          <Button variant="outline" className="w-full" onClick={handleDownloadReceipt}>
            <Download className="mr-2 h-4 w-4" /> Baixar Recibo em PDF
          </Button>
          {orderId && (
            <Button variant="outline" className="w-full" onClick={() => navigate(`../rastreio/${orderId}`)}>
              <Package className="mr-2 h-4 w-4" /> Rastrear Pedido
            </Button>
          )}
        </div>

        {/* Review prompt */}
        {orderItems.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Star className="h-5 w-5 text-yellow-500" />
                Avalie seus produtos
              </CardTitle>
              <p className="text-sm text-muted-foreground">Sua opinião nos ajuda a melhorar!</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {orderItems.map((item) => (
                <div key={item.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {item.image_url && <img src={item.image_url} alt={item.name} className="h-12 w-12 rounded object-cover" />}
                      <p className="font-medium text-sm">{item.name}</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => handleShareProduct(item)} title="Compartilhar">
                      <Share2 className="h-4 w-4" />
                    </Button>
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
            </CardContent>
          </Card>
        )}
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
          onSuccess={(method) => {
            setSavedFinalTotal(finalTotal);
            setSavedDiscountAmount(discountAmount);
            setSavedShippingCost(shippingCost);
            setOrderItems([...cart.items]);
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
        <Button className="mt-4" variant="outline" onClick={() => navigate("/loja")}>Ver Produtos</Button>
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
        <div className="flex items-center justify-center gap-4 flex-wrap py-3">
          <img src={siteSeguro} alt="Site Seguro" className="h-14 w-auto" />
          <img src={compraSegura} alt="Compra Segura" className="h-14 w-auto" />
        </div>
        <div className="flex items-center justify-center gap-4 py-2">
          <img src={paymentCards} alt="Bandeiras aceitas" className="h-12 w-auto" />
          <img src={pixLogo} alt="PIX" className="h-12 w-auto" />
        </div>

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
