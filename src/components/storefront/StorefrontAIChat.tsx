import { useState, useRef, useEffect, useCallback } from "react";
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

type Msg = { role: "user" | "assistant"; content: string; created_at?: string; read_at?: string | null; delivered_at?: string | null };

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
}

export function StorefrontAIChat({ storeUserId, storeName, aiName, aiAvatarUrl, primaryColor }: StorefrontAIChatProps) {
  const { locale, t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);
  const [whatsappRedirect, setWhatsappRedirect] = useState<{ phone: string; summary: string } | null>(null);
  const [isHumanMode, setIsHumanMode] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [sessionId] = useState(() => {
    let id = localStorage.getItem("chat_session_id");
    if (!id) {
      id = uuidv4();
      localStorage.setItem("chat_session_id", id);
    }
    return id;
  });
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { customer } = useCustomerAuth();
  const lojaCtx = useLojaContext();
  const queryClient = useQueryClient();

  const displayName = aiName || "Assistente";
  const initials = displayName.slice(0, 2).toUpperCase();
  const accentColor = primaryColor || "#6d28d9";

  const uiText = {
    pt: {
      quickProducts: "🛍️ Ver produtos",
      quickPromos: "🏷️ Promoções",
      quickShipping: "🚚 Frete",
      quickOrder: "📦 Fazer pedido",
      humanSupport: "🎧 Suporte Humano",
      title: isHumanMode ? "Suporte Humano" : "Chat com IA",
      subtitle: isHumanMode ? "Atendimento em tempo real" : "Assistente de compras",
      welcome: `Olá! Bem-vindo à ${storeName}! 👋`,
      intro: `Sou ${displayName}, seu assistente de compras. Posso ajudar a encontrar produtos, calcular frete e finalizar seu pedido!`,
      typing: "Digitando...",
      placeholder: "Digite sua mensagem...",
      whatsapp: "Continuar pelo WhatsApp",
      addressFound: "📍 **Endereço encontrado:**",
      street: "🏠 **Rua:**",
      neighborhood: "🏘️ **Bairro:**",
      city: "🏙️ **Cidade:**",
      notFoundF: "Não encontrada",
      notFoundM: "Não encontrado",
      askNumber: "Agora me informe o **número** da sua casa/apartamento e o **complemento** (se houver).",
      cepNotFound: "❌ CEP não encontrado. Por favor, verifique e tente novamente.",
      orderCreated: "🎉 **Pedido criado com sucesso!**",
      orderNumber: "📋 **Número:**",
      total: "💰 **Total:**",
      status: "📦 **Status:**",
      pending: "Pendente",
      trackOrder: "🔍 **Rastreie seu pedido:** Use o código",
      trackingSuffix: "na página de rastreio.",
      thanks: "Obrigado pela sua compra! 🛍️",
      orderCreatedToast: "Pedido criado com sucesso!",
      orderError: "❌ Houve um erro ao criar seu pedido. Por favor, tente novamente ou entre em contato conosco.",
      orderProcessError: "❌ Erro ao processar o pedido. Tente novamente.",
      noOrderForPayment: "❌ Nenhum pedido encontrado para processar o pagamento.",
      paymentError: "Erro ao processar pagamento",
      pixCreated: "✅ **PIX gerado com sucesso!**",
      pixCopy: "📋 **Código PIX (copie e cole):**",
      pixExpires: "⏰ O PIX expira em 30 minutos. Após o pagamento, seu pedido será processado automaticamente!",
      pixToast: "PIX gerado! Escaneie o QR Code para pagar.",
      paymentApproved: "✅ **Pagamento aprovado!** Seu pedido está sendo processado. Obrigado! 🎉",
      paymentApprovedToast: "Pagamento aprovado!",
      boletoCreated: "📄 **Boleto gerado com sucesso!**",
      boletoLink: "📥 Clique aqui para visualizar/baixar o boleto",
      boletoExpires: "⏰ O boleto vence em 3 dias úteis.",
      boletoToast: "Boleto gerado!",
      paymentProcessed: "💳 Pagamento processado! Status:",
      unknownError: "Erro desconhecido",
      connectionError: "Erro de conexão",
      noResponse: "Sem resposta",
    },
    en: {
      quickProducts: "🛍️ View products", quickPromos: "🏷️ Promotions", quickShipping: "🚚 Shipping", quickOrder: "📦 Place order",
      quickProductsPrompt: "Which products do you have available?", quickPromosPrompt: "Do you have any discount coupon or promotion?", quickShippingPrompt: "How does shipping work? Which areas do you serve?", quickOrderPrompt: "I want to place an order!",
      title: isHumanMode ? "Human Support" : "AI chat", subtitle: isHumanMode ? "Real-time support" : "Shopping assistant", welcome: `Hello! Welcome to ${storeName}! 👋`, intro: `I'm ${displayName}, your shopping assistant. I can help you find products, calculate shipping and finish your order!`, typing: "Typing...", placeholder: "Type your message...", whatsapp: "Continue on WhatsApp",
      addressFound: "📍 **Address found:**", street: "🏠 **Street:**", neighborhood: "🏘️ **Neighborhood:**", city: "🏙️ **City:**", notFoundF: "Not found", notFoundM: "Not found", askNumber: "Now please tell me the **house/apartment number** and the **complement** (if any).", cepNotFound: "❌ ZIP code not found. Please check it and try again.",
      orderCreated: "🎉 **Order created successfully!**", orderNumber: "📋 **Number:**", total: "💰 **Total:**", status: "📦 **Status:**", pending: "Pending", trackOrder: "🔍 **Track your order:** Use the code", trackingSuffix: "on the tracking page.", thanks: "Thank you for your purchase! 🛍️", orderCreatedToast: "Order created successfully!", orderError: "❌ There was an error creating your order. Please try again or contact us.", orderProcessError: "❌ Error processing the order. Please try again.", noOrderForPayment: "❌ No order found to process the payment.", paymentError: "Error processing payment", pixCreated: "✅ **PIX generated successfully!**", pixCopy: "📋 **PIX code (copy and paste):**", pixExpires: "⏰ PIX expires in 30 minutes. After payment, your order will be processed automatically!", pixToast: "PIX generated! Scan the QR code to pay.", paymentApproved: "✅ **Payment approved!** Your order is being processed. Thank you! 🎉", paymentApprovedToast: "Payment approved!", boletoCreated: "📄 **Boleto generated successfully!**", boletoLink: "📥 Click here to view/download the boleto", boletoExpires: "⏰ The boleto expires in 3 business days.", boletoToast: "Boleto generated!", paymentProcessed: "💳 Payment processed! Status:", unknownError: "Unknown error", connectionError: "Connection error", noResponse: "No response",
    },
    es: {
      quickProducts: "🛍️ Ver productos", quickPromos: "🏷️ Promociones", quickShipping: "🚚 Envío", quickOrder: "📦 Hacer pedido",
      quickProductsPrompt: "¿Qué productos tienen disponibles?", quickPromosPrompt: "¿Tienen algún cupón de descuento o promoción?", quickShippingPrompt: "¿Cómo funciona la entrega? ¿Qué regiones atienden?", quickOrderPrompt: "¡Quiero hacer un pedido!",
      title: isHumanMode ? "Soporte Humano" : "Chat con IA", subtitle: isHumanMode ? "Atención en tiempo real" : "Asistente de compras", welcome: `¡Hola! Bienvenido a ${storeName}! 👋`, intro: `Soy ${displayName}, tu asistente de compras. Puedo ayudarte a encontrar productos, calcular el envío y finalizar tu pedido.`, typing: "Escribiendo...", placeholder: "Escribe tu mensaje...", whatsapp: "Continuar por WhatsApp",
      addressFound: "📍 **Dirección encontrada:**", street: "🏠 **Calle:**", neighborhood: "🏘️ **Barrio:**", city: "🏙️ **Ciudad:**", notFoundF: "No encontrada", notFoundM: "No encontrado", askNumber: "Ahora indícame el **número** de tu casa/departamento y el **complemento** (si existe).", cepNotFound: "❌ Código postal no encontrado. Por favor, revísalo e inténtalo de nuevo.",
      orderCreated: "🎉 **¡Pedido creado con éxito!**", orderNumber: "📋 **Número:**", total: "💰 **Total:**", status: "📦 **Estado:**", pending: "Pendiente", trackOrder: "🔍 **Sigue tu pedido:** Usa el código", trackingSuffix: "en la página de seguimiento.", thanks: "¡Gracias por tu compra! 🛍️", orderCreatedToast: "¡Pedido creado con éxito!", orderError: "❌ Hubo un error al crear tu pedido. Inténtalo de nuevo o contáctanos.", orderProcessError: "❌ Error al procesar el pedido. Inténtalo de nuevo.", noOrderForPayment: "❌ No se encontró ningún pedido para procesar el pago.", paymentError: "Error al procesar el pago", pixCreated: "✅ **¡PIX generado con éxito!**", pixCopy: "📋 **Código PIX (copiar y pegar):**", pixExpires: "⏰ El PIX vence en 30 minutos. Después del pago, tu pedido se procesará automáticamente.", pixToast: "¡PIX generado! Escanea el código QR para pagar.", paymentApproved: "✅ **¡Pago aprobado!** Tu pedido está siendo procesado. ¡Gracias! 🎉", paymentApprovedToast: "¡Pago aprobado!", boletoCreated: "📄 **¡Boleto generado con éxito!**", boletoLink: "📥 Haz clic aquí para ver/descargar el boleto", boletoExpires: "⏰ El boleto vence en 3 días hábiles.", boletoToast: "¡Boleto generado!", paymentProcessed: "💳 ¡Pago procesado! Estado:", unknownError: "Error desconocido", connectionError: "Error de conexión", noResponse: "Sin respuesta",
    },
    fr: {
      quickProducts: "🛍️ Voir les produits", quickPromos: "🏷️ Promotions", quickShipping: "🚚 Livraison", quickOrder: "📦 Commander",
      quickProductsPrompt: "Quels produits avez-vous disponibles ?", quickPromosPrompt: "Avez-vous un coupon de réduction ou une promotion ?", quickShippingPrompt: "Comment fonctionne la livraison ? Quelles zones desservez-vous ?", quickOrderPrompt: "Je veux passer une commande !",
      title: isHumanMode ? "Support Humain" : "Chat IA", subtitle: isHumanMode ? "Support en temps réel" : "Assistant d'achat", welcome: `Bonjour ! Bienvenue chez ${storeName} ! 👋`, intro: `Je suis ${displayName}, votre assistant d'achat. Je peux vous aider à trouver des produits, calculer la livraison et finaliser votre commande !`, typing: "Saisie en cours...", placeholder: "Écrivez votre message...", whatsapp: "Continuer sur WhatsApp",
      addressFound: "📍 **Adresse trouvée :**", street: "🏠 **Rue :**", neighborhood: "🏘️ **Quartier :**", city: "🏙️ **Ville :**", notFoundF: "Non trouvée", notFoundM: "Non trouvé", askNumber: "Indiquez-moi maintenant le **numéro** de votre maison/appartement et le **complément** (s'il y en a un).", cepNotFound: "❌ Code postal introuvable. Veuillez vérifier et réessayer.",
      orderCreated: "🎉 **Commande créée avec succès !**", orderNumber: "📋 **Numéro :**", total: "💰 **Total :**", status: "📦 **Statut :**", pending: "En attente", trackOrder: "🔍 **Suivez votre commande :** Utilisez le code", trackingSuffix: "sur la page de suivi.", thanks: "Merci pour votre achat ! 🛍️", orderCreatedToast: "Commande créée avec succès !", orderError: "❌ Une erreur s'est produite lors de la création de votre commande. Veuillez réessayer ou nous contacter.", orderProcessError: "❌ Erreur lors du traitement de la commande. Veuillez réessayer.", noOrderForPayment: "❌ Aucune commande trouvée pour traiter le paiement.", paymentError: "Erreur lors du traitement du paiement", pixCreated: "✅ **PIX généré avec succès !**", pixCopy: "📋 **Code PIX (copier-coller) :**", pixExpires: "⏰ Le PIX expire dans 30 minutes. Après le paiement, votre commande sera traitée automatiquement !", pixToast: "PIX généré ! Scannez le QR code pour payer.", paymentApproved: "✅ **Paiement approuvé !** Votre commande est en cours de traitement. Merci ! 🎉", paymentApprovedToast: "Paiement approuvé !", boletoCreated: "📄 **Boleto généré avec succès !**", boletoLink: "📥 Cliquez ici pour voir/télécharger le boleto", boletoExpires: "⏰ Le boleto expire dans 3 jours ouvrables.", boletoToast: "Boleto généré !", paymentProcessed: "💳 Paiement traité ! Statut :", unknownError: "Erreur inconnue", connectionError: "Erreur de connexion", noResponse: "Pas de réponse",
    },
  }[locale] || {
    // Fallback for types
  };

  // Human support message fetching
  useEffect(() => {
    if (isHumanMode && open) {
      const initSupport = async () => {
        // Find or create conversation
        const { data: conv, error } = await supabase
          .from("support_conversations")
          .select("id")
          .eq("tenant_id", storeUserId)
          .eq("session_id", sessionId)
          .maybeSingle();

        if (error) {
          console.error("Error fetching conversation:", error);
          return;
        }

        let currentConvId = conv?.id;

        if (!currentConvId) {
          const { data: newConv, error: createError } = await supabase
            .from("support_conversations")
            .insert({
              tenant_id: storeUserId,
              session_id: sessionId,
              customer_id: customer?.id || null,
            })
            .select("id")
            .single();

          if (createError) {
            console.error("Error creating conversation:", createError);
            return;
          }
          currentConvId = newConv.id;
        }

        setConversationId(currentConvId);

        // Fetch messages
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

          // Mark admin messages as read
          await supabase
            .from("support_messages")
            .update({ read_at: new Date().toISOString() })
            .eq("conversation_id", currentConvId)
            .eq("sender_type", "admin")
            .is("read_at", null);
        }
      };

      initSupport();

      // Real-time subscription
      const channel = supabase
        .channel(`support_${sessionId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "support_messages" },
          (payload: any) => {
            if (payload.new.conversation_id === conversationId) {
              setMessages(prev => [...prev, {
                role: payload.new.sender_type === "customer" ? "user" : "assistant",
                content: payload.new.body,
                created_at: payload.new.created_at,
                read_at: payload.new.read_at,
                delivered_at: payload.new.delivered_at
              }]);
              
              if (payload.new.sender_type === "admin") {
                // Mark as read
                supabase
                  .from("support_messages")
                  .update({ read_at: new Date().toISOString() })
                  .eq("id", payload.new.id)
                  .then();
              }
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [isHumanMode, open, storeUserId, sessionId, conversationId]);

  const handleHumanSupportClick = () => {
    setIsHumanMode(true);
    setMessages([]); // Clear AI messages and load human messages
  };

  const handleAISupportClick = () => {
    setIsHumanMode(false);
    setMessages([]); // Revert to AI
  };

  const processActions = useCallback(async (content: string) => {
    // CEP Lookup
    const cepMatch = content.match(/\[ACTION_CEP_LOOKUP\]([\s\S]*?)\[\/ACTION_CEP_LOOKUP\]/);
    if (cepMatch) {
      try {
        const payload = JSON.parse(cepMatch[1].trim());
        const cep = (payload.cep || "").replace(/\D/g, "");
        if (cep.length === 8) {
          const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
          const data = await res.json();
          if (data && !data.erro) {
            // Send address info back as system context in next message
            const addressInfo = `Address found: ${data.logradouro || ""}, ${data.bairro || ""}, ${data.localidade || ""} - ${data.uf || ""}, CEP: ${cep}`;
            setMessages(prev => [...prev, { role: "assistant", content: `${uiText.addressFound}\n\n${uiText.street} ${data.logradouro || uiText.notFoundF}\n${uiText.neighborhood} ${data.bairro || uiText.notFoundM}\n${uiText.city} ${data.localidade || ""} - ${data.uf || ""}\n\n${uiText.askNumber}` }]);
          } else {
            setMessages(prev => [...prev, { role: "assistant", content: uiText.cepNotFound }]);
          }
        }
      } catch (e) {
        console.error("CEP lookup error:", e);
      }
    }

    // Create Order
    const orderMatch = content.match(/\[ACTION_CREATE_ORDER\]([\s\S]*?)\[\/ACTION_CREATE_ORDER\]/);
    if (orderMatch) {
      try {
        const payload = JSON.parse(orderMatch[1].trim());
        
        // Calculate total
        const itemsTotal = (payload.items || []).reduce((sum: number, item: any) => 
          sum + (item.unit_price * item.quantity), 0);
        const total = itemsTotal + (payload.shipping_cost || 0) - (payload.discount_amount || 0);

        // Create order via supabase
        const { data: order, error: orderError } = await supabase
          .from("orders")
          .insert({
            user_id: storeUserId,
            customer_name: payload.customer_name,
            customer_email: payload.customer_email || null,
            customer_phone: payload.customer_phone || null,
            customer_cpf: payload.customer_cpf || null,
            shipping_cep: payload.shipping_cep || null,
            shipping_street: payload.shipping_street || null,
            shipping_neighborhood: payload.shipping_neighborhood || null,
            shipping_city: payload.shipping_city || null,
            shipping_state: payload.shipping_state || null,
            shipping_number: payload.shipping_number || null,
            shipping_complement: payload.shipping_complement || null,
            shipping_cost: payload.shipping_cost || 0,
            shipping_method: payload.shipping_method || null,
            coupon_code: payload.coupon_code || null,
            discount_amount: payload.discount_amount || 0,
            total,
            status: "pendente",
            whatsapp_order: false,
          })
          .select("id, tracking_token")
          .single();

        if (orderError) {
          console.error("Order creation error:", orderError);
          setMessages(prev => [...prev, { role: "assistant", content: "❌ Houve um erro ao criar seu pedido. Por favor, tente novamente ou entre em contato conosco." }]);
          return;
        }

        // Create order items
        if (order && payload.items) {
          const orderItems = payload.items.map((item: any) => ({
            order_id: order.id,
            product_id: item.product_id || null,
            product_name: item.product_name,
            quantity: item.quantity,
            unit_price: item.unit_price,
            product_image: item.product_image || null,
          }));

          await supabase.from("order_items").insert(orderItems);

          // Decrement stock
          for (const item of payload.items) {
            if (item.product_id) {
              await supabase.rpc("increment_product_views", { product_id: item.product_id }); // reuse pattern
              // Actually decrement stock
              const { data: prod } = await supabase
                .from("products")
                .select("stock")
                .eq("id", item.product_id)
                .single();
              if (prod) {
                await supabase
                  .from("products")
                  .update({ stock: Math.max(0, prod.stock - item.quantity) })
                  .eq("id", item.product_id);
              }
            }
          }

          // Increment coupon usage
          if (payload.coupon_code) {
            await supabase.rpc("increment_coupon_usage", {
              _coupon_code: payload.coupon_code,
              _store_user_id: storeUserId
            });
          }
        }

        const trackToken = order?.tracking_token || "";
        const orderId = order?.id?.slice(0, 8) || "";
        setLastOrderId(order?.id || null);

        setMessages(prev => [...prev, {
          role: "assistant",
          content: `${uiText.orderCreated}\n\n${uiText.orderNumber} #${orderId}\n${uiText.total} R$ ${total.toFixed(2)}\n${uiText.status} ${uiText.pending}\n\n${trackToken ? `${uiText.trackOrder} \`${trackToken}\` ${uiText.trackingSuffix}` : ""}\n\n${uiText.thanks}`
        }]);

        toast.success(uiText.orderCreatedToast);
        queryClient.invalidateQueries({ queryKey: ["orders"] });
      } catch (e) {
        console.error("Create order error:", e);
        setMessages(prev => [...prev, { role: "assistant", content: uiText.orderProcessError }]);
      }
    }

    // Payment Processing
    const paymentMatch = content.match(/\[ACTION_PAYMENT\]([\s\S]*?)\[\/ACTION_PAYMENT\]/);
    if (paymentMatch) {
      try {
        const payload = JSON.parse(paymentMatch[1].trim());
        const orderId = payload.order_id || lastOrderId;
        if (!orderId) {
          setMessages(prev => [...prev, { role: "assistant", content: uiText.noOrderForPayment }]);
          return;
        }

        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
        const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/create-payment`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "apikey": anonKey,
              "Authorization": `Bearer ${anonKey}`,
            },
            body: JSON.stringify({
              order_id: orderId,
              method: payload.method || "pix",
              store_user_id: storeUserId,
              payer_cpf: payload.payer_cpf || undefined,
            }),
          }
        );
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || uiText.paymentError);

        const payment = data.payment;
        if (payload.method === "pix" && payment?.pix_qr_code) {
          const qrBase64 = payment.pix_qr_code_base64;
          const pixCode = payment.pix_qr_code;
          setMessages(prev => [...prev, {
            role: "assistant",
            content: `${uiText.pixCreated}\n\n${qrBase64 ? `![QR Code PIX](data:image/png;base64,${qrBase64})` : ""}\n\n${uiText.pixCopy}\n\n\`\`\`\n${pixCode}\n\`\`\`\n\n${uiText.pixExpires}`
          }]);
          toast.success(uiText.pixToast);
        } else if (payment?.status === "approved") {
          setMessages(prev => [...prev, {
            role: "assistant",
            content: uiText.paymentApproved
          }]);
          toast.success(uiText.paymentApprovedToast);
        } else if (payload.method === "boleto" && payment?.boleto_url) {
          setMessages(prev => [...prev, {
            role: "assistant",
            content: `${uiText.boletoCreated}\n\n[${uiText.boletoLink}](${payment.boleto_url})\n\n${uiText.boletoExpires}`
          }]);
          toast.success(uiText.boletoToast);
        } else {
          setMessages(prev => [...prev, {
            role: "assistant",
            content: `${uiText.paymentProcessed} **${payment?.status || uiText.pending}**`
          }]);
        }
      } catch (e) {
        console.error("Payment error:", e);
        const errorMsg = e instanceof Error ? e.message : uiText.paymentError;
        setMessages(prev => [...prev, { role: "assistant", content: `❌ ${errorMsg}` }]);
      }
    }

    // WhatsApp Redirect
    const whatsappMatch = content.match(/\[ACTION_WHATSAPP_REDIRECT\]([\s\S]*?)\[\/ACTION_WHATSAPP_REDIRECT\]/);
    if (whatsappMatch) {
      try {
        const payload = JSON.parse(whatsappMatch[1].trim());
        if (payload.phone && payload.summary) {
          setWhatsappRedirect({ phone: payload.phone, summary: payload.summary });
        }
      } catch (e) {
        console.error("WhatsApp redirect parse error:", e);
      }
    }
  }, [storeUserId, queryClient, lastOrderId]);

  const sendHumanMessage = async (text: string) => {
    if (!text.trim() || !conversationId) return;

    const { error } = await supabase
      .from("support_messages")
      .insert({
        conversation_id: conversationId,
        sender_type: "customer",
        body: text.trim(),
      });

    if (error) {
      toast.error("Erro ao enviar mensagem");
      return;
    }
    setInput("");
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: Msg = { role: "user", content: text.trim() };
    const allMessages = [...messages, userMsg];
    setMessages(allMessages);
    setInput("");
    setIsLoading(true);

    let assistantSoFar = "";

    try {
      // Fetch customer behavior state for context
      let enrichedContext = "";
      if (customer) {
        const { data: customerState } = await supabase
          .from("customer_states")
          .select("state, intent_level, last_product_name, metadata")
          .eq("customer_id", customer.id)
          .eq("store_user_id", storeUserId)
          .maybeSingle();

        if (customerState) {
          const recent = (customerState.metadata as any)?.recent_events || [];
          enrichedContext = locale === "en"
            ? `
            CUSTOMER STATUS:
            - Current state: ${customerState.state}
            - Interest level: ${customerState.intent_level}
            - Last viewed product: ${customerState.last_product_name || "None"}
            - Recent events: ${recent.join(", ")}
            - Email: ${customer.email}
            - Phone: ${customer.phone || "Not informed"}
            Act like a warm sales assistant who understands this customer's preferences and converts their interest into a sale.
          `
            : locale === "es"
            ? `
            ESTADO DEL CLIENTE:
            - Estado actual: ${customerState.state}
            - Nivel de interés: ${customerState.intent_level}
            - Último producto visto: ${customerState.last_product_name || "Ninguno"}
            - Eventos recientes: ${recent.join(", ")}
            - Email: ${customer.email}
            - Teléfono: ${customer.phone || "No informado"}
            Actúa como una asesora cálida que entiende lo que le gusta y convierte su interés en venta.
          `
            : locale === "fr"
            ? `
            STATUT DU CLIENT :
            - État actuel : ${customerState.state}
            - Niveau d'intérêt : ${customerState.intent_level}
            - Dernier produit consulté : ${customerState.last_product_name || "Aucun"}
            - Événements récents : ${recent.join(", ")}
            - Email : ${customer.email}
            - Téléphone : ${customer.phone || "Non renseigné"}
            Agis comme une conseillère chaleureuse qui comprend ses goûts et transforme son intérêt en achat.
          `
            : `
            STATUS DO CLIENTE:
            - Estado atual: ${customerState.state}
            - Nível de interesse: ${customerState.intent_level}
            - Último produto visualizado: ${customerState.last_product_name || "Nenhum"}
            - Eventos recentes: ${recent.join(", ")}
            - Email: ${customer.email}
            - Telefone: ${customer.phone || "Não informado"}
            Aja como uma amiga que sabe o que ele gosta e tente converter o interesse dele em venda agora.
          `;
        } else {
          enrichedContext = `Email: ${customer.email}, Telefone: ${customer.phone || ""}`;
        }
      }

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: allMessages.map(m => ({ role: m.role, content: m.content })),
          storeUserId,
          customerName: customer?.name || "Cliente",
          customerContext: enrichedContext || undefined,
          locale,
          clientTime: new Date().toISOString(),
        }),

      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: uiText.connectionError }));
        throw new Error(err.error || `Erro ${resp.status}`);
      }

      if (!resp.body) throw new Error(uiText.noResponse);

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

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantSoFar += content;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
                }
                return [...prev, { role: "assistant", content: assistantSoFar }];
              });
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      if (assistantSoFar) {
        await processActions(assistantSoFar);
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : uiText.unknownError;
      setMessages(prev => [...prev, { role: "assistant", content: `❌ ${errorMsg}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  const quickActions = [
    { label: uiText.quickProducts, prompt: uiText.quickProductsPrompt },
    { label: uiText.quickPromos, prompt: uiText.quickPromosPrompt },
    { label: uiText.quickShipping, prompt: uiText.quickShippingPrompt },
    { label: uiText.quickOrder, prompt: uiText.quickOrderPrompt },
  ];

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed z-50 h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all flex items-center justify-center bottom-36 md:bottom-[5.5rem] right-6 animate-fade-in"
        style={{ backgroundColor: accentColor }}
        title={uiText.title}
      >
        <MessageCircle className="h-6 w-6 text-white" />
      </button>
    );
  }

  return (
    <div className="fixed inset-0 sm:inset-auto sm:bottom-6 sm:left-6 z-50 w-full sm:w-[380px] h-full sm:h-[540px] sm:max-h-[540px] flex flex-col sm:rounded-2xl border-0 sm:border border-border bg-card shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ backgroundColor: accentColor }}>
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9 ring-2 ring-white/30">
            {aiAvatarUrl ? (
              <AvatarImage src={aiAvatarUrl} alt={displayName} className="object-cover" />
            ) : null}
            <AvatarFallback className="bg-white/20 text-white text-xs font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-semibold text-white">{displayName}</p>
            <p className="text-xs text-white/80">{uiText.subtitle}</p>
          </div>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20" onClick={() => setOpen(false)}>
            <Minimize2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20" onClick={() => { setMessages([]); setOpen(false); }}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/30">
        {messages.length === 0 && (
          <div className="space-y-4">
            <div className="flex flex-col items-center text-center space-y-3 py-4">
              <Avatar className="h-16 w-16 ring-2 shadow-md" style={{ ['--tw-ring-color' as any]: accentColor + "33" }}>
                {aiAvatarUrl ? (
                  <AvatarImage src={aiAvatarUrl} alt={displayName} className="object-cover" />
                ) : null}
                <AvatarFallback className="text-lg font-bold" style={{ backgroundColor: accentColor + "15", color: accentColor }}>
                  {initials}
                </AvatarFallback>
              </Avatar>
              <h3 className="font-semibold text-foreground">{uiText.welcome}</h3>
              <p className="text-sm text-muted-foreground px-4">
                {uiText.intro}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {quickActions.map((action) => (
                <Button
                  key={action.label}
                  variant="outline"
                  className="justify-start text-xs h-auto py-2.5 px-3 whitespace-normal text-left border-border/60 hover:border-primary/50"
                  onClick={() => sendMessage(action.prompt)}
                >
                  {action.label}
                </Button>
              ))}
            </div>
          </div>
        )}

        {whatsappRedirect && (
          <div className="flex justify-center px-2">
            <a
              href={`https://wa.me/${whatsappRedirect.phone.replace(/\D/g, "")}?text=${encodeURIComponent(whatsappRedirect.summary)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg transition-all hover:scale-105 w-full justify-center"
              style={{ backgroundColor: "#25D366" }}
              onClick={() => setWhatsappRedirect(null)}
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              {uiText.whatsapp}
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`flex gap-2.5 max-w-[85%] ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
              {msg.role === "user" ? (
                <div className="h-7 w-7 rounded-full flex items-center justify-center shrink-0 text-white" style={{ backgroundColor: accentColor }}>
                  <User className="h-3.5 w-3.5" />
                </div>
              ) : (
                <Avatar className="h-7 w-7 shrink-0">
                  {aiAvatarUrl ? (
                    <AvatarImage src={aiAvatarUrl} alt={displayName} className="object-cover" />
                  ) : null}
                  <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                    <Bot className="h-3.5 w-3.5" />
                  </AvatarFallback>
                </Avatar>
              )}
              <div className={`rounded-2xl px-3.5 py-2.5 text-sm shadow-sm ${
                msg.role === "user" 
                  ? "text-white" 
                  : "bg-card border border-border"
              }`} style={msg.role === "user" ? { backgroundColor: accentColor } : undefined}>
                <div className="prose prose-sm dark:prose-invert break-words max-w-full">
                  <ReactMarkdown>{cleanContent(msg.content)}</ReactMarkdown>
                </div>
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="flex gap-2.5 max-w-[85%]">
              <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                <Bot className="h-3.5 w-3.5" />
              </div>
              <div className="bg-card border border-border rounded-2xl px-3.5 py-2.5 flex items-center gap-2 shadow-sm">
                <Loader2 className="h-4 w-4 animate-spin" style={{ color: accentColor }} />
                <span className="text-xs text-muted-foreground">{uiText.typing}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-3 bg-card border-t border-border">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={uiText.placeholder}
            onKeyDown={(e) => e.key === "Enter" && sendMessage(input)}
            className="flex-1 text-sm"
          />
          <Button
            onClick={() => sendMessage(input)}
            disabled={isLoading}
            className="shrink-0 h-10 w-10"
            size="icon"
            style={{ backgroundColor: accentColor }}
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
