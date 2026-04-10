import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Send, Loader2, Sparkles, Bot, User, Minimize2, Lock, Settings2, ImagePlus, QrCode, Copy, CheckCircle2 } from "lucide-react";
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
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { FeatureTutorialCard } from "@/components/admin/FeatureTutorialCard";

type MsgContent = string | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>;
type Msg = { role: "user" | "assistant"; content: MsgContent };

interface PixQrData {
  qrCode: string;
  qrCodeBase64?: string;
  planName: string;
  transactionId?: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;

const QUICK_ACTIONS = [
  { label: "📊 Analisar vendas", prompt: "Analise meus dados de vendas e sugira ações para melhorar o faturamento" },
  { label: "🎯 Criar campanha", prompt: "Sugira uma campanha promocional para minha loja baseada nos produtos e histórico" },
  { label: "💡 Ideias de produtos", prompt: "Sugira novos produtos que eu poderia adicionar à minha loja" },
  { label: "🏷️ Estratégia de cupons", prompt: "Crie uma estratégia de cupons para aumentar conversão e ticket médio" },
  { label: "📢 Enviar promoção push", prompt: "Gere um texto de promoção e envie como notificação push para meus clientes" },
  { label: "🎟️ Criar cupom", prompt: "Crie um cupom de desconto de 10% com código PROMO10 para minha loja" },
  { label: "⬆️ Trocar de plano", prompt: "Quero fazer upgrade do meu plano. Quais planos estão disponíveis?" },
];

const AI_SETTINGS_DEFAULT = { name: "Assistente IA", avatarUrl: "", tone: "educada" };

const AI_TONE_OPTIONS = [
  { value: "educada", label: "🤗 Educada", desc: "Gentil, paciente e acolhedora" },
  { value: "profissional", label: "💼 Profissional", desc: "Direta, eficiente e empresarial" },
  { value: "divertida", label: "🎉 Divertida", desc: "Descontraída com emojis e humor" },
  { value: "formal", label: "🎩 Formal", desc: "Elegante e respeitosa com 'senhor(a)'" },
  { value: "amigavel", label: "❤️ Amigável", desc: "Calorosa, próxima e empática" },
];

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function getTextContent(content: MsgContent): string {
  if (typeof content === "string") return content;
  return content.filter((p) => p.type === "text").map((p) => (p as any).text).join("");
}

function cleanContent(content: string): string {
  return content
    .replace(/\[ACTION_PUSH\][\s\S]*?\[\/ACTION_PUSH\]/g, "")
    .replace(/\[ACTION_COUPON\][\s\S]*?\[\/ACTION_COUPON\]/g, "")
    .replace(/\[ACTION_SUBSCRIBE\][\s\S]*?\[\/ACTION_SUBSCRIBE\]/g, "")
    .replace(/```action:\w+\s*\n[\s\S]*?```/g, "")
    .trim();
}

const formatCpf = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  if (d.length <= 11) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
};

function PixQrCard({ data, onCopy }: { data: PixQrData; onCopy: () => void }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(data.qrCode);
    setCopied(true);
    onCopy();
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3 my-2">
      <div className="flex items-center gap-2 text-sm font-semibold text-primary">
        <QrCode className="h-4 w-4" />
        PIX — {data.planName}
      </div>
      {data.qrCodeBase64 && (
        <div className="flex justify-center">
          <img
            src={data.qrCodeBase64.startsWith("data:") ? data.qrCodeBase64 : `data:image/png;base64,${data.qrCodeBase64}`}
            alt="QR Code PIX"
            className="h-48 w-48 rounded-lg border border-border"
          />
        </div>
      )}
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground text-center">Escaneie o QR Code ou copie o código:</p>
        <div className="flex gap-2">
          <Input
            readOnly
            value={data.qrCode}
            className="text-xs font-mono"
          />
          <Button variant="outline" size="icon" className="shrink-0" onClick={handleCopy}>
            {copied ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function AIChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [pixData, setPixData] = useState<PixQrData | null>(null);
  const [cpfDialogOpen, setCpfDialogOpen] = useState(false);
  const [cpfValue, setCpfValue] = useState("");
  const [pendingSubscribe, setPendingSubscribe] = useState<{ plan_id: string; plan_name: string } | null>(null);
  const [subscribeLoading, setSubscribeLoading] = useState(false);
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

  // Fetch available plans
  const { data: plans } = useQuery({
    queryKey: ["tenant_plans_chat"],
    queryFn: async () => {
      const { data } = await supabase
        .from("tenant_plans")
        .select("id, name, price, max_products, max_orders_month, features")
        .eq("active", true)
        .order("price", { ascending: true });
      return data || [];
    },
  });

  const aiName = (settings as any)?.ai_name || AI_SETTINGS_DEFAULT.name;
  const aiAvatarUrl = (settings as any)?.ai_avatar_url || AI_SETTINGS_DEFAULT.avatarUrl;
  const aiTone = (settings as any)?.ai_chat_tone || AI_SETTINGS_DEFAULT.tone;

  const [tempName, setTempName] = useState(aiName);
  const [tempAvatar, setTempAvatar] = useState(aiAvatarUrl);
  const [tempTone, setTempTone] = useState(aiTone);

  useEffect(() => {
    if (settings) {
      setTempName((settings as any).ai_name || AI_SETTINGS_DEFAULT.name);
      setTempAvatar((settings as any).ai_avatar_url || AI_SETTINGS_DEFAULT.avatarUrl);
      setTempTone((settings as any).ai_chat_tone || AI_SETTINGS_DEFAULT.tone);
    }
  }, [settings]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, pixData]);

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
      plans: (plans || []).filter((p: any) => p.price > 0).map((p: any) => ({
        id: p.id,
        name: p.name,
        price: p.price,
      })),
      currentPlanName: ctx.planSlug,
      subscriptionStatus: ctx.subscriptionStatus,
      isTrial: ctx.isTrial,
      trialDaysLeft: ctx.trialDaysLeft,
    };
  }, [products, categories, coupons, orders, settings, aiName, plans, ctx]);

  const handleSubscribe = async (planId: string, planName: string, document: string) => {
    if (!user) return;
    setSubscribeLoading(true);
    try {
      const resp = await supabase.functions.invoke("amplopay-subscribe", {
        body: {
          user_id: user.id,
          plan_id: planId,
          payment_method: "PIX",
          document: document.replace(/\D/g, ""),
        },
      });

      if (resp.error) {
        toast.error("Erro ao gerar cobrança: " + resp.error.message);
        setMessages(prev => [...prev, { role: "assistant", content: `❌ Erro ao gerar QR Code: ${resp.error?.message}` }]);
        return;
      }

      const data = resp.data;
      if (data?.pix?.qrCode) {
        const pix: PixQrData = {
          qrCode: data.pix.qrCode,
          qrCodeBase64: data.pix.qrCodeBase64 || data.pix.image,
          planName: planName,
          transactionId: data.transaction_id,
        };
        setPixData(pix);
        setMessages(prev => [...prev, {
          role: "assistant",
          content: `✅ **QR Code PIX gerado com sucesso!**\n\nPlano: **${planName}**\n\nEscaneie o QR Code abaixo ou copie o código PIX para efetuar o pagamento. Após a confirmação, seu plano será ativado automaticamente! 🎉`,
        }]);
        toast.success("QR Code PIX gerado! Escaneie para pagar.");
      } else {
        toast.error("Erro: resposta do gateway sem QR Code");
        setMessages(prev => [...prev, { role: "assistant", content: "❌ Não foi possível gerar o QR Code. Tente novamente ou acesse a página de planos." }]);
      }
    } catch (e) {
      console.error("Subscribe error:", e);
      toast.error("Erro ao processar assinatura");
    } finally {
      setSubscribeLoading(false);
    }
  };

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

    const subscribeMatch = content.match(/\[ACTION_SUBSCRIBE\]([\s\S]*?)\[\/ACTION_SUBSCRIBE\]/);
    if (subscribeMatch && user) {
      try {
        const payload = JSON.parse(subscribeMatch[1].trim());
        const doc = (payload.document || "").replace(/\D/g, "");
        if (doc.length >= 11) {
          // CPF/CNPJ already provided by AI — generate QR code directly
          await handleSubscribe(payload.plan_id, payload.plan_name, doc);
        } else {
          // Fallback: ask for CPF via dialog
          setPendingSubscribe({ plan_id: payload.plan_id, plan_name: payload.plan_name });
          setCpfValue("");
          setCpfDialogOpen(true);
        }
      } catch (e) {
        console.error("Subscribe action error:", e);
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
        ai_avatar_url: tempAvatar.trim(),
        ai_chat_tone: tempTone || "educada",
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
    setPixData(null);

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

  if (!open) {
    return (
      <Button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all"
        size="icon"
      >
        <Sparkles className="h-6 w-6" />
      </Button>
    );
  }

  const aiInitials = aiName.slice(0, 2).toUpperCase();

  return (
    <>
      <div className="fixed inset-0 sm:inset-auto sm:bottom-6 sm:right-6 z-50 w-full sm:w-[400px] h-full sm:h-[560px] sm:max-h-[560px] flex flex-col sm:rounded-2xl border-0 sm:border border-border bg-card shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-primary text-primary-foreground">
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9 ring-2 ring-primary-foreground/30">
              {aiAvatarUrl ? (
                <AvatarImage src={aiAvatarUrl} alt={aiName} className="object-cover" />
              ) : null}
              <AvatarFallback className="bg-primary-foreground/20 text-primary-foreground text-xs font-bold">
                {aiInitials}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-semibold">{aiName}</p>
              <p className="text-xs opacity-80">Gerencia sua loja com IA</p>
            </div>
          </div>
          <div className="flex gap-1">
            {!aiLocked && (
              <Button variant="ghost" size="icon" className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20" onClick={() => { setTempName(aiName); setTempAvatar(aiAvatarUrl); setTempTone(aiTone); setSettingsOpen(true); }}>
                <Settings2 className="h-4 w-4" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20" onClick={() => setOpen(false)}>
              <Minimize2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20" onClick={() => { setMessages([]); setPixData(null); setOpen(false); }}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/30">
          {aiLocked ? (
            <div className="flex h-full min-h-[360px] items-center justify-center">
              <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 text-center shadow-sm">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                  <Lock className="h-6 w-6 text-primary" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-base font-semibold text-foreground">Assistente IA bloqueado</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Sem IA você responde no braço, demora para agir e deixa venda escapar. No <strong>Premium</strong> isso vira atendimento rápido, análise esperta e ação automática.
                  </p>
                </div>
                <Button size="sm" className="mt-4 gap-2" onClick={() => window.location.assign("/admin/plano?upgrade=PREMIUM")}>
                  <Sparkles className="h-3.5 w-3.5" /> Fazer upgrade para liberar
                </Button>
              </div>
            </div>
          ) : messages.length === 0 && (
            <div className="space-y-4">
              <div className="flex flex-col items-center text-center space-y-3 py-4">
                <Avatar className="h-16 w-16 ring-2 ring-primary/20 shadow-md">
                  {aiAvatarUrl ? (
                    <AvatarImage src={aiAvatarUrl} alt={aiName} className="object-cover" />
                  ) : null}
                  <AvatarFallback className="bg-primary/10 text-primary text-lg font-bold">
                    {aiInitials}
                  </AvatarFallback>
                </Avatar>
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

          {!aiLocked && messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`flex gap-3 max-w-[85%] ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                {msg.role === "user" ? (
                  <div className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 bg-primary text-primary-foreground">
                    <User className="h-4 w-4" />
                  </div>
                ) : (
                  <Avatar className="h-8 w-8 shrink-0">
                    {aiAvatarUrl ? (
                      <AvatarImage src={aiAvatarUrl} alt={aiName} className="object-cover" />
                    ) : null}
                    <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                      <Bot className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                )}
                <div className={`rounded-2xl px-4 py-2.5 text-sm shadow-sm ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-card border border-border"}`}>
                  <div className="prose prose-sm dark:prose-invert break-words max-w-full">
                    <ReactMarkdown>
                      {cleanContent(getTextContent(msg.content))}
                    </ReactMarkdown>
                  </div>

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

          {/* PIX QR Code inline */}
          {!aiLocked && pixData && (
            <div className="flex justify-start">
              <div className="flex gap-3 max-w-[85%]">
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <QrCode className="h-4 w-4" />
                </div>
                <PixQrCard data={pixData} onCopy={() => toast.success("Código PIX copiado!")} />
              </div>
            </div>
          )}

          {!aiLocked && (isLoading || subscribeLoading) && (
            <div className="flex justify-start">
              <div className="flex gap-3 max-w-[85%]">
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="bg-card border border-border rounded-2xl px-4 py-2.5 flex items-center gap-2 shadow-sm">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  {subscribeLoading && <span className="text-xs text-muted-foreground">Gerando QR Code...</span>}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer with Input */}
        {!aiLocked && (
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
            <Button onClick={() => sendMessage(input)} disabled={isLoading || subscribeLoading} className="shrink-0 h-10 w-10" size="icon">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-5 w-5" />}
            </Button>
          </div>
        </div>
        )}
      </div>

      {/* CPF Dialog for subscription */}
      <Dialog open={cpfDialogOpen} onOpenChange={setCpfDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5 text-primary" />
              Gerar PIX — {pendingSubscribe?.plan_name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Informe seu CPF ou CNPJ para gerar o QR Code PIX de pagamento:
            </p>
            <div className="space-y-2">
              <Label>CPF / CNPJ</Label>
              <Input
                value={cpfValue}
                onChange={(e) => setCpfValue(formatCpf(e.target.value))}
                placeholder="000.000.000-00"
                maxLength={18}
              />
            </div>
            <Button
              className="w-full"
              disabled={cpfValue.replace(/\D/g, "").length < 11 || subscribeLoading}
              onClick={async () => {
                if (!pendingSubscribe) return;
                setCpfDialogOpen(false);
                await handleSubscribe(pendingSubscribe.plan_id, pendingSubscribe.plan_name, cpfValue);
                setPendingSubscribe(null);
              }}
            >
              {subscribeLoading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gerando...</>
              ) : (
                <><QrCode className="mr-2 h-4 w-4" /> Gerar QR Code PIX</>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
