import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Send, Loader2, Sparkles, Bot, User, Minimize2, Lock, Settings2, ImagePlus } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useProducts } from "@/hooks/useProducts";
import { useCategories } from "@/hooks/useCategories";
import { useCoupons } from "@/hooks/useCoupons";
import { useOrders } from "@/hooks/useOrders";
import { useStoreSettings, useUpdateStoreSettings } from "@/hooks/useStoreSettings";
import { useTenantContext } from "@/hooks/useTenantContext";
import { canAccess } from "@/lib/planPermissions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { FeatureTutorialCard } from "@/components/admin/FeatureTutorialCard";

type MsgContent = string | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>;
type Msg = { role: "user" | "assistant"; content: MsgContent };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;

const QUICK_ACTIONS = [
  { label: "📊 Analisar vendas", prompt: "Analise meus dados de vendas e sugira ações para melhorar o faturamento" },
  { label: "🎯 Criar campanha", prompt: "Sugira uma campanha promocional para minha loja baseada nos produtos e histórico" },
  { label: "💡 Ideias de produtos", prompt: "Sugira novos produtos que eu poderia adicionar à minha loja" },
  { label: "🏷️ Estratégia de cupons", prompt: "Crie uma estratégia de cupons para aumentar conversão e ticket médio" },
  { label: "📢 Enviar promoção push", prompt: "Gere um texto de promoção e envie como notificação push para meus clientes" },
  { label: "🎟️ Criar cupom", prompt: "Crie um cupom de desconto de 10% com código PROMO10 para minha loja" },
];

const AI_SETTINGS_DEFAULT = { name: "Assistente IA", avatarUrl: "" };

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Extract text from MsgContent
function getTextContent(content: MsgContent): string {
  if (typeof content === "string") return content;
  return content.filter((p) => p.type === "text").map((p) => (p as any).text).join("");
}

// Strip action blocks from visible text
function cleanContent(content: string): string {
  return content
    .replace(/\[ACTION_PUSH\][\s\S]*?\[\/ACTION_PUSH\]/g, "")
    .replace(/\[ACTION_COUPON\][\s\S]*?\[\/ACTION_COUPON\]/g, "")
    .replace(/```action:\w+\s*\n[\s\S]*?```/g, "")
    .trim();
}

export function AIChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const chatImageInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { ctx } = useTenantContext();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const aiLocked = !canAccess("ai_tools", ctx);

  const { data: products } = useProducts();
  const { data: categories } = useCategories();
  const { data: coupons } = useCoupons();
  const { data: orders } = useOrders();
  const { data: settings } = useStoreSettings();
  const updateSettings = useUpdateStoreSettings();

  const aiName = (settings as any)?.ai_name || AI_SETTINGS_DEFAULT.name;
  const aiAvatarUrl = (settings as any)?.ai_avatar_url || AI_SETTINGS_DEFAULT.avatarUrl;

  const [tempName, setTempName] = useState(aiName);
  const [tempAvatar, setTempAvatar] = useState(aiAvatarUrl);

  // Sync temp state when settings are loaded/updated
  useEffect(() => {
    if (settings) {
      setTempName((settings as any).ai_name || AI_SETTINGS_DEFAULT.name);
      setTempAvatar((settings as any).ai_avatar_url || AI_SETTINGS_DEFAULT.avatarUrl);
    }
  }, [settings]);

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

  const getStoreContext = useCallback(() => {
    const recentOrders = (orders || []).slice(0, 50).map((o: any) => ({
      id: o.id?.slice(0, 8),
      customer: o.customer_name,
      total: o.total,
      status: o.status,
      date: o.created_at?.slice(0, 10),
    }));

    const productList = (products || []).slice(0, 100).map((p: any) => ({
      id: p.id?.slice(0, 8),
      name: p.name,
      price: p.price,
      stock: p.stock,
      published: p.published,
      category: (p as any).categories?.name || null,
    }));

    const couponList = (coupons || []).map((c: any) => ({
      code: c.code,
      discount_type: c.discount_type,
      discount_value: c.discount_value,
      active: c.active,
      used_count: c.used_count,
      max_uses: c.max_uses,
      expires_at: c.expires_at?.slice(0, 10) || null,
    }));

    return {
      storeName: (settings as any)?.store_name || "",
      storeSlug: (settings as any)?.store_slug || "",
      storeWhatsapp: (settings as any)?.store_whatsapp || "",
      totalProducts: products?.length || 0,
      totalOrders: orders?.length || 0,
      totalRevenue: orders?.reduce((sum, o: any) => sum + (o.total || 0), 0) || 0,
      categories: categories?.map((c) => c.name) || [],
      activeCoupons: coupons?.filter((c: any) => c.active)?.length || 0,
      products: productList,
      recentOrders,
      coupons: couponList,
      sellViaWhatsapp: (settings as any)?.sell_via_whatsapp || false,
      paymentPix: (settings as any)?.payment_pix || false,
      paymentCreditCard: (settings as any)?.payment_credit_card || false,
      shippingEnabled: (settings as any)?.shipping_enabled || false,
      aiName: aiName,
    };
  }, [products, categories, coupons, orders, settings, aiName]);

  const processAIActions = useCallback(async (content: string) => {
    const pushMatch = content.match(/\[ACTION_PUSH\]([\s\S]*?)\[\/ACTION_PUSH\]/);
    if (pushMatch && user) {
      try {
        const payload = JSON.parse(pushMatch[1].trim());
        const resp = await supabase.functions.invoke("send-push-customers", {
          body: { title: payload.title, body: payload.body, store_user_id: user.id },
        });
        if (resp.error) {
          toast.error("Erro ao enviar push: " + resp.error.message);
        } else {
          toast.success(`✅ Push enviado para ${resp.data?.sent || 0} clientes!`);
        }
      } catch (e) {
        console.error("Push action error:", e);
      }
    }

    const couponMatch = content.match(/\[ACTION_COUPON\]([\s\S]*?)\[\/ACTION_COUPON\]/);
    if (couponMatch && user) {
      try {
        const payload = JSON.parse(couponMatch[1].trim());
        const { error } = await supabase.from("coupons").insert({
          user_id: user.id,
          code: payload.code?.toUpperCase() || "AI" + Date.now().toString(36).toUpperCase(),
          discount_type: payload.discount_type || "percentage",
          discount_value: payload.discount_value || 10,
          active: true,
          max_uses: payload.max_uses || null,
          min_order_value: payload.min_order_value || 0,
          expires_at: payload.expires_at || null,
        });
        if (error) {
          toast.error("Erro ao criar cupom: " + error.message);
        } else {
          toast.success(`✅ Cupom ${payload.code || ""} criado com sucesso!`);
          queryClient.invalidateQueries({ queryKey: ["coupons"] });
        }
      } catch (e) {
        console.error("Coupon action error:", e);
      }
    }
  }, [user, queryClient]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Imagem muito grande (máx 2MB)");
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      setTempAvatar(dataUrl);
    } catch {
      toast.error("Erro ao carregar imagem");
    }
  };

  const saveSettings = async () => {
    if (!settings?.id) return;
    try {
      await updateSettings.mutateAsync({
        id: settings.id,
        ai_name: tempName.trim() || "Assistente IA",
        ai_avatar_url: tempAvatar.trim()
      } as any);
      setSettingsOpen(false);
    } catch (error) {
      console.error("Error saving AI settings:", error);
    }
  };

  const handleChatImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      if (file.size > 4 * 1024 * 1024) { toast.error("Imagem muito grande (máx 4MB)"); continue; }
      try {
        const dataUrl = await fileToDataUrl(file);
        setPendingImages(prev => [...prev, dataUrl]);
      } catch { toast.error("Erro ao carregar imagem"); }
    }
    e.target.value = "";
  };

  const sendMessage = async (text: string) => {
    if ((!text.trim() && pendingImages.length === 0) || isLoading) return;

    const images = [...pendingImages];
    setPendingImages([]);

    let userContent: MsgContent;
    if (images.length > 0) {
      const parts: MsgContent = [];
      if (text.trim()) parts.push({ type: "text", text: text.trim() });
      for (const img of images) {
        parts.push({ type: "image_url", image_url: { url: img } });
      }
      userContent = parts;
    } else {
      userContent = text.trim();
    }

    const userMsg: Msg = { role: "user", content: userContent };
    const allMessages = [...messages, userMsg];
    setMessages(allMessages);
    setInput("");
    setIsLoading(true);

    let assistantSoFar = "";

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: allMessages.map((m) => ({ role: m.role, content: m.content })),
          storeContext: getStoreContext(),
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Erro de conexão" }));
        throw new Error(err.error || `Erro ${resp.status}`);
      }

      if (!resp.body) throw new Error("Sem resposta do servidor");

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
              setMessages((prev) => {
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
        await processAIActions(assistantSoFar);
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : "Erro desconhecido";
      setMessages((prev) => [...prev, { role: "assistant", content: `❌ ${errorMsg}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (aiLocked) {
    return (
      <div className="fixed bottom-4 right-4 z-50 w-72 rounded-2xl border border-border bg-card p-4 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <Lock className="h-5 w-5 text-primary" />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">Assistente IA bloqueado</p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Sem IA você responde mais devagar, analisa pior e vende abaixo do que poderia. Desbloqueie agora para usar automação e inteligência a seu favor.
            </p>
            <Button size="sm" className="gap-2" onClick={() => window.location.assign("/admin/plano?upgrade=PREMIUM")}>
              <Sparkles className="h-3.5 w-3.5" /> Desbloquear IA
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!open) {
    return (
      <Button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all"
        size="icon"
      >
        <Sparkles className="h-6 w-6" />
      </Button>
    );
  }

  const aiInitials = aiName.slice(0, 2).toUpperCase();

  return (
    <>
      <div className="fixed bottom-6 right-6 z-50 w-[calc(100vw-2rem)] sm:w-[400px] h-[calc(100vh-6rem)] sm:h-[560px] max-h-[560px] flex flex-col rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-primary text-primary-foreground">
          <div className="flex items-center gap-2">
            <Avatar className="h-8 w-8">
              {aiAvatarUrl ? (
                <AvatarImage src={aiAvatarUrl} alt={aiName} />
              ) : null}
              <AvatarFallback className="bg-primary-foreground/20 text-primary-foreground text-xs">
                {aiInitials}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-semibold">{aiName}</p>
              <p className="text-xs opacity-80">Gerencia sua loja com IA</p>
            </div>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20" onClick={() => { setTempName(aiName); setTempAvatar(aiAvatarUrl); setSettingsOpen(true); }}>
              <Settings2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20" onClick={() => setOpen(false)}>
              <Minimize2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20" onClick={() => { setMessages([]); setOpen(false); }}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/30">
          {messages.length === 0 && (
            <div className="space-y-4">
              <div className="flex flex-col items-center text-center space-y-2 py-4">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Bot className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold">Olá! Como posso ajudar hoje?</h3>
                <p className="text-sm text-muted-foreground px-4">
                  Eu sou seu assistente inteligente. Posso analisar suas vendas, sugerir produtos, criar cupons e muito mais.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {QUICK_ACTIONS.map((action) => (
                  <Button
                    key={action.label}
                    variant="outline"
                    className="justify-start text-xs h-auto py-2.5 px-3 whitespace-normal text-left border-border/60 hover:border-primary/50 hover:bg-primary/5"
                    onClick={() => sendMessage(action.prompt)}
                  >
                    {action.label}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`flex gap-3 max-w-[85%] ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                  {msg.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                </div>
                <div className={`rounded-2xl px-4 py-2.5 text-sm shadow-sm ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-card border border-border"}`}>
                  <div className="prose prose-sm dark:prose-invert break-words max-w-full">
                    <ReactMarkdown>
                      {cleanContent(getTextContent(msg.content))}
                    </ReactMarkdown>
                  </div>

                  {/* Show uploaded images in user messages */}
                  {msg.role === "user" && typeof msg.content !== "string" && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {msg.content.filter(p => p.type === "image_url").map((img: any, idx) => (
                        <img key={idx} src={img.image_url.url} className="h-20 w-20 object-cover rounded-md border border-white/20" alt="Upload" />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="flex gap-3 max-w-[85%]">
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="bg-card border border-border rounded-2xl px-4 py-2.5 flex items-center shadow-sm">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer with Input */}
        <div className="p-4 bg-card border-t border-border">
          {pendingImages.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {pendingImages.map((img, idx) => (
                <div key={idx} className="relative group">
                  <img src={img} className="h-12 w-12 object-cover rounded-md border border-border" alt="Pendente" />
                  <button 
                    onClick={() => setPendingImages(prev => prev.filter((_, i) => i !== idx))}
                    className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full p-0.5 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input 
              type="file" 
              accept="image/*" 
              multiple 
              className="hidden" 
              ref={chatImageInputRef} 
              onChange={handleChatImageUpload} 
            />
            <Button 
              variant="outline" 
              size="icon" 
              className="shrink-0 h-10 w-10" 
              onClick={() => chatImageInputRef.current?.click()}
            >
              <ImagePlus className="h-5 w-5" />
            </Button>
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Digite sua mensagem..."
              onKeyDown={(e) => e.key === "Enter" && sendMessage(input)}
              className="flex-1"
            />
            <Button onClick={() => sendMessage(input)} disabled={isLoading} className="shrink-0 h-10 w-10" size="icon">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Settings Dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Personalizar Assistente IA</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="flex flex-col items-center gap-4">
              <Avatar className="h-24 w-24 border-2 border-primary/20">
                {tempAvatar ? (
                  <AvatarImage src={tempAvatar} alt={tempName} />
                ) : null}
                <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                  {tempName.slice(0, 2).toUpperCase() || "AI"}
                </AvatarFallback>
              </Avatar>
              <input 
                type="file" 
                accept="image/*" 
                className="hidden" 
                ref={avatarInputRef} 
                onChange={handleAvatarUpload} 
              />
              <Button variant="outline" size="sm" onClick={() => avatarInputRef.current?.click()}>
                Alterar Avatar
              </Button>
            </div>
            
            <div className="space-y-2">
              <Label>Nome do Assistente</Label>
              <Input 
                value={tempName} 
                onChange={(e) => setTempName(e.target.value)} 
                placeholder="Ex: Cartlly Bot, Maria, Suporte IA..." 
              />
            </div>

            <div className="pt-2">
              <Button onClick={saveSettings} className="w-full" disabled={updateSettings.isPending}>
                {updateSettings.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar Alterações
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
