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
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, CheckCircle, MessageCircle, Ticket, X, Star, Share2, Receipt, CreditCard, QrCode, FileText, CalendarDays, Package, Heart, Download, Instagram, Search, Save, Printer, User, Box, Truck as TruckIcon, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import PaymentStep from "@/components/PaymentStep";
import ShippingCalculator from "@/components/ShippingCalculator";
import { CustomerAuthModal } from "@/components/CustomerAuthModal";
import { generateReceiptPdf } from "@/lib/generateReceiptPdf";
import confetti from "canvas-confetti";
// paymentMethodsImg removed
import securityBadgesImg from "@/assets/security-badges.png";
import { validateCPF, formatCPF, formatCEP } from "@/lib/validations";
import { useTranslation } from "@/i18n";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type CheckoutPhase = "info" | "payment" | "success";

export default function LojaCheckout() {
  const { cart, settings } = useLojaContext();
  const { t } = useTranslation();
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
  const [errors, setErrors] = useState<Set<string>>(new Set());
  const { globalCep } = useLojaContext();

  const validateCoupon = useValidateCoupon();
  const { data: marketingConfig } = usePublicMarketingConfig(settings?.user_id);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [cpf, setCpf] = useState("");
  const [cep, setCep] = useState("");
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [complement, setComplement] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [saveData, setSaveData] = useState(true);
  const [cepLoading, setCepLoading] = useState(false);

  useEffect(() => {
    if (globalCep && !cep) {
      const formatted = formatCEP(globalCep);
      setCep(formatted);
      const clean = globalCep.replace(/\D/g, "");
      if (clean.length === 8) {
        (async () => {
          setCepLoading(true);
          try {
            const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
            const data = await res.json();
            if (data && !data.erro) {
              if (data.logradouro) setStreet(data.logradouro);
              if (data.bairro) setNeighborhood(data.bairro);
              if (data.localidade) setCity(data.localidade);
              if (data.uf) setState(data.uf);
            }
          } catch { /* ignore */ }
          setCepLoading(false);
        })();
      }
    }
  }, [globalCep]);

  const handleCepBlur = async () => {
    const cleanCep = cep.replace(/\D/g, "");
    if (cleanCep.length === 8) {
      setCepLoading(true);
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        const data = await response.json();
        if (data.erro) {
          toast.error("CEP não encontrado");
        } else {
          setStreet(data.logradouro);
          setNeighborhood(data.bairro);
          setCity(data.localidade);
          setState(data.uf);
          toast.success("Endereço preenchido automaticamente");
        }
      } catch (error) {
        toast.error("Erro ao buscar CEP");
      } finally {
        setCepLoading(false);
      }
    }
  };

  useEffect(() => {
    const fullAddress = [street, number, neighborhood, city, state, cep].filter(Boolean).join(", ");
    setAddress(fullAddress);
  }, [street, number, neighborhood, city, state, cep]);

  // Review state
  const [reviewRatings, setReviewRatings] = useState<Record<string, number>>({});
  const [reviewComments, setReviewComments] = useState<Record<string, string>>({});
  const [reviewsSubmitted, setReviewsSubmitted] = useState<Set<string>>(new Set());

  // Scroll para o topo ao mudar de etapa (essencial em mobile)
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [phase]);

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
      setCpf(customer.cpf || "");
      setCep(customer.cep || "");
      setCity(customer.city || "");
      setState(customer.state || "");
      if (customer.address) {
        const parts = customer.address.split(", ");
        if (parts.length >= 3) {
          setStreet(parts[0]);
          setNumber(parts[1]);
          setNeighborhood(parts[2]);
        } else {
          setStreet(customer.address);
        }
      }
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

    const referralCode = localStorage.getItem(`store_referral_${userId}`);
    const { error: orderErr } = await supabase
      .from("orders")
      .insert({
        id: orderId,
        user_id: userId,
        customer_name: name.trim(),
        customer_email: email.trim() || null,
        customer_phone: phone.trim(),
        customer_cpf: cpf.replace(/\D/g, ""),
        customer_address: address.trim() || null,
        shipping_street: street.trim(),
        shipping_number: number.trim(),
        shipping_neighborhood: neighborhood.trim(),
        shipping_city: city.trim(),
        shipping_state: state.trim(),
        shipping_complement: complement.trim() || null,
        shipping_cep: cep.replace(/\D/g, ""),
        notes: notes.trim() || null,
        total: finalTotal,
        shipping_cost: shippingCost,
        shipping_method: selectedShipping?.method || null,
        whatsapp_order: false,
        status: "pendente",
        coupon_code: appliedCoupon?.code || null,
        discount_amount: discountAmount,
        referral_code: referralCode || null,
      } as any)
    if (orderErr) throw orderErr;

    const isUUID = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const cartItemIds = cart.items.map(i => i.id).filter(id => id && isUUID(id));

    let validIds = new Set<string>();
    if (cartItemIds.length > 0) {
      const { data: validProducts, error: validErr } = await supabase
        .from("products")
        .select("id")
        .in("id", cartItemIds);
      
      if (!validErr && validProducts) {
        validProducts.forEach(p => validIds.add(p.id.toLowerCase()));
      }
    }

    const items = cart.items.map((i) => {
      const idLower = i.id?.toLowerCase();
      return {
        order_id: orderId,
        product_id: (isUUID(i.id) && validIds.has(idLower)) ? i.id : null,
        product_name: i.name,
        product_image: i.image_url,
        quantity: i.quantity,
        unit_price: i.price,
      };
    });

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

  useEffect(() => {
    if (pendingPayment && user && !authLoading) {
      setPendingPayment(false);
      setAuthModalOpen(false);
      setTimeout(() => handleSubmit(false), 300);
    }
  }, [user, authLoading, pendingPayment]);

  const handleSubmit = async (viaWhatsApp = false) => {
    const newErrors = new Set<string>();
    if (!name.trim()) newErrors.add("name");
    if (!phone.trim()) newErrors.add("phone");
    if (!cpf.trim() || !validateCPF(cpf)) newErrors.add("cpf");
    if (!cep.trim() || cep.replace(/\D/g, "").length !== 8) newErrors.add("cep");
    if (!street.trim()) newErrors.add("street");
    if (!number.trim()) newErrors.add("number");
    if (!neighborhood.trim()) newErrors.add("neighborhood");
    if (!city.trim()) newErrors.add("city");
    if (!state.trim()) newErrors.add("state");

    setErrors(newErrors);

    if (newErrors.size > 0) {
      toast.error("Por favor, preencha corretamente todos os campos destacados em vermelho.");
      const firstError = document.querySelector(".border-destructive");
      if (firstError) firstError.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    if (cart.items.length === 0) return toast.error("Seu carrinho está vazio");

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

    if (!viaWhatsApp && !hasGateway) {
      toast.error("🔧 Pagamento em manutenção. Envie seu pedido pelo WhatsApp!");
      return;
    }

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
      } else {
        setPhase("payment");
      }
    } catch (err: any) {
      toast.error("Erro ao criar pedido: " + err.message);
    } finally {
      if (saveData && user && customer) {
        await supabase
          .from("customers")
          .update({
            name: name.trim(),
            phone: phone.trim(),
            cpf: cpf.replace(/\D/g, ""),
            cep: cep.replace(/\D/g, ""),
            city: city.trim(),
            state: state.trim(),
            address: address.trim(),
          })
          .eq("id", customer.id);
      }
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

  const handleDownloadReceipt = () => {
    if (!orderId) return;
    const formattedDate = paymentDate ? format(paymentDate, "dd/MM/yyyy HH:mm", { locale: ptBR }) : "";
    generateReceiptPdf({
      orderId,
      date: formattedDate,
      storeName: settings?.store_name || "Loja",
      customerName: name,
      items: orderItems,
      subtotal: orderItems.reduce((acc, i) => acc + i.price * i.quantity, 0),
      discount: savedDiscountAmount,
      shipping: savedShippingCost,
      total: savedFinalTotal,
      paymentMethod: getMethodLabel(paymentMethod),
      storeLogoUrl: settings?.logo_url,
    });
    toast.success("Recibo gerado com sucesso!");
  };

  const getMethodIcon = (method: string | null) => {
    switch (method) {
      case "pix": return <QrCode className="h-4 w-4 text-primary" />;
      case "credit_card": return <CreditCard className="h-4 w-4 text-primary" />;
      case "boleto": return <FileText className="h-4 w-4 text-primary" />;
      case "whatsapp": return <MessageCircle className="h-4 w-4 text-green-500" />;
      default: return <ShieldCheck className="h-4 w-4 text-primary" />;
    }
  };

  const getMethodLabel = (method: string | null) => {
    switch (method) {
      case "pix": return "PIX Dinâmico";
      case "credit_card": return "Cartão de Crédito";
      case "boleto": return "Boleto Bancário";
      case "whatsapp": return "WhatsApp / Offline";
      default: return "Gateway Seguro";
    }
  };

  const CheckoutProgress = ({ currentPhase }: { currentPhase: CheckoutPhase }) => {
    const steps = [
      { id: "info", label: "Dados", icon: User },
      { id: "payment", label: "Pagamento", icon: CreditCard },
      { id: "success", label: "Concluído", icon: CheckCircle },
    ];

    return (
      <div className="mb-8 relative flex justify-between items-center max-w-md mx-auto px-4">
        <div className="absolute top-1/2 left-0 w-full h-1 bg-muted -translate-y-1/2 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ 
              width: currentPhase === "info" ? "0%" : currentPhase === "payment" ? "50%" : "100%" 
            }}
            className="h-full bg-primary"
          />
        </div>

        {steps.map((step, idx) => {
          const isActive = step.id === currentPhase;
          const isCompleted = steps.findIndex(s => s.id === currentPhase) > idx;
          const Icon = step.icon;

          return (
            <div key={step.id} className="relative z-10 flex flex-col items-center gap-2">
              <motion.div
                initial={false}
                animate={{
                  backgroundColor: isActive || isCompleted ? "var(--primary)" : "var(--muted)",
                  scale: isActive ? 1.2 : 1,
                  color: isActive || isCompleted ? "var(--primary-foreground)" : "var(--muted-foreground)"
                }}
                className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-colors border-2 ${
                  isActive || isCompleted ? "border-primary" : "border-muted"
                }`}
              >
                {isCompleted ? <CheckCircle className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
              </motion.div>
              <span className={`text-[10px] font-bold uppercase tracking-wider ${
                isActive ? "text-primary" : "text-muted-foreground"
              }`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  if (phase === "payment" && orderId) {
    return (
      <div className="max-w-2xl mx-auto py-8 px-4">
        <CheckoutProgress currentPhase="payment" />
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.4 }}
        >
          <PaymentStep
            orderId={orderId}
            storeUserId={settings?.user_id}
            total={finalTotal}
            settings={settings}
            initialCpf={cpf}
            onSuccess={(method, cpf) => {
              setSavedFinalTotal(finalTotal);
              setSavedDiscountAmount(discountAmount);
              setSavedShippingCost(shippingCost);
              setSavedPayerCpf(cpf || null);
              cart.clearCart();
              setPaymentMethod(method || "gateway");
              setPaymentDate(new Date());
              setPhase("success");
            }}
          />
          <Button 
            variant="ghost" 
            className="w-full mt-4 text-muted-foreground"
            onClick={() => setPhase("info")}
          >
            ← Voltar para dados de entrega
          </Button>
        </motion.div>
      </div>
    );
  }

  if (phase === "success") {
    const formattedDate = paymentDate ? format(paymentDate, "dd/MM/yyyy HH:mm", { locale: ptBR }) : "";
    return (
      <div className="max-w-2xl mx-auto py-8 px-4 space-y-6">
        <CheckoutProgress currentPhase="success" />
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center space-y-3 mb-8"
        >
          <div className="inline-flex items-center justify-center h-20 w-20 rounded-full bg-green-100 text-green-600 mb-2">
            <CheckCircle className="h-10 w-10" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">Obrigado pela compra!</h1>
          <p className="text-muted-foreground">Seu pedido foi processado com sucesso e o recibo já está disponível.</p>
        </motion.div>

        <div className="relative bg-card border border-border shadow-xl rounded-2xl overflow-visible">
          <div className="p-8 pt-10 space-y-8">
            <div className="text-center space-y-1 pb-6 border-b border-dashed border-border">
              <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-zinc-400">Valor Total</p>
              <h2 className="text-4xl font-extrabold text-zinc-900 dark:text-zinc-100 tracking-tighter">
                {formatPrice(savedFinalTotal)}
              </h2>
              <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-100 dark:bg-green-950 dark:text-green-400 dark:border-green-900 mt-2">
                Operação Finalizada
              </Badge>
            </div>

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
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <Button className="w-full h-12 font-bold rounded-xl" onClick={handleDownloadReceipt}>
            <Printer className="mr-2 h-5 w-5" /> Imprimir Recibo
          </Button>
          <Button variant="outline" className="w-full h-12" onClick={() => navigate(`/loja/${settings?.store_slug || ""}/rastreio/${orderId}`)}>
            <Package className="mr-2 h-5 w-5" /> Ver Rastreio
          </Button>
        </div>
      </div>
    );
  }

  if (cart.items.length === 0) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <h1 className="text-xl font-bold">{t.store.emptyCart}</h1>
        <Button className="mt-4" variant="outline" onClick={() => navigate(`/loja/${settings?.store_slug || ""}`)}>{t.store.continueShopping}</Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8" style={{ fontFamily: "var(--store-font-body)" }}>
      <CheckoutProgress currentPhase="info" />
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid gap-6"
      >
        <h1 className="text-2xl font-bold mb-2 text-center" style={{ fontFamily: "var(--store-font-heading)" }}>
          {t.checkout.title}
        </h1>

        <Card className="overflow-hidden border-none shadow-xl bg-gradient-to-br from-white to-slate-50 dark:from-zinc-900 dark:to-zinc-950">
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Box className="h-4 w-4 text-primary" /> {t.checkout.orderSummary}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {cart.items.map((item, idx) => (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                key={item.id} 
                className="flex justify-between text-sm items-center"
              >
                <span>{item.quantity}x {item.name}</span>
                <span className="font-bold">{formatPrice(item.price * item.quantity)}</span>
              </motion.div>
            ))}
            <Separator />
            <div className="flex justify-between font-extrabold text-xl pt-2">
              <span>Total</span>
              <span className="text-primary">{formatPrice(finalTotal)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <ShippingCalculator settings={settings} subtotal={cart.total} onSelectShipping={setSelectedShipping} selectedShipping={selectedShipping} storeUserId={settings?.user_id} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">{t.checkout.personalData}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t.checkout.fullName} *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome completo" />
              </div>
              <div className="space-y-2">
                <Label>CPF *</Label>
                <Input value={cpf} onChange={(e) => setCpf(formatCPF(e.target.value))} placeholder="000.000.000-00" maxLength={14} />
              </div>
              <div className="space-y-2">
                <Label>{t.common.phone} *</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-9999" />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" />
              </div>
            </div>

            <Separator />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>CEP *</Label>
                <Input value={cep} onChange={(e) => setCep(formatCEP(e.target.value))} onBlur={handleCepBlur} placeholder="00000-000" maxLength={9} />
              </div>
              <div className="sm:col-span-2 space-y-2">
                <Label>Rua *</Label>
                <Input value={street} onChange={(e) => setStreet(e.target.value)} placeholder="Rua" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Número *</Label>
                <Input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="Nº" />
              </div>
              <div className="sm:col-span-2 space-y-2">
                <Label>Bairro *</Label>
                <Input value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} placeholder="Bairro" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2 space-y-2">
                <Label>Cidade *</Label>
                <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Cidade" />
              </div>
              <div className="space-y-2">
                <Label>Estado *</Label>
                <Input value={state} onChange={(e) => setState(e.target.value.toUpperCase())} placeholder="UF" maxLength={2} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Button className="w-full h-12 text-lg font-bold" onClick={() => handleSubmit(false)} disabled={loading || authLoading}>
          {loading ? <Loader2 className="animate-spin" /> : "Ir para Pagamento"}
        </Button>
      </motion.div>

      {settings?.user_id && (
        <CustomerAuthModal open={authModalOpen} onOpenChange={setAuthModalOpen} storeUserId={settings.user_id} />
      )}
    </div>
  );
}
