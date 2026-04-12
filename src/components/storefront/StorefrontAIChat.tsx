import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Send, Loader2, MessageCircle, Bot, User, Minimize2, ShoppingBag, ExternalLink, Headphones, Check, CheckCheck } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useCustomerAuth } from "@/hooks/useCustomerAuth";
import { useLojaContext } from "@/pages/loja/LojaLayout";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "@/i18n";
import { v4 as uuidv4 } from "uuid";

type Msg = { 
  role: "user" | "assistant"; 
  content: string; 
  created_at?: string; 
  read_at?: string | null; 
  delivered_at?: string | null;
  id?: string;
};

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-store-chat`;

function cleanContent(content: string): string {
  return content
    .replace(/\[ACTION_CEP_LOOKUP\][\s\S]*?\[\/ACTION_CEP_LOOKUP\]/g, "")
    .replace(/\[ACTION_CREATE_ORDER\][\s\S]*?\[\/ACTION_CREATE_ORDER\]/g, "")
    .replace(/\[ACTION_PAYMENT\][\s\S]*?\[\/ACTION_PAYMENT\]/g, "")
    .replace(/\[ACTION_WHATSAPP_REDIRECT\][\s\S]*?\[\/ACTION_WHATSAPP_REDIRECT\]/g, "")
    .trim();
}

interface StorefrontAIChatProps {
  storeUserId: string;
  storeName: string;
  aiName?: string;
  aiAvatarUrl?: string;
  primaryColor?: string;
  isPremium?: boolean;
}

const NOTIFICATION_SOUND = "/sounds/notification.mp3";

const playNotificationSound = () => {
  try {
    const audio = new Audio(NOTIFICATION_SOUND);
    audio.volume = 0.6;
    audio.play().catch(() => {});
  } catch (err) {
    console.error("Error playing sound:", err);
  }
};

export function StorefrontAIChat({ storeUserId, storeName, aiName, aiAvatarUrl, primaryColor, isPremium }: StorefrontAIChatProps) {
  const { locale } = useTranslation();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);
  const [whatsappRedirect, setWhatsappRedirect] = useState<{ phone: string; summary: string } | null>(null);
  
  const [isHumanMode, setIsHumanMode] = useState(!isPremium);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [sessionId] = useState(() => {
    let id = localStorage.getItem("chat_session_id");
    if (!id) {
      id = uuidv4();
      localStorage.setItem("chat_session_id", id);
    }
    return id;
  });
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { customer } = useCustomerAuth();
  const lojaCtx = useLojaContext();
  const queryClient = useQueryClient();

  const unreadCount = useMemo(() => {
    return messages.filter(m => m.role === "assistant" && !m.read_at).length;
  }, [messages]);

  const displayName = aiName || "Assistente";
  const initials = displayName.slice(0, 2).toUpperCase();
  const accentColor = primaryColor || "#6d28d9";

  const uiText = {
    pt: {
      quickProducts: "🛍️ Ver produtos", quickPromos: "🏷️ Promoções", quickShipping: "🚚 Frete", quickOrder: "📦 Fazer pedido", humanSupport: "🎧 Suporte Humano",
      quickProductsPrompt: "Quais produtos vocês têm disponíveis?", quickPromosPrompt: "Tem algum cupom de desconto ou promoção?", quickShippingPrompt: "Como funciona a entrega? Quais regiões atendem?", quickOrderPrompt: "Quero fazer um pedido!",
      title: isHumanMode ? "Suporte Humano" : "Chat com IA", subtitle: isHumanMode ? "Atendimento em tempo real" : "Assistente de compras", welcome: `Olá! Bem-vindo à ${storeName}! 👋`, intro: isHumanMode ? "Olá! Em que posso ajudar você hoje? Um de nossos atendentes falará com você em breve." : `Sou ${displayName}, seu assistente de compras. Posso ajudar a encontrar produtos, calcular frete e finalizar seu pedido!`, typing: "Digitando...", placeholder: "Digite sua mensagem...", whatsapp: "Continuar pelo WhatsApp",
      addressFound: "📍 **Endereço encontrado:**", street: "🏠 **Rua:**", neighborhood: "🏘️ **Bairro:**", city: "🏙️ **Cidade:**", notFoundF: "Não encontrada", notFoundM: "Não encontrado", askNumber: "Agora me informe o **número** da sua casa/apartamento e o **complemento** (se houver).", cepNotFound: "❌ CEP não encontrado. Por favor, verifique e tente novamente.",
      orderCreated: "🎉 **Pedido criado com sucesso!**", orderNumber: "📋 **Número:**", total: "💰 **Total:**", status: "📦 **Status:**", pending: "Pendente", trackOrder: "🔍 **Rastreie seu pedido:** Use o código", trackingSuffix: "na página de rastreio.", thanks: "Obrigado pela sua compra! 🛍️", orderCreatedToast: "Pedido criado com sucesso!", orderError: "❌ Houve um erro ao criar seu pedido. Por favor, tente novamente ou entre em contato conosco.", orderProcessError: "❌ Erro ao processar o pedido. Tente novamente.", noOrderForPayment: "❌ Nenhum pedido encontrado para processar o pagamento.", paymentError: "Erro ao processar pagamento", pixCreated: "✅ **PIX gerado com sucesso!**", pixCopy: "📋 **Código PIX (copie e cole):**", pixExpires: "⏰ O PIX expira em 30 minutos. Após o pagamento, seu pedido será processado automaticamente!", pixToast: "PIX gerado! Escaneie o QR Code para pagar.", paymentApproved: "✅ **Pagamento aprovado!** Seu pedido está sendo processado. Obrigado! 🎉", paymentApprovedToast: "Pagamento aprovado!", boletoCreated: "📄 **Boleto gerado com sucesso!**", boletoLink: "📥 Clique aqui para visualizar/baixar o boleto", boletoExpires: "⏰ O boleto vence em 3 dias úteis.", boletoToast: "Boleto gerado!", paymentProcessed: "💳 Pagamento processado! Status:", unknownError: "Erro desconhecido", connectionError: "Erro de conexão", noResponse: "Sem resposta",
    },
    en: {
      quickProducts: "🛍️ View products", quickPromos: "🏷️ Promotions", quickShipping: "🚚 Shipping", quickOrder: "📦 Place order", humanSupport: "🎧 Human Support",
      quickProductsPrompt: "Which products do you have available?", quickPromosPrompt: "Do you have any discount coupon or promotion?", quickShippingPrompt: "How does shipping work? Which areas do you serve?", quickOrderPrompt: "I want to place an order!",
      title: isHumanMode ? "Human Support" : "AI chat", subtitle: isHumanMode ? "Real-time support" : "Shopping assistant", welcome: `Hello! Welcome to ${storeName}! 👋`, intro: isHumanMode ? "Hello! How can I help you today? One of our agents will be with you shortly." : `I'm ${displayName}, your shopping assistant. I can help you find products, calculate shipping and finish your order!`, typing: "Typing...", placeholder: "Type your message...", whatsapp: "Continue on WhatsApp",
      addressFound: "📍 **Address found:**", street: "🏠 **Street:**", neighborhood: "🏘️ **Neighborhood:**", city: "🏙️ **City:**", notFoundF: "Not found", notFoundM: "Not found", askNumber: "Now please tell me the **house/apartment number** and the **complement** (if any).", cepNotFound: "❌ ZIP code not found. Please check it and try again.",
      orderCreated: "🎉 **Order created successfully!**", orderNumber: "📋 **Number:**", total: "💰 **Total:**", status: "📦 **Status:**", pending: "Pending", trackOrder: "🔍 **Track your order:** Use the code", trackingSuffix: "on the tracking page.", thanks: "Thank you for your purchase! 🛍️", orderCreatedToast: "Order created successfully!", orderError: "❌ There was an error creating your order. Please try again or contact us.", orderProcessError: "❌ Error processing the order. Please try again.", noOrderForPayment: "❌ No order found to process the payment.", paymentError: "Error processing payment", pixCreated: "✅ **PIX generated successfully!**", pixCopy: "📋 **PIX code (copy and paste):**", pixExpires: "⏰ PIX expires in 30 minutes. After payment, your order will be processed automatically!", pixToast: "PIX generated! Scan the QR code to pay.", paymentApproved: "✅ **Payment approved!** Your order is being processed. Thank you! 🎉", paymentApprovedToast: "Payment approved!", boletoCreated: "📄 **Boleto generated successfully!**", boletoLink: "📥 Click here to view/download the boleto", boletoExpires: "⏰ The boleto expires in 3 business days.", boletoToast: "Boleto generated!", paymentProcessed: "💳 Payment processed! Status:", unknownError: "Unknown error", connectionError: "Connection error", noResponse: "No response",
    },
  }[locale] || {
    quickProducts: "🛍️ View products", quickPromos: "🏷️ Promotions", quickShipping: "🚚 Shipping", quickOrder: "📦 Place order", humanSupport: "🎧 Human Support",
    quickProductsPrompt: "Which products do you have available?", quickPromosPrompt: "Do you have any discount coupon or promotion?", quickShippingPrompt: "How does shipping work? Which areas do you serve?", quickOrderPrompt: "I want to place an order!",
    title: isHumanMode ? "Human Support" : "AI chat", subtitle: isHumanMode ? "Real-time support" : "Shopping assistant", welcome: `Hello! Welcome to ${storeName}! 👋`, intro: isHumanMode ? "Hello! How can I help you today? One of our agents will be with you shortly." : `I'm ${displayName}, your shopping assistant. I can help you find products, calculate shipping and finish your order!`, typing: "Typing...", placeholder: "Type your message...", whatsapp: "Continue on WhatsApp",
    addressFound: "📍 **Address found:**", street: "🏠 **Street:**", neighborhood: "🏘️ **Neighborhood:**", city: "🏙️ **City:**", notFoundF: "Not found", notFoundM: "Not found", askNumber: "Now please tell me the **house/apartment number** and the **complement** (if any).", cepNotFound: "❌ ZIP code not found. Please check it and try again.",
    orderCreated: "🎉 **Order created successfully!**", orderNumber: "📋 **Number:**", total: "💰 **Total:**", status: "📦 **Status:**", pending: "Pending", trackOrder: "🔍 **Track your order:** Use the code", trackingSuffix: "on the tracking page.", thanks: "Thank you for your purchase! 🛍️", orderCreatedToast: "Order created successfully!", orderError: "❌ There was an error creating your order. Please try again or contact us.", orderProcessError: "❌ Error processing the order. Please try again.", noOrderForPayment: "❌ No order found to process the payment.", paymentError: "Error processing payment", pixCreated: "✅ **PIX generated successfully!**", pixCopy: "📋 **PIX code (copy and paste):**", pixExpires: "⏰ PIX expires in 30 minutes. After payment, your order will be processed automatically!", pixToast: "PIX generated! Scan the QR code to pay.", paymentApproved: "✅ **Payment approved!** Your order is being processed. Thank you! 🎉", paymentApprovedToast: "Payment approved!", boletoCreated: "📄 **Boleto generated successfully!**", boletoLink: "📥 Click here to view/download the boleto", boletoExpires: "⏰ The boleto expires in 3 business days.", boletoToast: "Boleto generated!", paymentProcessed: "💳 Payment processed! Status:", unknownError: "Unknown error", connectionError: "Connection error", noResponse: "No response",
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  useEffect(() => {
    if (isHumanMode && open) {
      const initSupport = async () => {
        const { data: conv } = await supabase
          .from("support_conversations")
          .select("id")
          .eq("tenant_id", storeUserId)
          .eq("session_id", sessionId)
          .maybeSingle();

        let currentConvId = conv?.id;

        if (!currentConvId) {
          const { data: newConv } = await supabase
            .from("support_conversations")
            .insert({
              tenant_id: storeUserId,
              session_id: sessionId,
              customer_id: customer?.id || null,
            })
            .select("id")
            .single();

          if (newConv) currentConvId = newConv.id;
        }

        if (currentConvId) {
          setConversationId(currentConvId);
          const { data: msgs } = await supabase
            .from("support_messages")
            .select("*")
            .eq("conversation_id", currentConvId)
            .order("created_at", { ascending: true });

          if (msgs) {
            setMessages(msgs.map(m => ({
              role: m.sender_type === "customer" ? "user" : "assistant",
              content: m.body,
              created_at: m.created_at,
              read_at: m.read_at,
              delivered_at: m.delivered_at
            })));

            await supabase
              .from("support_messages")
              .update({ read_at: new Date().toISOString() })
              .eq("conversation_id", currentConvId)
              .eq("sender_type", "admin")
              .is("read_at", null);
          }
        }
      };

      initSupport();

      const channel = supabase
        .channel(`support_storefront_${sessionId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "support_messages" },
          (payload: any) => {
            if (payload.new.conversation_id === conversationId) {
              setMessages(prev => {
                const alreadyExists = prev.some(m => m.id === payload.new.id || (m.content === payload.new.body && m.created_at === payload.new.created_at));
                if (alreadyExists) return prev;
                
                if (payload.new.sender_type === "admin") {
                  playSound("RECEIVED");
                } else {
                  playSound("SENT");
                }

                return [...prev, {
                  id: payload.new.id,
                  role: payload.new.sender_type === "customer" ? "user" : "assistant",
                  content: payload.new.body,
                  created_at: payload.new.created_at,
                  read_at: payload.new.read_at,
                  delivered_at: payload.new.delivered_at
                }];
              });
              
              if (payload.new.sender_type === "admin" && open) {
                supabase.from("support_messages").update({ read_at: new Date().toISOString() }).eq("id", payload.new.id).then();
              }
            }
          }
        )
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    }
  }, [isHumanMode, open, storeUserId, sessionId, conversationId, customer?.id]);

  useEffect(() => {
    if (conversationId && isHumanMode) {
      const updateTypingStatus = async (typing: boolean) => {
        await supabase
          .from("support_conversations")
          .update({ is_typing_customer: typing })
          .eq("id", conversationId);
      };

      if (input.trim() && !isTyping) {
        setIsTyping(true);
        updateTypingStatus(true);
      }

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      
      typingTimeoutRef.current = setTimeout(() => {
        if (isTyping) {
          setIsTyping(false);
          updateTypingStatus(false);
        }
      }, 3000);
    }
  }, [input, conversationId, isHumanMode]);

  const processActions = useCallback(async (content: string) => {
    const cepMatch = content.match(/\[ACTION_CEP_LOOKUP\]([\s\S]*?)\[\/ACTION_CEP_LOOKUP\]/);
    if (cepMatch) {
      try {
        const payload = JSON.parse(cepMatch[1].trim());
        const cep = (payload.cep || "").replace(/\D/g, "");
        if (cep.length === 8) {
          const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
          const data = await res.json();
          if (data && !data.erro) {
            setMessages(prev => [...prev, { role: "assistant", content: `${uiText.addressFound}\n\n${uiText.street} ${data.logradouro || uiText.notFoundF}\n${uiText.neighborhood} ${data.bairro || uiText.notFoundM}\n${uiText.city} ${data.localidade || ""} - ${data.uf || ""}\n\n${uiText.askNumber}` }]);
          } else {
            setMessages(prev => [...prev, { role: "assistant", content: uiText.cepNotFound }]);
          }
        }
      } catch (e) { console.error("CEP lookup error:", e); }
    }

    const orderMatch = content.match(/\[ACTION_CREATE_ORDER\]([\s\S]*?)\[\/ACTION_CREATE_ORDER\]/);
    if (orderMatch) {
      try {
        const payload = JSON.parse(orderMatch[1].trim());
        const itemsTotal = (payload.items || []).reduce((sum: number, item: any) => sum + (item.unit_price * item.quantity), 0);
        const total = itemsTotal + (payload.shipping_cost || 0) - (payload.discount_amount || 0);

        const { data: order } = await supabase.from("orders").insert({
          user_id: storeUserId, customer_name: payload.customer_name, customer_email: payload.customer_email || null, customer_phone: payload.customer_phone || null, shipping_cep: payload.shipping_cep || null, shipping_street: payload.shipping_street || null, shipping_neighborhood: payload.shipping_neighborhood || null, shipping_city: payload.shipping_city || null, shipping_state: payload.shipping_state || null, shipping_number: payload.shipping_number || null, shipping_complement: payload.shipping_complement || null, shipping_cost: payload.shipping_cost || 0, shipping_method: payload.shipping_method || null, coupon_code: payload.coupon_code || null, discount_amount: payload.discount_amount || 0, total, status: "pendente", whatsapp_order: false,
        }).select("id, tracking_token").single();

        if (order && payload.items) {
          const orderItems = payload.items.map((item: any) => ({
            order_id: order.id, product_id: item.product_id || null, product_name: item.product_name, quantity: item.quantity, unit_price: item.unit_price, product_image: item.product_image || null,
          }));
          await supabase.from("order_items").insert(orderItems);
        }

        const trackToken = order?.tracking_token || "";
        const orderId = order?.id?.slice(0, 8) || "";
        setLastOrderId(order?.id || null);
        setMessages(prev => [...prev, { role: "assistant", content: `${uiText.orderCreated}\n\n${uiText.orderNumber} #${orderId}\n${uiText.total} R$ ${total.toFixed(2)}\n${uiText.status} ${uiText.pending}\n\n${trackToken ? `${uiText.trackOrder} \`${trackToken}\` ${uiText.trackingSuffix}` : ""}\n\n${uiText.thanks}` }]);
        toast.success(uiText.orderCreatedToast);
        queryClient.invalidateQueries({ queryKey: ["orders"] });
      } catch (e) { console.error("Create order error:", e); }
    }
  }, [storeUserId, queryClient, lastOrderId, uiText]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    if (isHumanMode) {
      if (!conversationId) return;
      await supabase.from("support_messages").insert({ conversation_id: conversationId, sender_type: "customer", body: text.trim() });
      setInput("");
      return;
    }

    const userMsg: Msg = { role: "user", content: text.trim() };
    const allMessages = [...messages, userMsg];
    setMessages(allMessages);
    setInput("");
    setIsLoading(true);

    let assistantSoFar = "";
    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ messages: allMessages.map(m => ({ role: m.role, content: m.content })), storeUserId, customerName: customer?.name || "Cliente", locale, clientTime: new Date().toISOString() }),
      });

      if (!resp.ok) throw new Error("Erro na conexão");
      if (!resp.body) throw new Error("Sem resposta");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.startsWith("data: ")) {
            const jsonStr = line.slice(6).trim();
            if (jsonStr === "[DONE]") break;
            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                assistantSoFar += content;
                setMessages(prev => {
                  const last = prev[prev.length - 1];
                  if (last?.role === "assistant") return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
                  return [...prev, { role: "assistant", content: assistantSoFar }];
                });
              }
            } catch {}
          }
        }
      }
      if (assistantSoFar) await processActions(assistantSoFar);
    } catch (e) {
      setMessages(prev => [...prev, { role: "assistant", content: "❌ Erro ao processar mensagem." }]);
    } finally { setIsLoading(false); }
  };

  const quickActions = [
    { label: uiText.quickProducts, prompt: uiText.quickProductsPrompt },
    { label: uiText.quickPromos, prompt: uiText.quickPromosPrompt },
    { label: uiText.quickShipping, prompt: uiText.quickShippingPrompt },
    { label: uiText.quickOrder, prompt: uiText.quickOrderPrompt },
    ...(isPremium ? [{ label: uiText.humanSupport, action: () => setIsHumanMode(true) }] : []),
  ];

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed z-50 h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all flex items-center justify-center bottom-36 md:bottom-[5.5rem] right-6 animate-fade-in group"
        style={{ backgroundColor: accentColor }}
        title={uiText.title}
      >
        <div className="relative">
          <MessageCircle className="h-6 w-6 text-white group-hover:scale-110 transition-transform" />
          {unreadCount > 0 && (
            <span 
              className="absolute -top-3 -right-3 bg-red-600 text-white text-[10px] font-bold h-5 w-5 rounded-full flex items-center justify-center border-2 border-white animate-bounce shadow-md"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </div>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 sm:inset-auto sm:bottom-6 sm:left-6 z-50 w-full sm:w-[380px] h-full sm:h-[540px] sm:max-h-[540px] flex flex-col sm:rounded-2xl border-0 sm:border border-border bg-card shadow-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3" style={{ backgroundColor: accentColor }}>
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9 ring-2 ring-white/30">
            {isHumanMode ? (
              <AvatarFallback className="bg-white/20 text-white"><User /></AvatarFallback>
            ) : (
              <>
                {aiAvatarUrl && <AvatarImage src={aiAvatarUrl} alt={displayName} className="object-cover" />}
                <AvatarFallback className="bg-white/20 text-white text-xs font-bold">{initials}</AvatarFallback>
              </>
            )}
          </Avatar>
          <div>
            <p className="text-sm font-semibold text-white">{isHumanMode ? "Atendente" : displayName}</p>
            <p className="text-xs text-white/80">{uiText.subtitle}</p>
          </div>
        </div>
        <div className="flex gap-1">
          {isHumanMode && isPremium && (
            <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20" onClick={() => { setIsHumanMode(false); setMessages([]); }}>
              <Bot className="h-4 w-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20" onClick={() => setOpen(false)}><Minimize2 className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20" onClick={() => { setMessages([]); setOpen(false); setIsHumanMode(false); }}><X className="h-4 w-4" /></Button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/30">
        {messages.length === 0 && (
          <div className="space-y-4">
            <div className="flex flex-col items-center text-center space-y-3 py-4">
              <Avatar className="h-16 w-16 ring-2 shadow-md" style={{ ['--tw-ring-color' as any]: accentColor + "33" }}>
                {isHumanMode ? (
                  <AvatarFallback className="text-lg font-bold" style={{ backgroundColor: accentColor + "15", color: accentColor }}>
                    <Headphones className="h-8 w-8" />
                  </AvatarFallback>
                ) : (
                  <>
                    {aiAvatarUrl && <AvatarImage src={aiAvatarUrl} alt={displayName} className="object-cover" />}
                    <AvatarFallback className="text-lg font-bold" style={{ backgroundColor: accentColor + "15", color: accentColor }}>{initials}</AvatarFallback>
                  </>
                )}
              </Avatar>
              <h3 className="font-semibold text-foreground">{uiText.welcome}</h3>
              <p className="text-sm text-muted-foreground px-4">{uiText.intro}</p>
            </div>
            {!isHumanMode && (
              <div className="grid grid-cols-2 gap-2">
                {quickActions.map((action) => (
                  <Button
                    key={action.label}
                    variant="outline"
                    className="justify-start text-xs h-auto py-2.5 px-3 whitespace-normal text-left border-border/60 hover:border-primary/50"
                    onClick={() => action.action ? action.action() : sendMessage(action.prompt!)}
                  >
                    {action.label}
                  </Button>
                ))}
              </div>
            )}
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div 
              className={`max-w-[85%] px-4 py-2 rounded-2xl text-sm relative ${
                msg.role === "user" ? "text-primary-foreground rounded-tr-none" : "bg-card text-foreground rounded-tl-none shadow-sm"
              }`}
              style={msg.role === "user" ? { backgroundColor: accentColor } : undefined}
            >
              <div className="prose prose-sm dark:prose-invert break-words max-w-none">
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
              {isHumanMode && msg.role === "user" && (
                <div className="flex justify-end mt-1">
                  {msg.read_at ? <CheckCheck className="h-3 w-3" /> : <Check className="h-3 w-3 opacity-50" />}
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-card text-foreground px-4 py-2 rounded-2xl rounded-tl-none shadow-sm">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); sendMessage(input); }} className="p-4 border-t bg-card flex gap-2">
        <Input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} placeholder={uiText.placeholder} className="flex-1" disabled={isLoading} />
        <Button type="submit" size="icon" style={{ backgroundColor: accentColor }} disabled={!input.trim() || isLoading}><Send className="h-4 w-4 text-white" /></Button>
      </form>
    </div>
  );
}
