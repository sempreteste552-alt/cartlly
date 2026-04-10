import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Send, Loader2, MessageCircle, Bot, User, Minimize2, ShoppingBag, ExternalLink } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useCustomerAuth } from "@/hooks/useCustomerAuth";
import { useLojaContext } from "@/pages/loja/LojaLayout";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

type Msg = { role: "user" | "assistant"; content: string };

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
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);
  const [whatsappRedirect, setWhatsappRedirect] = useState<{ phone: string; summary: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { customer } = useCustomerAuth();
  const lojaCtx = useLojaContext();
  const queryClient = useQueryClient();

  const displayName = aiName || "Assistente";
  const initials = displayName.slice(0, 2).toUpperCase();
  const accentColor = primaryColor || "#6d28d9";

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
            const addressInfo = `Endereço encontrado: ${data.logradouro || ""}, ${data.bairro || ""}, ${data.localidade || ""} - ${data.uf || ""}, CEP: ${cep}`;
            setMessages(prev => [...prev, { role: "assistant", content: `📍 **Endereço encontrado:**\n\n🏠 **Rua:** ${data.logradouro || "Não encontrada"}\n🏘️ **Bairro:** ${data.bairro || "Não encontrado"}\n🏙️ **Cidade:** ${data.localidade || ""} - ${data.uf || ""}\n\nAgora me informe o **número** da sua casa/apartamento e o **complemento** (se houver).` }]);
          } else {
            setMessages(prev => [...prev, { role: "assistant", content: "❌ CEP não encontrado. Por favor, verifique e tente novamente." }]);
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
          content: `🎉 **Pedido criado com sucesso!**\n\n📋 **Número:** #${orderId}\n💰 **Total:** R$ ${total.toFixed(2)}\n📦 **Status:** Pendente\n\n${trackToken ? `🔍 **Rastreie seu pedido:** Use o código \`${trackToken}\` na página de rastreio.` : ""}\n\nObrigado pela sua compra! 🛍️`
        }]);

        toast.success("Pedido criado com sucesso!");
        queryClient.invalidateQueries({ queryKey: ["orders"] });
      } catch (e) {
        console.error("Create order error:", e);
        setMessages(prev => [...prev, { role: "assistant", content: "❌ Erro ao processar o pedido. Tente novamente." }]);
      }
    }

    // Payment Processing
    const paymentMatch = content.match(/\[ACTION_PAYMENT\]([\s\S]*?)\[\/ACTION_PAYMENT\]/);
    if (paymentMatch) {
      try {
        const payload = JSON.parse(paymentMatch[1].trim());
        const orderId = payload.order_id || lastOrderId;
        if (!orderId) {
          setMessages(prev => [...prev, { role: "assistant", content: "❌ Nenhum pedido encontrado para processar o pagamento." }]);
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
        if (!response.ok) throw new Error(data.error || "Erro ao processar pagamento");

        const payment = data.payment;
        if (payload.method === "pix" && payment?.pix_qr_code) {
          const qrBase64 = payment.pix_qr_code_base64;
          const pixCode = payment.pix_qr_code;
          setMessages(prev => [...prev, {
            role: "assistant",
            content: `✅ **PIX gerado com sucesso!**\n\n${qrBase64 ? `![QR Code PIX](data:image/png;base64,${qrBase64})` : ""}\n\n📋 **Código PIX (copie e cole):**\n\`\`\`\n${pixCode}\n\`\`\`\n\n⏰ O PIX expira em 30 minutos. Após o pagamento, seu pedido será processado automaticamente!`
          }]);
          toast.success("PIX gerado! Escaneie o QR Code para pagar.");
        } else if (payment?.status === "approved") {
          setMessages(prev => [...prev, {
            role: "assistant",
            content: "✅ **Pagamento aprovado!** Seu pedido está sendo processado. Obrigado! 🎉"
          }]);
          toast.success("Pagamento aprovado!");
        } else if (payload.method === "boleto" && payment?.boleto_url) {
          setMessages(prev => [...prev, {
            role: "assistant",
            content: `📄 **Boleto gerado com sucesso!**\n\n[📥 Clique aqui para visualizar/baixar o boleto](${payment.boleto_url})\n\n⏰ O boleto vence em 3 dias úteis.`
          }]);
          toast.success("Boleto gerado!");
        } else {
          setMessages(prev => [...prev, {
            role: "assistant",
            content: `💳 Pagamento processado! Status: **${payment?.status || "pendente"}**`
          }]);
        }
      } catch (e) {
        console.error("Payment error:", e);
        const errorMsg = e instanceof Error ? e.message : "Erro ao processar pagamento";
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
          enrichedContext = `
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
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Erro de conexão" }));
        throw new Error(err.error || `Erro ${resp.status}`);
      }

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
      const errorMsg = e instanceof Error ? e.message : "Erro desconhecido";
      setMessages(prev => [...prev, { role: "assistant", content: `❌ ${errorMsg}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  const quickActions = [
    { label: "🛍️ Ver produtos", prompt: "Quais produtos vocês têm disponíveis?" },
    { label: "🏷️ Promoções", prompt: "Tem algum cupom de desconto ou promoção?" },
    { label: "🚚 Frete", prompt: "Como funciona a entrega? Quais regiões atendem?" },
    { label: "📦 Fazer pedido", prompt: "Quero fazer um pedido!" },
  ];

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed z-50 h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all flex items-center justify-center bottom-36 md:bottom-[5.5rem] right-6 animate-fade-in"
        style={{ backgroundColor: accentColor }}
        title="Chat com IA"
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
            <p className="text-xs text-white/80">Assistente de compras</p>
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
              <h3 className="font-semibold text-foreground">Olá! Bem-vindo à {storeName}! 👋</h3>
              <p className="text-sm text-muted-foreground px-4">
                Sou {displayName}, seu assistente de compras. Posso ajudar a encontrar produtos, calcular frete e finalizar seu pedido!
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
              Continuar pelo WhatsApp
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
                <span className="text-xs text-muted-foreground">Digitando...</span>
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
            placeholder="Digite sua mensagem..."
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
