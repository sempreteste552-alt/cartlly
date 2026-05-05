import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Send, Loader2, MessageCircle, Bot, User, Minimize2, Headphones, Check, CheckCheck, ArrowLeft } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useCustomerAuth } from "@/hooks/useCustomerAuth";
import { useCustomerNotifications } from "@/hooks/useCustomerNotifications";
import { useLojaContext } from "@/pages/loja/LojaLayout";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "@/i18n";
import { getOrCreateChatSessionId } from "@/lib/chatSession";
import { format } from "date-fns";

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
  storeLogoUrl?: string;
}

const NOTIFICATION_SOUND = "/sounds/notification.mp3";
const LOCAL_TYPING_IDLE_MS = 1200;
const REMOTE_TYPING_STALE_MS = 2000;
const TYPING_THROTTLE_MS = 900;

const playNotificationSound = () => {
  try {
    const audio = new Audio(NOTIFICATION_SOUND);
    audio.volume = 0.6;
    audio.play().catch(() => {});
  } catch (err) {
    console.error("Error playing sound:", err);
  }
};

function getPresenceLabel(isTyping: boolean, updatedAt?: string | null) {
  if (isTyping) return "Digitando...";
  if (!updatedAt) return "Offline";

  const diffMin = Math.max(1, Math.floor((Date.now() - new Date(updatedAt).getTime()) / 60000));
  if (diffMin < 2) return "Online";
  if (diffMin < 60) return `Visto há ${diffMin} min`;

  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `Visto há ${diffH} h`;

  return `Visto ${format(new Date(updatedAt), "dd/MM HH:mm")}`;
}

export function StorefrontAIChat({ storeUserId, storeName, aiName, aiAvatarUrl, primaryColor, isPremium, storeLogoUrl }: StorefrontAIChatProps) {
  const { locale } = useTranslation();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);
  const [whatsappRedirect, setWhatsappRedirect] = useState<{ phone: string; summary: string } | null>(null);
  
  const [isHumanMode, setIsHumanMode] = useState(!isPremium);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [sessionId] = useState(() => getOrCreateChatSessionId());
  const [isTyping, setIsTyping] = useState(false);
  const [isAdminTyping, setIsAdminTyping] = useState(false);
  const [displayAdminTyping, setDisplayAdminTyping] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState<"connected" | "connecting" | "offline">("connecting");
  const [conversationUpdatedAt, setConversationUpdatedAt] = useState<string | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const adminTypingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingPushRef = useRef<number>(0);
  const pendingMessagesRef = useRef<Set<string>>(new Set());
  const adminTypingShownAtRef = useRef<number>(0);
  const adminTypingAppearTimerRef = useRef<NodeJS.Timeout | null>(null);
  const adminTypingHideTimerRef = useRef<NodeJS.Timeout | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { customer } = useCustomerAuth();
  const { chatUnreadCount } = useCustomerNotifications(storeUserId);
  const lojaCtx = useLojaContext();
  const queryClient = useQueryClient();

  const syncIncomingAdminMessages = useCallback(async (markAsRead: boolean, targetConversationId?: string) => {
    const activeConversationId = targetConversationId || conversationId;
    if (!activeConversationId) return new Date().toISOString();

    const now = new Date().toISOString();

    await supabase
      .from("support_messages")
      .update({ delivered_at: now })
      .eq("conversation_id", activeConversationId)
      .eq("sender_type", "admin")
      .is("delivered_at", null);

    if (markAsRead) {
      await supabase
        .from("support_messages")
        .update({ read_at: now })
        .eq("conversation_id", activeConversationId)
        .eq("sender_type", "admin")
        .is("read_at", null);
    }

    setMessages(prev => prev.map((message) =>
      message.role === "assistant"
        ? {
            ...message,
            delivered_at: message.delivered_at ?? now,
            read_at: markAsRead ? message.read_at ?? now : message.read_at,
          }
        : message
    ));

    return now;
  }, [conversationId]);

  const localUnreadCount = useMemo(() => {
    if (!open) return messages.filter(m => m.role === "assistant" && !m.read_at).length;
    return 0;
  }, [messages, open]);

  const unreadCount = Math.max(localUnreadCount, chatUnreadCount);

  const displayName = aiName || "Assistente";
  const initials = displayName.slice(0, 2).toUpperCase();
  const accentColor = primaryColor || "#6d28d9";

  const uiText = {
    pt: {
      quickProducts: "🛍️ Ver produtos", quickPromos: "🏷️ Promoções", quickShipping: "🚚 Frete", quickOrder: "📦 Fazer pedido", humanSupport: "🎧 Suporte Humano",
      quickProductsPrompt: "Quais produtos vocês têm disponíveis?", quickPromosPrompt: "Tem algum cupom de desconto ou promoção?", quickShippingPrompt: "Como funciona a entrega? Quais regiões atendem?", quickOrderPrompt: "Quero fazer um pedido!", humanStatusTyping: "Digitando...", humanStatusOnline: "Online",
      title: isHumanMode ? "Suporte Humano" : "Chat com IA", subtitle: isHumanMode ? "Atendimento em tempo real" : "Assistente de compras", welcome: `Olá! Bem-vindo à ${storeName}! 👋`, intro: isHumanMode ? "Olá! Em que posso ajudar? Um atendente falará com você em breve." : `Sou ${displayName}, seu assistente de compras. Posso ajudar com produtos, frete e pedidos!`, typing: "Digitando...", placeholder: "Digite sua mensagem...", whatsapp: "Continuar pelo WhatsApp", online: "Online agora",
      addressFound: "📍 **Endereço encontrado:**", street: "🏠 **Rua:**", neighborhood: "🏘️ **Bairro:**", city: "🏙️ **Cidade:**", notFoundF: "Não encontrada", notFoundM: "Não encontrado", askNumber: "Agora me informe o **número** da sua casa/apartamento e o **complemento** (se houver).", cepNotFound: "❌ CEP não encontrado. Por favor, verifique e tente novamente.",
      orderCreated: "🎉 **Pedido criado com sucesso!**", orderNumber: "📋 **Número:**", total: "💰 **Total:**", status: "📦 **Status:**", pending: "Pendente", trackOrder: "🔍 **Rastreie seu pedido:** Use o código", trackingSuffix: "na página de rastreio.", thanks: "Obrigado pela sua compra! 🛍️", orderCreatedToast: "Pedido criado com sucesso!", orderError: "❌ Houve um erro ao criar seu pedido.", orderProcessError: "❌ Erro ao processar o pedido. Tente novamente.", noOrderForPayment: "❌ Nenhum pedido encontrado.", paymentError: "Erro ao processar pagamento", pixCreated: "✅ **PIX gerado com sucesso!**", pixCopy: "📋 **Código PIX (copie e cole):**", pixExpires: "⏰ O PIX expira em 30 minutos.", pixToast: "PIX gerado!", paymentApproved: "✅ **Pagamento aprovado!**", paymentApprovedToast: "Pagamento aprovado!", boletoCreated: "📄 **Boleto gerado com sucesso!**", boletoLink: "📥 Clique aqui para baixar o boleto", boletoExpires: "⏰ O boleto vence em 3 dias úteis.", boletoToast: "Boleto gerado!", paymentProcessed: "💳 Pagamento processado! Status:", unknownError: "Erro desconhecido", connectionError: "Erro de conexão", noResponse: "Sem resposta",
    },
    en: {
      quickProducts: "🛍️ View products", quickPromos: "🏷️ Promotions", quickShipping: "🚚 Shipping", quickOrder: "📦 Place order", humanSupport: "🎧 Human Support",
      quickProductsPrompt: "Which products do you have available?", quickPromosPrompt: "Do you have any discount coupon or promotion?", quickShippingPrompt: "How does shipping work?", quickOrderPrompt: "I want to place an order!", humanStatusTyping: "Typing...", humanStatusOnline: "Online",
      title: isHumanMode ? "Human Support" : "AI chat", subtitle: isHumanMode ? "Real-time support" : "Shopping assistant", welcome: `Hello! Welcome to ${storeName}! 👋`, intro: isHumanMode ? "Hello! How can I help you? An agent will be with you shortly." : `I'm ${displayName}, your shopping assistant!`, typing: "Typing...", placeholder: "Type your message...", whatsapp: "Continue on WhatsApp", online: "Online now",
      addressFound: "📍 **Address found:**", street: "🏠 **Street:**", neighborhood: "🏘️ **Neighborhood:**", city: "🏙️ **City:**", notFoundF: "Not found", notFoundM: "Not found", askNumber: "Now tell me the **number** and **complement**.", cepNotFound: "❌ ZIP code not found.",
      orderCreated: "🎉 **Order created!**", orderNumber: "📋 **Number:**", total: "💰 **Total:**", status: "📦 **Status:**", pending: "Pending", trackOrder: "🔍 **Track:** Use code", trackingSuffix: "on the tracking page.", thanks: "Thank you! 🛍️", orderCreatedToast: "Order created!", orderError: "❌ Error creating order.", orderProcessError: "❌ Error processing order.", noOrderForPayment: "❌ No order found.", paymentError: "Payment error", pixCreated: "✅ **PIX generated!**", pixCopy: "📋 **PIX code:**", pixExpires: "⏰ Expires in 30 min.", pixToast: "PIX generated!", paymentApproved: "✅ **Payment approved!**", paymentApprovedToast: "Payment approved!", boletoCreated: "📄 **Boleto generated!**", boletoLink: "📥 Download boleto", boletoExpires: "⏰ Expires in 3 days.", boletoToast: "Boleto generated!", paymentProcessed: "💳 Payment processed:", unknownError: "Unknown error", connectionError: "Connection error", noResponse: "No response",
    },
  }[locale] || {
    quickProducts: "🛍️ View products", quickPromos: "🏷️ Promotions", quickShipping: "🚚 Shipping", quickOrder: "📦 Place order", humanSupport: "🎧 Human Support",
    quickProductsPrompt: "Which products do you have available?", quickPromosPrompt: "Any promotions?", quickShippingPrompt: "How does shipping work?", quickOrderPrompt: "I want to place an order!", humanStatusTyping: "Typing...", humanStatusOnline: "Online",
    title: isHumanMode ? "Human Support" : "AI chat", subtitle: isHumanMode ? "Real-time support" : "Shopping assistant", welcome: `Welcome to ${storeName}! 👋`, intro: isHumanMode ? "An agent will be with you shortly." : `I'm ${displayName}, your assistant!`, typing: "Typing...", placeholder: "Type your message...", whatsapp: "Continue on WhatsApp", online: "Online now",
    addressFound: "📍 **Address found:**", street: "🏠 **Street:**", neighborhood: "🏘️ **Neighborhood:**", city: "🏙️ **City:**", notFoundF: "Not found", notFoundM: "Not found", askNumber: "Now tell me the **number**.", cepNotFound: "❌ ZIP not found.",
    orderCreated: "🎉 **Order created!**", orderNumber: "📋 **Number:**", total: "💰 **Total:**", status: "📦 **Status:**", pending: "Pending", trackOrder: "🔍 **Track:** Use code", trackingSuffix: "on tracking page.", thanks: "Thank you! 🛍️", orderCreatedToast: "Order created!", orderError: "❌ Error creating order.", orderProcessError: "❌ Error processing.", noOrderForPayment: "❌ No order found.", paymentError: "Payment error", pixCreated: "✅ **PIX generated!**", pixCopy: "📋 **PIX code:**", pixExpires: "⏰ 30 min.", pixToast: "PIX!", paymentApproved: "✅ **Approved!**", paymentApprovedToast: "Approved!", boletoCreated: "📄 **Boleto generated!**", boletoLink: "📥 Download", boletoExpires: "⏰ 3 days.", boletoToast: "Boleto!", paymentProcessed: "💳 Processed:", unknownError: "Unknown error", connectionError: "Connection error", noResponse: "No response",
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("chat") === "true") {
      setIsHumanMode(true);
      setOpen(true);
      params.delete("chat");
      const nextQuery = params.toString();
      const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash}`;
      window.history.replaceState({}, "", nextUrl);
    }
  }, []);

  useEffect(() => {
    const handler = () => {
      setIsHumanMode(true);
      setOpen(true);
    };
    window.addEventListener("open-support-chat", handler);
    return () => window.removeEventListener("open-support-chat", handler);
  }, []);

  useEffect(() => {
    if (isHumanMode && open && !conversationId) {
      const initSupport = async () => {
        let currentConvId: string | null = null;
        let currentUpdatedAt: string | null = null;
        let currentTypingAdmin = false;

        if (customer?.id) {
          const { data: customerConv } = await supabase
            .from("support_conversations")
            .select("id, updated_at, is_typing_admin")
            .eq("tenant_id", storeUserId)
            .eq("customer_id", customer.id)
            .maybeSingle();

          currentConvId = customerConv?.id ?? null;
          currentUpdatedAt = customerConv?.updated_at ?? null;
          currentTypingAdmin = !!customerConv?.is_typing_admin;
        }

        if (!currentConvId) {
          const { data: conv } = await supabase
            .from("support_conversations")
            .select("id, updated_at, is_typing_admin")
            .eq("tenant_id", storeUserId)
            .eq("session_id", sessionId)
            .maybeSingle();

          currentConvId = conv?.id ?? null;
          currentUpdatedAt = conv?.updated_at ?? null;
          currentTypingAdmin = !!conv?.is_typing_admin;
        }

        if (!currentConvId) {
          const { data: newConv } = await supabase
            .from("support_conversations")
            .insert({
              tenant_id: storeUserId,
              session_id: sessionId,
              customer_id: customer?.id || null,
            })
            .select("id, updated_at, is_typing_admin")
            .single();

          if (newConv) {
            currentConvId = newConv.id;
            currentUpdatedAt = newConv.updated_at ?? null;
            currentTypingAdmin = !!newConv.is_typing_admin;
          }
        }

        if (currentConvId) {
          setConversationId(currentConvId);
          setConversationUpdatedAt(currentUpdatedAt);
          // Always ignore stale typing flag on init — only react to live UPDATE events
          setIsAdminTyping(false);

          const { data: msgs } = await supabase
            .from("support_messages")
            .select("*")
            .eq("conversation_id", currentConvId)
            .order("created_at", { ascending: true });

          const now = await syncIncomingAdminMessages(true, currentConvId);

          if (msgs) {
            setMessages(msgs.map(m => ({
              id: m.id,
              role: m.sender_type === "customer" ? "user" : "assistant",
              content: m.body,
              created_at: m.created_at,
              read_at: m.sender_type === "admin" ? (m.read_at ?? now) : m.read_at,
              delivered_at: m.sender_type === "admin" ? (m.delivered_at ?? now) : m.delivered_at
            })));
          }
        }
      };

      initSupport();
    }
  }, [isHumanMode, open, conversationId, customer?.id, sessionId, storeUserId, syncIncomingAdminMessages]);

  useEffect(() => {
    if (!conversationId || !isHumanMode) return;

    const channel = supabase
      .channel(`support_storefront_${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_messages", filter: `conversation_id=eq.${conversationId}` },
        (payload: any) => {
            const now = new Date().toISOString();

            setMessages(prev => {
              const alreadyExists = prev.some(m => m.id === payload.new.id || (m.content === payload.new.body && Math.abs(new Date(m.created_at || "").getTime() - new Date(payload.new.created_at).getTime()) < 2000));
              if (alreadyExists) return prev;
              
              if (payload.new.sender_type === "admin") {
                setIsAdminTyping(false);
                if (adminTypingTimeoutRef.current) {
                  clearTimeout(adminTypingTimeoutRef.current);
                  adminTypingTimeoutRef.current = null;
                }
                playNotificationSound();
                supabase.from("support_messages")
                  .update({ delivered_at: now })
                  .eq("id", payload.new.id)
                  .then();
                
                if (open && document.visibilityState === "visible") {
                  supabase.from("support_messages")
                    .update({ read_at: now })
                    .eq("id", payload.new.id)
                    .then();
                }
              }

              return [...prev, {
                id: payload.new.id,
                role: payload.new.sender_type === "customer" ? "user" : "assistant",
                content: payload.new.body,
                created_at: payload.new.created_at,
                read_at: payload.new.sender_type === "admin" && open && document.visibilityState === "visible" ? (payload.new.read_at || now) : payload.new.read_at,
                delivered_at: payload.new.sender_type === "admin" ? (payload.new.delivered_at || now) : payload.new.delivered_at
              }];
            });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "support_messages", filter: `conversation_id=eq.${conversationId}` },
        (payload: any) => {
          setMessages(prev => prev.map(m => 
            m.id === payload.new.id 
              ? { ...m, read_at: payload.new.read_at, delivered_at: payload.new.delivered_at }
              : m
          ));
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "support_conversations", filter: `id=eq.${conversationId}` },
        (payload: any) => {
          const adminTyping = !!payload.new.is_typing_admin;
          setIsAdminTyping(adminTyping);
          if (adminTyping) {
            if (adminTypingTimeoutRef.current) clearTimeout(adminTypingTimeoutRef.current);
            adminTypingTimeoutRef.current = setTimeout(() => setIsAdminTyping(false), REMOTE_TYPING_STALE_MS);
          } else if (adminTypingTimeoutRef.current) {
            clearTimeout(adminTypingTimeoutRef.current);
            adminTypingTimeoutRef.current = null;
          }
          setConversationUpdatedAt(payload.new.updated_at || payload.new.last_message_at || null);
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setRealtimeStatus("connected");
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") setRealtimeStatus("offline");
        else setRealtimeStatus("connecting");
      });

    return () => {
      if (adminTypingTimeoutRef.current) {
        clearTimeout(adminTypingTimeoutRef.current);
        adminTypingTimeoutRef.current = null;
      }
      setRealtimeStatus("connecting");
      supabase.removeChannel(channel);
    };
  }, [conversationId, isHumanMode, open]);

  // Anti-flicker: only show "Digitando..." after 250ms continuous true,
  // keep it visible for at least 700ms, and suppress when realtime is offline.
  useEffect(() => {
    const ANTI_FLICKER_APPEAR_MS = 250;
    const MIN_VISIBLE_MS = 700;

    if (adminTypingAppearTimerRef.current) {
      clearTimeout(adminTypingAppearTimerRef.current);
      adminTypingAppearTimerRef.current = null;
    }
    if (adminTypingHideTimerRef.current) {
      clearTimeout(adminTypingHideTimerRef.current);
      adminTypingHideTimerRef.current = null;
    }

    if (isAdminTyping && realtimeStatus === "connected") {
      if (displayAdminTyping) return;
      adminTypingAppearTimerRef.current = setTimeout(() => {
        setDisplayAdminTyping(true);
        adminTypingShownAtRef.current = Date.now();
      }, ANTI_FLICKER_APPEAR_MS);
    } else {
      if (!displayAdminTyping) return;
      const elapsed = Date.now() - adminTypingShownAtRef.current;
      const remaining = Math.max(0, MIN_VISIBLE_MS - elapsed);
      adminTypingHideTimerRef.current = setTimeout(() => {
        setDisplayAdminTyping(false);
      }, remaining);
    }

    return () => {
      if (adminTypingAppearTimerRef.current) clearTimeout(adminTypingAppearTimerRef.current);
      if (adminTypingHideTimerRef.current) clearTimeout(adminTypingHideTimerRef.current);
    };
  }, [isAdminTyping, realtimeStatus, displayAdminTyping]);

  useEffect(() => {
    if (!conversationId || !isHumanMode) return;

    const updateTypingStatus = (typing: boolean) => {
      supabase
        .from("support_conversations")
        .update({ is_typing_customer: typing, updated_at: new Date().toISOString() })
        .eq("id", conversationId)
        .then();
    };

    const hasText = input.trim().length > 0;
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    if (!hasText) {
      if (isTyping) {
        setIsTyping(false);
        updateTypingStatus(false);
        lastTypingPushRef.current = 0;
      }
      return;
    }

    const now = Date.now();
    if (!isTyping || now - lastTypingPushRef.current > TYPING_THROTTLE_MS) {
      setIsTyping(true);
      updateTypingStatus(true);
      lastTypingPushRef.current = now;
    }

    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      updateTypingStatus(false);
      lastTypingPushRef.current = 0;
    }, LOCAL_TYPING_IDLE_MS);
  }, [input, conversationId, isHumanMode, isTyping]);

  // Clear typing flag when chat is closed
  useEffect(() => {
    if (open || !conversationId) return;
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    setIsTyping(false);
    supabase
      .from("support_conversations")
      .update({ is_typing_customer: false })
      .eq("id", conversationId)
      .then();
  }, [open, conversationId]);

  useEffect(() => {
    if (!conversationId || !isHumanMode) return;

    const pingPresence = () => {
      supabase
        .from("support_conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", conversationId)
        .then();
    };

    const isActive = () => open && document.visibilityState === "visible" && document.hasFocus();

    const syncVisibleStatuses = () => {
      const markAsRead = open && document.visibilityState === "visible";
      syncIncomingAdminMessages(markAsRead).then();
      if (isActive()) pingPresence();
    };

    syncVisibleStatuses();
    document.addEventListener("visibilitychange", syncVisibleStatuses);
    window.addEventListener("focus", syncVisibleStatuses);
    window.addEventListener("blur", syncVisibleStatuses);

    const interval = window.setInterval(() => {
      // Only mark as online while the chat panel is actually open and visible
      if (isActive()) pingPresence();
    }, 30000);

    return () => {
      document.removeEventListener("visibilitychange", syncVisibleStatuses);
      window.removeEventListener("focus", syncVisibleStatuses);
      window.removeEventListener("blur", syncVisibleStatuses);
      window.clearInterval(interval);
    };
  }, [conversationId, isHumanMode, open, syncIncomingAdminMessages]);

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
          // Validate UUIDs to prevent "invalid input syntax for type uuid" and foreign key errors
          const isUUID = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
          const itemIds = (payload.items as any[]).map(i => i.product_id).filter(id => id && isUUID(id));
          
          let validIds = new Set<string>();
          if (itemIds.length > 0) {
            const { data: validProducts } = await supabase
              .from("products")
              .select("id")
              .in("id", itemIds);
            
            if (validProducts) {
              validProducts.forEach(p => validIds.add(p.id.toLowerCase()));
            }
          }

          const orderItems = payload.items.map((item: any) => {
            const idLower = item.product_id?.toLowerCase();
            return {
              order_id: order.id, 
              // Only set product_id if it's a valid UUID AND exists in the database
              product_id: (item.product_id && isUUID(item.product_id) && idLower && validIds.has(idLower)) ? item.product_id : null, 
              product_name: item.product_name, 
              quantity: item.quantity, 
              unit_price: item.unit_price, 
              product_image: item.product_image || null,
            };
          });
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

      // Reset typing status immediately on send
      setIsTyping(false);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      supabase
        .from("support_conversations")
        .update({ is_typing_customer: false, updated_at: new Date().toISOString() })
        .eq("id", conversationId)
        .then();

      const tempId = `temp-${Date.now()}`;
      const userMsg: Msg = { 
        id: tempId,
        role: "user", 
        content: text.trim(), 
        created_at: new Date().toISOString() 
      };
      pendingMessagesRef.current.add(tempId);
      setMessages(prev => [...prev, userMsg]);
      setInput("");
      
      const { data: inserted } = await supabase.from("support_messages").insert({ 
        conversation_id: conversationId, 
        sender_type: "customer", 
        sender_id: customer?.id || null,
        body: text.trim() 
      }).select("id").single();

      if (inserted?.id) {
        setMessages(prev => prev.map(m => m.id === tempId ? { ...m, id: inserted.id } : m));
        pendingMessagesRef.current.delete(tempId);
      }

      // Notify admin via push — use support_message type to bypass dedup cooldown
      try {
        await supabase.functions.invoke("send-push-internal", {
          body: {
            target_user_id: storeUserId,
            title: `💬 ${customer?.name || "Cliente"}`,
            body: text.trim().length > 100 ? text.trim().substring(0, 97) + "..." : text.trim(),
            url: `/admin/suporte?conv=${conversationId}`,
            type: "support_message",
          }
        });
      } catch (e) {
        console.error("Push to admin error:", e);
      }
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

  // Floating bubble
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed z-50 h-[60px] w-[60px] rounded-full shadow-xl hover:shadow-2xl transition-all flex items-center justify-center bottom-20 md:bottom-6 right-6 group"
        style={{ backgroundColor: accentColor, boxShadow: `0 8px 32px ${accentColor}44` }}
        title={uiText.title}
      >
        <div className="relative">
          <MessageCircle className="h-7 w-7 text-white group-hover:scale-110 transition-transform" />
          {unreadCount > 0 && (
            <span className="absolute -top-2.5 -right-2.5 bg-destructive text-white text-[10px] font-bold h-5 min-w-5 px-1 rounded-full flex items-center justify-center border-2 border-white animate-bounce shadow-lg">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </div>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 sm:inset-auto sm:bottom-4 sm:right-4 z-50 w-full sm:w-[400px] h-full sm:h-[600px] sm:max-h-[80vh] flex flex-col sm:rounded-2xl border-0 sm:border border-border/50 bg-background shadow-2xl overflow-hidden" style={{ ['--chat-accent' as any]: accentColor }}>
      {/* Header - Premium WhatsApp style */}
      <div 
        className="flex items-center gap-3 px-4 py-3 shrink-0 relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentColor}dd)` }}
      >
        {/* Mobile back button */}
        <button onClick={() => setOpen(false)} className="sm:hidden text-white/90 hover:text-white p-1 -ml-1">
          <ArrowLeft className="h-5 w-5" />
        </button>

        <div className="relative">
          <Avatar className="h-10 w-10 ring-2 ring-white/20 shadow-md">
            {isHumanMode ? (
              <AvatarFallback className="bg-white/20 text-white"><Headphones className="h-5 w-5" /></AvatarFallback>
            ) : (
              <>
                {aiAvatarUrl && <AvatarImage src={aiAvatarUrl} alt={displayName} className="object-cover" />}
                <AvatarFallback className="bg-white/20 text-white text-xs font-bold">{initials}</AvatarFallback>
              </>
            )}
          </Avatar>
          <span className="absolute bottom-0 right-0 h-3 w-3 bg-green-400 rounded-full border-2 border-white shadow-sm" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{isHumanMode ? "Atendente" : displayName}</p>
          <p className="text-[11px] text-white/70 flex items-center gap-1">
            {isHumanMode && realtimeStatus !== "connected" ? (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-yellow-300 inline-block animate-pulse" />
                <span className="italic">{realtimeStatus === "offline" ? "Reconectando..." : "Conectando..."}</span>
              </>
            ) : displayAdminTyping ? (
              <span className="text-white font-medium animate-pulse">{uiText.typing}</span>
            ) : getPresenceLabel(false, conversationUpdatedAt) === "Online" ? (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-green-400 inline-block" />
                {uiText.humanStatusOnline}
              </>
            ) : (
              getPresenceLabel(false, conversationUpdatedAt)
            )}
          </p>
        </div>

        <div className="flex items-center gap-0.5">
          {isHumanMode && isPremium && (
            <Button variant="ghost" size="icon" className="h-8 w-8 text-white/80 hover:text-white hover:bg-white/10 rounded-full" onClick={() => { setIsHumanMode(false); setMessages([]); }}>
              <Bot className="h-4 w-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8 text-white/80 hover:text-white hover:bg-white/10 rounded-full hidden sm:flex" onClick={() => setOpen(false)}>
            <Minimize2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-white/80 hover:text-white hover:bg-white/10 rounded-full" onClick={() => { setMessages([]); setOpen(false); setIsHumanMode(false); }}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages area — store logo as faint watermark background */}
      <div 
        ref={scrollRef} 
        className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 relative"
        style={storeLogoUrl ? {
          backgroundImage: `linear-gradient(hsl(var(--background) / 0.90), hsl(var(--background) / 0.90)), url("${storeLogoUrl}")`,
          backgroundRepeat: 'no-repeat, no-repeat',
          backgroundPosition: 'center, center',
          backgroundSize: 'cover, min(60%, 260px) auto',
          backgroundAttachment: 'local, local',
          backgroundColor: 'hsl(var(--muted) / 0.3)',
        } : { backgroundColor: 'hsl(var(--muted) / 0.3)' }}
      >

        {messages.length === 0 && (
          <div className="space-y-4 py-4">
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="relative">
                <Avatar className="h-20 w-20 shadow-lg ring-4" style={{ ['--tw-ring-color' as any]: accentColor + "20" }}>
                  {isHumanMode ? (
                    <AvatarFallback className="text-2xl" style={{ backgroundColor: accentColor + "12", color: accentColor }}>
                      <Headphones className="h-10 w-10" />
                    </AvatarFallback>
                  ) : (
                    <>
                      {aiAvatarUrl && <AvatarImage src={aiAvatarUrl} alt={displayName} className="object-cover" />}
                      <AvatarFallback className="text-2xl font-bold" style={{ backgroundColor: accentColor + "12", color: accentColor }}>{initials}</AvatarFallback>
                    </>
                  )}
                </Avatar>
                <span className="absolute bottom-1 right-1 h-4 w-4 bg-green-400 rounded-full border-[3px] border-background shadow-sm" />
              </div>
              <div>
                <h3 className="font-bold text-foreground text-lg">{uiText.welcome}</h3>
                <p className="text-sm text-muted-foreground px-6 mt-1 leading-relaxed">{uiText.intro}</p>
              </div>
            </div>
            {!isHumanMode && (
              <div className="grid grid-cols-2 gap-2 px-2">
                {quickActions.map((action) => (
                  <Button
                    key={action.label}
                    variant="outline"
                    className="justify-start text-xs h-auto py-3 px-3 whitespace-normal text-left rounded-xl border-border/40 bg-background/80 backdrop-blur-sm hover:bg-background hover:shadow-sm transition-all"
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
              className={`max-w-[80%] px-3.5 py-2.5 text-sm relative ${
                msg.role === "user" 
                  ? "text-white rounded-2xl rounded-tr-md shadow-sm" 
                  : "bg-background text-foreground rounded-2xl rounded-tl-md shadow-sm border border-border/30"
              }`}
              style={msg.role === "user" ? { backgroundColor: accentColor } : undefined}
            >
              <div className="prose prose-sm dark:prose-invert break-words max-w-none [&>p]:m-0 [&>p]:leading-relaxed">
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
              <div className={`flex items-center gap-1 mt-1 ${msg.role === "user" ? "justify-end" : "justify-end"}`}>
                {msg.created_at && (
                  <span className={`text-[10px] ${msg.role === "user" ? "text-white/60" : "text-muted-foreground/60"}`}>
                    {format(new Date(msg.created_at), "HH:mm")}
                  </span>
                )}
                {isHumanMode && msg.role === "user" && (
                  msg.id?.startsWith("temp-")
                    ? <Loader2 className="h-3 w-3 animate-spin text-white/60" />
                    : msg.read_at 
                      ? <CheckCheck className="h-3.5 w-3.5 text-blue-300" /> 
                      : msg.delivered_at
                        ? <CheckCheck className="h-3.5 w-3.5 text-white/50" />
                        : <Check className="h-3.5 w-3.5 text-white/50" />
                )}
              </div>
              {isHumanMode && msg.role === "user" && (
                <p className={`text-[9px] text-right mt-0.5 ${
                  msg.read_at ? "text-blue-300" : "text-white/40"
                }`}>
                  {msg.id?.startsWith("temp-") ? "Enviando..." : msg.read_at ? "Visualizado" : msg.delivered_at ? "Entregue" : "Enviado"}
                </p>
              )}
            </div>
          </div>
        ))}

        {(isLoading || (isHumanMode && displayAdminTyping)) && (
          <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="bg-background px-4 py-3 rounded-2xl rounded-tl-md shadow-sm border border-border/30">
              <div className="flex gap-1.5 items-end h-3">
                <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:0ms]" />
                <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:150ms]" />
                <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input area */}
      <form 
        onSubmit={(e) => { e.preventDefault(); sendMessage(input); }} 
        className="p-3 border-t border-border/50 bg-background flex items-center gap-2"
      >
        <Input 
          ref={inputRef} 
          value={input} 
          onChange={(e) => setInput(e.target.value)} 
          placeholder={uiText.placeholder} 
          className="flex-1 rounded-full bg-muted/50 border-border/30 h-10 text-sm px-4 focus-visible:ring-1" 
          style={{ ['--tw-ring-color' as any]: accentColor + "60" }}
          disabled={isLoading} 
        />
        <Button 
          type="submit" 
          size="icon" 
          className="h-10 w-10 rounded-full shrink-0 shadow-md transition-all hover:shadow-lg disabled:opacity-40"
          style={{ backgroundColor: accentColor }} 
          disabled={!input.trim() || isLoading}
        >
          <Send className="h-4 w-4 text-white" />
        </Button>
      </form>
    </div>
  );
}