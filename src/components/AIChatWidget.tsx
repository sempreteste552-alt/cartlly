import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Send, Loader2, Sparkles, Bot, User, Minimize2, Lock, Settings2, ImagePlus, QrCode, Copy, CheckCircle2, Megaphone, Trash2, RotateCcw, FileText, Mic, MicOff } from "lucide-react";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import ReactMarkdown from "react-markdown";
import { useProducts } from "@/hooks/useProducts";
import { useCategories } from "@/hooks/useCategories";
import { useCoupons } from "@/hooks/useCoupons";
import { useOrders } from "@/hooks/useOrders";
import { useStoreSettings, useUpdateStoreSettings } from "@/hooks/useStoreSettings";
import { useStoreMarketingConfig, useUpdateStoreMarketingConfig } from "@/hooks/useStoreMarketingConfig";
import { useTenantContext } from "@/hooks/useTenantContext";
import { canAccess } from "@/lib/planPermissions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { normalizeDomain } from "@/lib/storeDomain";
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
  { label: "📣 Adicionar Faixa Promocional", prompt: "Crie uma faixa promocional para o topo da minha loja. Pergunte-me sobre cores, texto e link se necessário." },
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
  { value: "ceo_profissional", label: "🧠 Modo CEO", desc: "Estratégias de marketing e vendas agressivas" },
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
    .replace(/\[ACTION_UPDATE_PRODUCT\][\s\S]*?\[\/ACTION_UPDATE_PRODUCT\]/g, "")
    .replace(/\[ACTION_UPDATE_SETTINGS\][\s\S]*?\[\/ACTION_UPDATE_SETTINGS\]/g, "")
    .replace(/\[ACTION_MARKETING\][\s\S]*?\[\/ACTION_MARKETING\]/g, "")
    .replace(/\[ACTION_REMINDER\][\s\S]*?\[\/ACTION_REMINDER\]/g, "")
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
  const { slug } = useParams();
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
  const [pendingActions, setPendingActions] = useState<Record<number, any[]>>({});
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const chatImageInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const pendingVoiceRef = useRef<string | null>(null);
  const voiceRecorder = useVoiceRecorder({
    onTranscript: (text) => {
      pendingVoiceRef.current = text;
      setInput(text);
    },
  });
  const { ctx } = useTenantContext();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const aiLocked = !canAccess("ai_tools", ctx);

  const { data: products } = useProducts();
  const { data: categories } = useCategories();
  const { data: coupons } = useCoupons();
  const { data: orders } = useOrders();
  const { data: settings } = useStoreSettings();
  const { data: marketingConfig } = useStoreMarketingConfig();
  const updateSettings = useUpdateStoreSettings();
  const updateMarketing = useUpdateStoreMarketingConfig();

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

  // Fetch AI Work Summary
  const { data: aiSummary } = useQuery({
    queryKey: ["ai_work_summary", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_ai_work_summary", { p_user_id: user!.id });
      if (error) throw error;
      return data as any;
    },
    enabled: !!user,
  });

  // Fetch domains
  const { data: domains } = useQuery({
    queryKey: ["store_domains_chat", settings?.id],
    queryFn: async () => {
      if (!settings?.id) return [];
      const { data } = await supabase
        .from("store_domains")
        .select("*")
        .eq("store_id", settings.id);
      return data || [];
    },
    enabled: !!settings?.id,
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
      views: p.views || 0,
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

    // Calculate revenue breakdown by status
    const approvedOrders = (orders || []).filter((o: any) => !['cancelado', 'recusado', 'expirado'].includes(o.status));
    const cancelledOrders = (orders || []).filter((o: any) => o.status === 'cancelado');
    const pendingOrders = (orders || []).filter((o: any) => o.status === 'pendente');
    const approvedRevenue = approvedOrders.reduce((sum: number, o: any) => sum + (o.total || 0), 0);
    const avgTicket = approvedOrders.length > 0 ? approvedRevenue / approvedOrders.length : 0;

    const domainList = (domains || []).map((d: any) => ({
      hostname: d.hostname,
      status: d.status,
      is_primary: d.is_primary,
    }));

    return {
      storeName: (settings as any)?.store_name || "",
      storeDescription: (settings as any)?.store_description || "",
      marqueeText: (settings as any)?.marquee_text || "",
      storeSlug: (settings as any)?.store_slug || "",
      storeWhatsapp: (settings as any)?.store_whatsapp || "",
      storeCategory: (settings as any)?.store_category || "",
      totalProducts: products?.length || 0,
      totalOrders: orders?.length || 0,
      approvedOrders: approvedOrders.length,
      cancelledOrders: cancelledOrders.length,
      pendingOrders: pendingOrders.length,
      totalRevenue: approvedRevenue,
      avgTicket: Math.round(avgTicket * 100) / 100,
      categories: categories?.map((c) => c.name) || [],
      activeCoupons: coupons?.filter((c: any) => c.active)?.length || 0,
      products: productList,
      recentOrders,
      coupons: couponList,
      sellViaWhatsapp: (settings as any)?.sell_via_whatsapp || false,
      paymentPix: (settings as any)?.payment_pix || false,
      paymentCreditCard: (settings as any)?.payment_credit_card || false,
      shippingEnabled: (settings as any)?.shipping_enabled || false,
      marketing: {
        announcement_bar_enabled: marketingConfig?.announcement_bar_enabled || false,
        announcement_bar_text: marketingConfig?.announcement_bar_text || "",
        announcement_bar_bg_color: marketingConfig?.announcement_bar_bg_color || "#000000",
        announcement_bar_text_color: marketingConfig?.announcement_bar_text_color || "#ffffff",
      },
      aiName: aiName,
      aiTone: aiTone,
      plans: (plans || []).filter((p: any) => p.price > 0).map((p: any) => ({
        id: p.id,
        name: p.name,
        price: p.price,
      })),
      currentPlanName: ctx.planSlug,
      subscriptionStatus: ctx.subscriptionStatus,
      isTrial: ctx.isTrial,
      trialDaysLeft: ctx.trialDaysLeft,
      domains: domainList,
      primaryDomain: (domains || []).find((d: any) => d.is_primary)?.hostname || null,
    };
  }, [products, categories, coupons, orders, settings, aiName, plans, ctx, domains]);

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

  const processAIActions = useCallback(async (content: string, msgIndex: number) => {
    const actions: any[] = [];

    const extractActions = (
      regex: RegExp,
      mapPayload: (payload: any) => { type: string; label: string; payload: any }
    ) => {
      let match: RegExpExecArray | null;
      while ((match = regex.exec(content)) !== null) {
        try {
          const payload = JSON.parse(match[1].trim());
          actions.push(mapPayload(payload));
        } catch (e) {
          console.error("Action parse error:", e, match[0]);
        }
      }
    };

    extractActions(/\[ACTION_PUSH\]([\s\S]*?)\[\/ACTION_PUSH\]/g, (payload) => ({
      type: "push",
      label: `📢 Enviar Push${payload.title ? `: ${payload.title}` : " para Clientes"}`,
      payload,
    }));

    extractActions(/\[ACTION_COUPON\]([\s\S]*?)\[\/ACTION_COUPON\]/g, (payload) => ({
      type: "coupon",
      label: `🎟️ Criar Cupom ${payload.code || ""}`.trim(),
      payload,
    }));

    extractActions(/\[ACTION_SUBSCRIBE\]([\s\S]*?)\[\/ACTION_SUBSCRIBE\]/g, (payload) => ({
      type: "subscribe",
      label: `⬆️ Assinar ${payload.plan_name || "novo plano"}`,
      payload,
    }));

    extractActions(/\[ACTION_UPDATE_PRODUCT\]([\s\S]*?)\[\/ACTION_UPDATE_PRODUCT\]/g, (payload) => {
      const target = payload.product_name || payload.product_id || "produto";
      const fields = Object.keys(payload.updates || {});
      const stockDelta = payload.updates?.stock_delta;
      const stockLabel = typeof stockDelta === "number" ? ` | ajuste estoque: ${stockDelta > 0 ? "+" : ""}${stockDelta}` : "";
      return {
        type: "update_product",
        label: `📦 Atualizar ${target}${fields.length ? ` (${fields.join(", ")})` : ""}${stockLabel}`,
        payload,
      };
    });

    extractActions(/\[ACTION_UPDATE_SETTINGS\]([\s\S]*?)\[\/ACTION_UPDATE_SETTINGS\]/g, (payload) => ({
      type: "update_settings",
      label: `⚙️ Atualizar Loja${Object.keys(payload).length ? ` (${Object.keys(payload).join(", ")})` : ""}`,
      payload,
    }));

    extractActions(/\[ACTION_MARKETING\]([\s\S]*?)\[\/ACTION_MARKETING\]/g, (payload) => ({
      type: "marketing",
      label: `📣 Atualizar Banner/Marketing${Object.keys(payload).length ? ` (${Object.keys(payload).join(", ")})` : ""}`,
      payload,
    }));

    extractActions(/\[ACTION_REMINDER\]([\s\S]*?)\[\/ACTION_REMINDER\]/g, (payload) => ({
      type: "reminder",
      label: `⏰ Agendar Lembrete${payload.title ? `: ${payload.title}` : ""}`,
      payload,
    }));

    extractActions(/\[ACTION_DOMAIN_CONNECT\]([\s\S]*?)\[\/ACTION_DOMAIN_CONNECT\]/g, (payload) => ({
      type: "domain_connect",
      label: `🌐 Conectar domínio ${payload.domain || ""}`,
      payload,
    }));

    extractActions(/\[ACTION_DOMAIN_VERIFY\]([\s\S]*?)\[\/ACTION_DOMAIN_VERIFY\]/g, (payload) => ({
      type: "domain_verify",
      label: `🔍 Verificar domínio ${payload.domain || ""}`,
      payload,
    }));

    if (actions.length > 0) {
      setPendingActions((prev) => ({ ...prev, [msgIndex]: actions }));
    }
  }, []);

  const confirmAction = async (msgIndex: number, actionIndex: number) => {
    const action = pendingActions[msgIndex]?.[actionIndex];
    if (!action || !user) return;

    const normalizeText = (value?: string | null) =>
      (value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();

    try {
      if (action.type === "push") {
        const resp = await supabase.functions.invoke("send-push-customers", {
          body: { title: action.payload.title, body: action.payload.body, store_user_id: user.id },
        });
        if (resp.error) throw resp.error;
        toast.success(`✅ Push enviado para ${resp.data?.sent || 0} clientes!`);
      } else if (action.type === "coupon") {
        const { error } = await supabase.from("coupons").insert({
          user_id: user.id,
          code: action.payload.code?.toUpperCase() || "AI" + Date.now().toString(36).toUpperCase(),
          discount_type: action.payload.discount_type || "percentage",
          discount_value: action.payload.discount_value || 10,
          active: true,
          max_uses: action.payload.max_uses || null,
          min_order_value: action.payload.min_order_value || 0,
          expires_at: action.payload.expires_at || null,
        });
        if (error) throw error;
        toast.success(`✅ Cupom ${action.payload.code || ""} criado!`);
        queryClient.invalidateQueries({ queryKey: ["coupons"] });
      } else if (action.type === "subscribe") {
        const doc = (action.payload.document || "").replace(/\D/g, "");
        if (doc.length >= 11) {
          await handleSubscribe(action.payload.plan_id, action.payload.plan_name, doc);
        } else {
          setPendingSubscribe({ plan_id: action.payload.plan_id, plan_name: action.payload.plan_name });
          setCpfValue("");
          setCpfDialogOpen(true);
        }
      } else if (action.type === "update_product") {
        const shortId = typeof action.payload.product_id === "string" ? action.payload.product_id.trim() : "";
        const productName = typeof action.payload.product_name === "string" ? action.payload.product_name.trim() : "";

        let fullProduct = shortId
          ? (products || []).find((p: any) => p.id === shortId || p.id?.startsWith(shortId))
          : null;

        if (!fullProduct && productName) {
          fullProduct = (products || []).find((p: any) => normalizeText(p.name) === normalizeText(productName));
        }

        if (!fullProduct && productName) {
          fullProduct = (products || []).find((p: any) => {
            const currentName = normalizeText(p.name);
            const targetName = normalizeText(productName);
            return currentName.includes(targetName) || targetName.includes(currentName);
          });
        }

        if (!fullProduct) throw new Error("Produto não encontrado. Peça para a IA usar o nome exato do produto.");

        const allowedFields = ["price", "stock", "name", "description", "published", "original_price"];
        const updates: Record<string, any> = {};
        for (const key of allowedFields) {
          if (action.payload.updates?.[key] !== undefined) updates[key] = action.payload.updates[key];
        }

        const stockDelta = Number(action.payload.updates?.stock_delta);
        if (!Number.isNaN(stockDelta) && action.payload.updates?.stock_delta !== undefined) {
          updates.stock = Math.max(0, Number(fullProduct.stock || 0) + stockDelta);
        }

        if (Object.keys(updates).length === 0) {
          throw new Error("Nenhum campo válido foi enviado para atualizar o produto.");
        }

        const { error } = await supabase
          .from("products")
          .update(updates)
          .eq("id", fullProduct.id)
          .eq("user_id", user.id)
          .select("id, name, stock")
          .single();

        if (error) throw error;
        toast.success(`✅ Produto ${fullProduct.name} atualizado!`);
        await queryClient.invalidateQueries({ queryKey: ["products"] });
      } else if (action.type === "update_settings") {
        if (settings?.id) {
          const { error } = await supabase
            .from("store_settings")
            .update({ ...action.payload, updated_at: new Date().toISOString() })
            .eq("id", settings.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("store_settings").insert({
            user_id: user.id,
            ...action.payload,
          });
          if (error) throw error;
        }

        toast.success("✅ Configurações atualizadas!");
        queryClient.invalidateQueries({ queryKey: ["store_settings"] });
      } else if (action.type === "marketing") {
        if (marketingConfig?.id) {
          await updateMarketing.mutateAsync({
            id: marketingConfig.id,
            ...action.payload,
          });
        } else {
          const { error } = await supabase.from("store_marketing_config" as any).insert({
            user_id: user.id,
            ...action.payload,
          });
          if (error) throw error;
          toast.success("✅ Banner/marketing criado!");
          queryClient.invalidateQueries({ queryKey: ["store_marketing_config"] });
        }
      } else if (action.type === "reminder") {
        const { error } = await supabase.from("ai_scheduled_tasks").insert({
          user_id: user.id,
          task_type: "admin_reminder",
          scheduled_at: action.payload.scheduled_at,
          payload: { title: action.payload.title, body: action.payload.body },
          status: "pending",
        });
        if (error) throw error;
        toast.success("✅ Lembrete agendado!");
        queryClient.invalidateQueries({ queryKey: ["ai-scheduled-tasks"] });
      } else if (action.type === "domain_connect") {
        if (!settings?.id) throw new Error("Configurações da loja não encontradas.");
        
        let cleanDomain = normalizeDomain(action.payload.domain);
        if (!cleanDomain || !cleanDomain.includes(".")) {
          throw new Error("Informe um domínio válido (ex: minhaloja.com.br)");
        }

        const { data: existing } = await supabase
          .from("store_domains")
          .select("id")
          .eq("hostname", cleanDomain)
          .maybeSingle();

        if (existing) {
          throw new Error("Este domínio já está vinculado a uma loja.");
        }

        const { error } = await supabase.from("store_domains").insert({
          store_id: settings.id,
          hostname: cleanDomain,
          is_primary: (domains?.length || 0) === 0,
          status: 'pending_dns'
        });

        if (error) throw error;

        toast.success(`✅ Domínio ${cleanDomain} adicionado!`);
        queryClient.invalidateQueries({ queryKey: ["store_domains_chat"] });
        
        // Fetch the domain record we just created to get the verification token
        const { data: newDomainData } = await supabase
          .from("store_domains")
          .select("verification_token")
          .eq("hostname", cleanDomain)
          .single();

        const verifyToken = newDomainData?.verification_token || settings.id || "(token pendente)";
        setMessages(prev => [...prev, { 
          role: "assistant", 
          content: `✅ **Domínio ${cleanDomain} adicionado com sucesso!**\n\nAgora configure os seguintes registros DNS no painel do seu provedor:\n\n📋 **Registros DNS necessários:**\n\n| Tipo | Nome/Host | Valor |\n|------|-----------|-------|\n| **CNAME** | www | www.cartlly.lovable.app |\n| **A** | @ | 185.158.133.1 |\n| **TXT** | _lovable | lovable_verify=${verifyToken} |\n\n**📖 Passo a passo:**\n1. Acesse o painel do seu provedor de domínio (Registro.br, GoDaddy, Hostinger, Cloudflare, etc)\n2. Vá em **"Gerenciar DNS"** ou **"Zona DNS"**\n3. Adicione cada registro acima exatamente como indicado\n4. Se já existir um registro CNAME ou A para www ou @, **edite-o**\n5. Salve as alterações\n6. Aguarde a propagação (5 min a 24h)\n7. Quando terminar, me avise aqui que eu verifico! 🔍\n\n⚠️ **Se usar Cloudflare**, deixe a nuvem **cinza** (DNS only, sem proxy).` 
        }]);
      } else if (action.type === "domain_verify") {
        if (!settings?.id) throw new Error("Configurações da loja não encontradas.");
        
        const cleanDomain = normalizeDomain(action.payload.domain);
        const domainRecord = (domains || []).find((d: any) => d.hostname === cleanDomain);

        if (!domainRecord) {
          throw new Error("Este domínio não está vinculado a sua loja.");
        }

        toast.info(`Verificando domínio ${cleanDomain}...`);
        
        const { data, error } = await supabase.functions.invoke("verify-domain", {
          body: { 
            settingsId: settings.id, 
            domain: cleanDomain,
            domainId: domainRecord.id
          },
        });
        
        if (error) throw error;

        if (data?.status === "active") {
          toast.success(`🎉 Domínio ${cleanDomain} verificado e online!`);
          setMessages(prev => [...prev, { 
            role: "assistant", 
            content: `🎉 **Boas notícias!** O domínio **${cleanDomain}** foi verificado com sucesso e já está online. Sua loja agora é acessível por este endereço profissional! 🚀` 
          }]);
        } else {
          toast.warning("Status atualizado, mas ainda há pendências.");
          setMessages(prev => [...prev, { 
            role: "assistant", 
            content: `⚠️ O domínio **${cleanDomain}** ainda não está totalmente ativo.\n\nStatus atual: **${data?.status || 'Processando'}**\n\nCertifique-se de que os registros DNS (CNAME e TXT) foram inseridos corretamente no seu provedor. A propagação pode levar de alguns minutos a 24 horas.` 
          }]);
        }
        
        queryClient.invalidateQueries({ queryKey: ["store_domains_chat"] });
        queryClient.invalidateQueries({ queryKey: ["store_settings"] });
      }

      setPendingActions((prev) => {
        const newActions = [...(prev[msgIndex] || [])];
        newActions[actionIndex] = { ...newActions[actionIndex], confirmed: true };
        return { ...prev, [msgIndex]: newActions };
      });
    } catch (e: any) {
      toast.error("Erro ao executar: " + e.message);
    }
  };


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

  const undoLastTurn = () => {
    if (messages.length === 0) return;
    setMessages(prev => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      if (last.role === "assistant") {
        return prev.slice(0, -2);
      }
      return prev.slice(0, -1);
    });
    toast.success("Última interação removida!");
  };

  const clearChat = () => {
    setMessages([]);
    setPixData(null);
    toast.success("Chat reiniciado!");
  };

  const sendAiWorkSummary = async () => {
    if (!aiSummary || !user) {
      toast.error("Resumo não disponível no momento.");
      return;
    }
    const summaryText = `Resumo de Atividades IA (${aiSummary.period}):
    - Interações: ${aiSummary.recent_chats}
    - Tarefas Agendadas: ${aiSummary.pending_tasks}
    - Tarefas Concluídas: ${aiSummary.completed_tasks}
    - Insights CEO: ${aiSummary.recent_insights}`;

    try {
      const { error } = await supabase.from("admin_notifications").insert({
        sender_user_id: user.id,
        target_user_id: user.id,
        title: "📊 Resumo de Trabalho da IA",
        message: summaryText,
        type: "ceo_insight"
      });
      if (error) throw error;
      toast.success("Resumo enviado para suas notificações!");
    } catch (e: any) {
      toast.error("Erro ao enviar resumo: " + e.message);
    }
  };

  const saveConversation = () => {
    if (messages.length === 0) {
      toast.error("Nenhuma conversa para salvar.");
      return;
    }
    const content = messages.map(m => `${m.role === 'user' ? 'Você' : aiName}: ${getTextContent(m.content)}`).join('\n\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conversa-ia-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Conversa baixada!");
  };

  const sendMessage = async (text: string) => {
    if ((!text.trim() && pendingImages.length === 0) || isLoading) return;

    // Detect CEO mode activation command
    const lowerText = text.toLowerCase().trim();
    if (lowerText.includes("ative modo ceo") || lowerText.includes("ativar modo ceo") || lowerText.includes("cérebro ceo") || lowerText.includes("cerebro ceo")) {
      if (settings?.id && updateSettings) {
        try {
          await updateSettings.mutateAsync({
            id: settings.id,
            ai_chat_tone: "ceo_profissional",
          } as any);
          toast.success("🧠 Modo CEO Profissional ativado!");
          queryClient.invalidateQueries({ queryKey: ["store_settings"] });
        } catch (err) {
          console.error("Error activating CEO mode:", err);
        }
      }
    }

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
          userId: user?.id,
          clientTime: new Date().toISOString(),
        }),

      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Erro de conexão" }));
        const errMsg = err.error || `Erro ${resp.status}`;
        toast.error(errMsg);
        setMessages((prev) => [...prev, { role: "assistant", content: `⚠️ ${errMsg}` }]);
        setIsLoading(false);
        return;
      }

      // Handle graceful fallback responses (e.g. insufficient credits)
      const contentType = resp.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const jsonResp = await resp.json();
        if (jsonResp.fallback || jsonResp.error) {
          const msg = jsonResp.message || jsonResp.error || "Erro desconhecido";
          toast.error(msg);
          setMessages((prev) => [...prev, { role: "assistant", content: `⚠️ ${msg}` }]);
          setIsLoading(false);
          return;
        }
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
        await processAIActions(assistantSoFar, messages.length + 1);
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : "Erro desconhecido";
      setMessages((prev) => [...prev, { role: "assistant", content: `❌ ${errorMsg}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-send voice transcript
  useEffect(() => {
    if (pendingVoiceRef.current && !voiceRecorder.isRecording && !voiceRecorder.isTranscribing && !isLoading) {
      const text = pendingVoiceRef.current;
      pendingVoiceRef.current = null;
      sendMessage(text);
    }
  }, [voiceRecorder.isRecording, voiceRecorder.isTranscribing, isLoading]);

  if (!open) {
    return (
      <Button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-5 sm:bottom-6 sm:right-6 z-50 h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all"
        size="icon"
      >
        <Sparkles className="h-6 w-6" />
      </Button>
    );
  }

  const aiInitials = aiName.slice(0, 2).toUpperCase();

  return (
    <>
      <div className="fixed inset-0 sm:inset-auto sm:bottom-6 sm:right-6 z-50 w-full sm:w-[400px] h-[100dvh] sm:h-[560px] sm:max-h-[560px] flex flex-col sm:rounded-2xl border-0 sm:border border-border bg-card shadow-2xl overflow-hidden">
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

        {/* Toolbar */}
        {!aiLocked && messages.length > 0 && (
          <div className="flex items-center gap-1 px-3 py-1.5 border-b bg-card">
            <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px] gap-1" onClick={sendAiWorkSummary} disabled={!aiSummary}>
              <Sparkles className="h-3 w-3 text-primary" /> Resumo
            </Button>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px] gap-1" onClick={undoLastTurn}>
              <RotateCcw className="h-3 w-3" /> Voltar
            </Button>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px] gap-1" onClick={clearChat}>
              <Trash2 className="h-3 w-3" /> Reiniciar
            </Button>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px] gap-1" onClick={saveConversation}>
              <FileText className="h-3 w-3" /> Salvar
            </Button>
          </div>
        )}

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
                <Button size="sm" className="mt-4 gap-2" onClick={() => window.location.assign(`/painel/${slug}/plano?upgrade=PREMIUM`)}>
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
                    className="justify-start text-xs h-auto py-2.5 px-3 whitespace-normal text-left border-border/60 bg-background text-foreground hover:border-primary/50 hover:bg-accent hover:text-accent-foreground"
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
                <div className={`rounded-2xl px-4 py-2.5 text-sm shadow-sm ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-card text-card-foreground border border-border"}`}>
                  <div className="prose prose-sm max-w-full break-words text-inherit prose-headings:text-inherit prose-p:text-inherit prose-strong:text-inherit prose-li:text-inherit prose-code:text-inherit prose-pre:bg-muted prose-pre:text-foreground prose-a:text-primary">
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

                  {pendingActions[i] && pendingActions[i].length > 0 && (
                    <div className="mt-3 space-y-2 pt-2 border-t border-border/50">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Ações Pendentes:</p>
                      {pendingActions[i].map((action, aidx) => (
                        <div key={aidx} className="flex flex-col gap-1.5 bg-muted/50 p-2 rounded-lg border border-border/50">
                          <span className="text-[11px] font-medium leading-tight">{action.label}</span>
                          
                          {/* Push Preview */}
                          {action.type === "push" && action.payload?.body && (
                            <div className="bg-background/50 p-2 rounded border border-border/50 my-1">
                              <p className="text-[10px] font-bold text-foreground line-clamp-1">{action.payload.title}</p>
                              <p className="text-[10px] text-muted-foreground line-clamp-3 leading-tight">{action.payload.body}</p>
                            </div>
                          )}
                          
                          <Button 
                            size="sm" 
                            className="h-7 w-full text-[10px]" 
                            disabled={action.confirmed}
                            onClick={() => confirmAction(i, aidx)}
                          >
                            {action.confirmed ? "Confirmado" : "Confirmar e Enviar"}
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
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
        <div className="p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] bg-card border-t border-border">
          {pendingImages.length > 0 && !voiceRecorder.isRecording && (
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

          {voiceRecorder.error && !voiceRecorder.isRecording && (
            <p className="text-xs text-destructive mb-2 px-2">{voiceRecorder.error}</p>
          )}

          {voiceRecorder.isRecording ? (
            /* WhatsApp-style recording bar */
            <div className="flex items-center gap-3 h-12 bg-destructive/10 rounded-full px-4 animate-in slide-in-from-right-4 duration-200">
              <button 
                onClick={voiceRecorder.stopRecording}
                className="shrink-0 h-8 w-8 rounded-full bg-destructive/20 flex items-center justify-center hover:bg-destructive/30 transition-colors"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </button>
              
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="h-2 w-2 rounded-full bg-destructive animate-pulse shrink-0" />
                <span className="text-sm font-mono font-medium text-destructive tabular-nums">
                  {voiceRecorder.formattedTime}
                </span>
                {/* Animated waveform bars */}
                <div className="flex items-center gap-[3px] flex-1 justify-center">
                  {Array.from({ length: 20 }).map((_, i) => (
                    <div 
                      key={i} 
                      className="w-[3px] rounded-full bg-destructive/60"
                      style={{
                        height: `${Math.random() * 16 + 4}px`,
                        animation: `waveform 0.6s ease-in-out ${i * 0.05}s infinite alternate`,
                      }}
                    />
                  ))}
                </div>
              </div>

              <button 
                onClick={voiceRecorder.stopRecording}
                className="shrink-0 h-10 w-10 rounded-full bg-primary flex items-center justify-center shadow-md hover:opacity-90 transition-opacity"
              >
                <Send className="h-5 w-5 text-primary-foreground" />
              </button>
            </div>
          ) : (
            /* Normal input bar */
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
                className="shrink-0 h-10 w-10 rounded-full" 
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
                className="flex-1 rounded-full"
              />
              {input.trim() || pendingImages.length > 0 ? (
                <Button onClick={() => sendMessage(input)} disabled={isLoading || subscribeLoading} className="shrink-0 h-10 w-10 rounded-full" size="icon">
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-5 w-5" />}
                </Button>
              ) : voiceRecorder.isSupported ? (
                <Button 
                  variant="outline"
                  size="icon" 
                  className="shrink-0 h-10 w-10 rounded-full" 
                  onClick={voiceRecorder.startRecording}
                  title="Gravar áudio"
                >
                  <Mic className="h-5 w-5" />
                </Button>
              ) : (
                <Button onClick={() => sendMessage(input)} disabled={isLoading || subscribeLoading} className="shrink-0 h-10 w-10 rounded-full" size="icon">
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-5 w-5" />}
                </Button>
              )}
            </div>
          )}
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

            <div className="space-y-2">
              <Label>Tom da IA (na loja e no admin)</Label>
              <div className="grid grid-cols-1 gap-2">
                {AI_TONE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setTempTone(opt.value)}
                    className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                      tempTone === opt.value 
                        ? "border-primary bg-primary/5 ring-1 ring-primary" 
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <span className="text-base">{opt.label.split(" ")[0]}</span>
                    <div>
                      <p className="text-sm font-medium">{opt.label.split(" ").slice(1).join(" ")}</p>
                      <p className="text-xs text-muted-foreground">{opt.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 sticky bottom-0 bg-background pb-1">
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
