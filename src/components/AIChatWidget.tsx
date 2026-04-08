import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle, X, Send, Loader2, Sparkles, Bot, User, Minimize2, Lock, Settings2, ImagePlus } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useProducts } from "@/hooks/useProducts";
import { useCategories } from "@/hooks/useCategories";
import { useCoupons } from "@/hooks/useCoupons";
import { useOrders } from "@/hooks/useOrders";
import { useStoreSettings } from "@/hooks/useStoreSettings";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

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

const AI_SETTINGS_KEY = "ai_chat_settings";

function loadAISettings() {
  try {
    const raw = localStorage.getItem(AI_SETTINGS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { name: "Assistente IA", avatarUrl: "" };
}

function saveAISettings(settings: { name: string; avatarUrl: string }) {
  localStorage.setItem(AI_SETTINGS_KEY, JSON.stringify(settings));
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Strip action blocks from visible text
function cleanContent(content: string): string {
  return content
    .replace(/\[ACTION_PUSH\][\s\S]*?\[\/ACTION_PUSH\]/g, "")
    .replace(/\[ACTION_COUPON\][\s\S]*?\[\/ACTION_COUPON\]/g, "")
    // Legacy format cleanup
    .replace(/```action:\w+\s*\n[\s\S]*?```/g, "")
    .trim();
}

export function AIChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aiSettings, setAiSettings] = useState(loadAISettings);
  const [tempName, setTempName] = useState(aiSettings.name);
  const [tempAvatar, setTempAvatar] = useState(aiSettings.avatarUrl);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { isLocked } = usePlanFeatures();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const aiLocked = isLocked("ai_tools");

  const { data: products } = useProducts();
  const { data: categories } = useCategories();
  const { data: coupons } = useCoupons();
  const { data: orders } = useOrders();
  const { data: settings } = useStoreSettings();

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
      aiName: aiSettings.name,
    };
  }, [products, categories, coupons, orders, settings, aiSettings.name]);

  // Process AI action commands embedded in responses
  const processAIActions = useCallback(async (content: string) => {
    // New format: [ACTION_PUSH]{...}[/ACTION_PUSH]
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

    // Legacy format support
    const actionRegex = /```action:(\w+)\s*\n([\s\S]*?)```/g;
    let match;
    while ((match = actionRegex.exec(content)) !== null) {
      const actionType = match[1];
      try {
        const payload = JSON.parse(match[2].trim());
        if (actionType === "send_push" && user) {
          const resp = await supabase.functions.invoke("send-push-customers", {
            body: { title: payload.title, body: payload.body, store_user_id: user.id },
          });
          if (resp.error) toast.error("Erro ao enviar push: " + resp.error.message);
          else toast.success(`✅ Push enviado para ${resp.data?.sent || 0} clientes!`);
        }
        if (actionType === "create_coupon" && user) {
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
          if (error) toast.error("Erro ao criar cupom: " + error.message);
          else {
            toast.success(`✅ Cupom ${payload.code || ""} criado!`);
            queryClient.invalidateQueries({ queryKey: ["coupons"] });
          }
        }
      } catch (e) {
        console.error("Legacy action parse error:", e);
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

  const saveSettings = () => {
    const newSettings = { name: tempName.trim() || "Assistente IA", avatarUrl: tempAvatar.trim() };
    setAiSettings(newSettings);
    saveAISettings(newSettings);
    setSettingsOpen(false);
    toast.success("Configurações da IA salvas!");
  };

  if (aiLocked) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          size="icon"
          className="h-14 w-14 rounded-full shadow-lg opacity-50 cursor-not-allowed"
          title="Chat IA bloqueado — Faça upgrade do plano"
          disabled
        >
          <Lock className="h-6 w-6" />
        </Button>
      </div>
    );
  }

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: Msg = { role: "user", content: text.trim() };
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

      // Flush remaining
      if (textBuffer.trim()) {
        for (const raw of textBuffer.split("\n")) {
          if (!raw || !raw.startsWith("data: ")) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
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
          } catch {}
        }
      }

      // Process any action blocks in the final response
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

  const aiInitials = aiSettings.name.slice(0, 2).toUpperCase();

  return (
    <>
      <div className="fixed bottom-6 right-6 z-50 w-[calc(100vw-2rem)] sm:w-[400px] h-[calc(100vh-6rem)] sm:h-[560px] max-h-[560px] flex flex-col rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-primary text-primary-foreground">
          <div className="flex items-center gap-2">
            <Avatar className="h-8 w-8">
              {aiSettings.avatarUrl ? (
                <AvatarImage src={aiSettings.avatarUrl} alt={aiSettings.name} />
              ) : null}
              <AvatarFallback className="bg-primary-foreground/20 text-primary-foreground text-xs">
                {aiInitials}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-semibold">{aiSettings.name}</p>
              <p className="text-xs opacity-80">Gerencia sua loja com IA</p>
            </div>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20" onClick={() => { setTempName(aiSettings.name); setTempAvatar(aiSettings.avatarUrl); setSettingsOpen(true); }}>
              <Settings2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20" onClick={() => setMessages([])}>
              <Minimize2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="space-y-4">
              <div className="text-center py-4">
                <Avatar className="h-16 w-16 mx-auto mb-3">
                  {aiSettings.avatarUrl ? (
                    <AvatarImage src={aiSettings.avatarUrl} alt={aiSettings.name} />
                  ) : null}
                  <AvatarFallback className="bg-primary/10 text-primary text-lg">
                    {aiInitials}
                  </AvatarFallback>
                </Avatar>
                <p className="text-sm font-medium text-foreground">Olá! Sou {aiSettings.name}</p>
                <p className="text-xs text-muted-foreground mt-1">Posso enviar promoções, criar cupons, analisar vendas e muito mais</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {QUICK_ACTIONS.map((action) => (
                  <button
                    key={action.label}
                    onClick={() => sendMessage(action.prompt)}
                    className="rounded-lg border border-border p-2.5 text-left hover:border-primary/50 hover:bg-primary/5 transition-colors"
                  >
                    <span className="text-xs">{action.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className="flex-shrink-0 mt-1">
                  <Avatar className="h-7 w-7">
                    {aiSettings.avatarUrl ? (
                      <AvatarImage src={aiSettings.avatarUrl} alt={aiSettings.name} />
                    ) : null}
                    <AvatarFallback className="bg-primary/10 text-primary text-[10px]">
                      {aiInitials}
                    </AvatarFallback>
                  </Avatar>
                </div>
              )}
              <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground"
              }`}>
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5">
                    <ReactMarkdown>{cleanContent(msg.content)}</ReactMarkdown>
                  </div>
                ) : (
                  <p>{msg.content}</p>
                )}
              </div>
              {msg.role === "user" && (
                <div className="flex-shrink-0 mt-1">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="bg-primary text-primary-foreground text-[10px]">
                      <User className="h-3.5 w-3.5" />
                    </AvatarFallback>
                  </Avatar>
                </div>
              )}
            </div>
          ))}

          {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
            <div className="flex gap-2">
              <Avatar className="h-7 w-7">
                {aiSettings.avatarUrl ? (
                  <AvatarImage src={aiSettings.avatarUrl} alt={aiSettings.name} />
                ) : null}
                <AvatarFallback className="bg-primary/10 text-primary text-[10px]">
                  {aiInitials}
                </AvatarFallback>
              </Avatar>
              <div className="bg-muted rounded-xl px-3 py-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-border p-3">
          <form
            onSubmit={(e) => { e.preventDefault(); sendMessage(input); }}
            className="flex gap-2"
          >
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pergunte algo ou peça uma ação..."
              disabled={isLoading}
              className="flex-1 text-sm"
            />
            <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>

      {/* AI Settings Dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Personalizar Assistente IA</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex justify-center">
              <Avatar className="h-20 w-20">
                {tempAvatar ? <AvatarImage src={tempAvatar} alt="Preview" /> : null}
                <AvatarFallback className="bg-primary/10 text-primary text-xl">
                  {(tempName || "IA").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </div>
            <div className="space-y-2">
              <Label>Nome da IA</Label>
              <Input value={tempName} onChange={(e) => setTempName(e.target.value)} placeholder="Assistente IA" maxLength={30} />
            </div>
            <div className="space-y-2">
              <Label>Avatar da IA</Label>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
              />
              <div className="flex gap-2 items-center">
                <Button variant="outline" size="sm" onClick={() => avatarInputRef.current?.click()}>
                  Enviar imagem
                </Button>
                {tempAvatar && (
                  <Button variant="ghost" size="sm" onClick={() => setTempAvatar("")}>
                    Remover
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">JPG, PNG ou WebP (máx 2MB)</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSettingsOpen(false)}>Cancelar</Button>
              <Button onClick={saveSettings}>Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
