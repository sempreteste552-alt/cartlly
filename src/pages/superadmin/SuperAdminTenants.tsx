import { useState } from "react";
import { useAllTenants, useAllPlans } from "@/hooks/useUserRole";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreVertical, Search, Store, Package, ShoppingCart, Eye, Ban, Unlock, CreditCard, UserCog, CheckCircle, XCircle, Clock, Settings, ArrowUp, ArrowDown, ShieldOff, ShieldCheck, StoreIcon, Trash2, AlertTriangle, Mail, KeyRound, UserCheck, Globe, Megaphone, Gift, Send, Loader2, Sparkles, Calendar } from "lucide-react";
import { toast } from "sonner";
import { TenantDetailDialog } from "@/components/TenantDetailDialog";
import { SensitiveEditDialog } from "@/components/superadmin/SensitiveEditDialog";
import { buildStoreUrl } from "@/lib/storeDomain";
import { Link, useNavigate } from "react-router-dom";
import { Activity, ShieldAlert } from "lucide-react";

export default function SuperAdminTenants() {
  const { data: tenants, isLoading } = useAllTenants();
  const { data: plans } = useAllPlans();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const queryClient = useQueryClient();

  // Fetch pending plan change requests
  const { data: planRequests } = useQuery({
    queryKey: ["all_plan_change_requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plan_change_requests")
        .select("*, requested_plan:tenant_plans!plan_change_requests_requested_plan_id_fkey(*), current_plan:tenant_plans!plan_change_requests_current_plan_id_fkey(*)")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<any>(null);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [detailTenant, setDetailTenant] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingTenant, setDeletingTenant] = useState<any>(null);
  const [msgDialogOpen, setMsgDialogOpen] = useState(false);
  const [msgTenant, setMsgTenant] = useState<any>(null);
  const [msgTitle, setMsgTitle] = useState("Aviso da Plataforma");
  const [msgBody, setMsgBody] = useState("");
  const [msgSending, setMsgSending] = useState(false);
  const [editTenant, setEditTenant] = useState<any>(null);
  const [trialDialogOpen, setTrialDialogOpen] = useState(false);
  const [trialTenant, setTrialTenant] = useState<any>(null);
  const [trialPlanId, setTrialPlanId] = useState("");
  const [trialDays, setTrialDays] = useState<number>(7);
  const [trialSaving, setTrialSaving] = useState(false);

  // Feature overrides (liberar funcionalidades de planos superiores)
  const [overridesDialogOpen, setOverridesDialogOpen] = useState(false);
  const [overridesTenant, setOverridesTenant] = useState<any>(null);
  const [overridesSourcePlanId, setOverridesSourcePlanId] = useState<string>("");
  const [overridesSaving, setOverridesSaving] = useState(false);
  const navigate = useNavigate();

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const formatLastSeen = (date: string | null) => {
    if (!date) return "Nunca";
    const lastSeen = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - lastSeen.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffSecs = Math.floor(diffMs / 1000);
    
    if (diffSecs < 10) return "agora mesmo";
    if (diffSecs < 60) return `há ${diffSecs}s`;
    if (diffMins < 60) return `há ${diffMins}m`;
    if (diffMins < 1440) return `há ${Math.floor(diffMins / 60)}h`;
    return lastSeen.toLocaleDateString("pt-BR");
  };


  const pendingCount = tenants?.filter(t => t.status === "pending").length || 0;
  const onlineCount = tenants?.filter(t => t.is_online).length || 0;
  const activeCount = tenants?.filter(t => t.status === "active" || t.subscription?.status === "active").length || 0;
  const blockedCount = tenants?.filter(t => t.status === "blocked" || t.store?.store_blocked || t.store?.admin_blocked).length || 0;
  const trialCount = tenants?.filter(t => t.subscription?.status === "trial").length || 0;
  const paidCount = tenants?.filter(t => {
    const planName = (t.subscription?.tenant_plans as any)?.name;
    return t.subscription?.status === "active" && planName && planName !== "FREE";
  }).length || 0;
  const totalRevenue = tenants?.reduce((sum, t) => sum + (t.orders?.revenue || 0), 0) || 0;
  const totalOrders = tenants?.reduce((sum, t) => sum + (t.orders?.count || 0), 0) || 0;

  const filtered = tenants?.filter((t) => {
    const matchSearch = !search.trim() ||
      t.display_name?.toLowerCase().includes(search.toLowerCase()) ||
      t.store?.store_name?.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" ||
      (filter === "online" && t.is_online) ||
      (filter === "pending" && t.status === "pending") ||
      (filter === "approved" && t.status === "approved") ||
      (filter === "active" && (t.status === "active" || t.subscription?.status === "active")) ||
      (filter === "trial" && t.subscription?.status === "trial") ||
      (filter === "blocked" && (t.status === "blocked" || t.store?.store_blocked || t.store?.admin_blocked)) ||
      (filter === "no_plan" && !t.subscription && (t.status === "approved" || t.status === "active"));
    return matchSearch && matchFilter;
  }) ?? [];

  // Admin tenant actions via edge function
  const handleAdminAction = async (action: string, targetUserId: string, targetEmail?: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("admin-tenant-actions", {
        body: { action, targetUserId, targetEmail },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    } catch (err: any) {
      toast.error(err.message || "Erro na ação");
      return null;
    }
  };

  const handleResendVerification = async (tenant: any) => {
    // Get tenant email
    const result = await handleAdminAction("get_user_info", tenant.user_id);
    if (!result) return;
    const res = await handleAdminAction("resend_verification", tenant.user_id, result.email);
    if (res) toast.success("E-mail de verificação reenviado!");
  };

  const handleSendPasswordReset = async (tenant: any) => {
    const result = await handleAdminAction("get_user_info", tenant.user_id);
    if (!result) return;
    const res = await handleAdminAction("send_password_reset", tenant.user_id, result.email);
    if (res) toast.success("E-mail de redefinição de senha enviado!");
  };

  const handleManualActivate = async (tenant: any) => {
    const res = await handleAdminAction("manual_activate", tenant.user_id);
    if (res) {
      toast.success("Conta ativada manualmente!");
      logAudit("manual_activate", "tenant", tenant.user_id, tenant.display_name || "—");
      queryClient.invalidateQueries({ queryKey: ["all_tenants"] });
    }
  };

  const logAudit = async (action: string, targetType: string, targetId: string, targetName: string, details?: any) => {
    try {
      await supabase.from("audit_logs").insert({
        actor_user_id: user!.id,
        action,
        target_type: targetType,
        target_id: targetId,
        target_name: targetName,
        details: details || {},
      } as any);
    } catch (e) {
      console.error("Audit log error:", e);
    }
  };

  const notifyTenant = async (userId: string, action: string) => {
    try {
      await supabase.functions.invoke("notify-tenant-status", {
        body: { userId, action },
      });
    } catch (e) {
      console.error("Falha ao notificar tenant:", e);
    }
  };

  const handleApprove = async (userId: string) => {
    const tenant = tenants?.find(t => t.user_id === userId);
    const { error } = await supabase
      .from("profiles")
      .update({ status: "active" } as any)
      .eq("user_id", userId);
    if (error) toast.error("Erro: " + error.message);
    else {
      toast.success("Conta ativada! Notificação enviada.");
      notifyTenant(userId, "approved");
      logAudit("activate_tenant", "tenant", userId, tenant?.display_name || "—");
      await queryClient.invalidateQueries({ queryKey: ["all_tenants"] });
      await queryClient.invalidateQueries({ queryKey: ["all_plan_change_requests"] });
    }
  };

  const handleReject = async (userId: string) => {
    const tenant = tenants?.find(t => t.user_id === userId);
    const { error } = await supabase
      .from("profiles")
      .update({ status: "rejected" } as any)
      .eq("user_id", userId);
    if (error) toast.error("Erro: " + error.message);
    else {
      toast.success("Conta rejeitada. Notificação enviada.");
      notifyTenant(userId, "rejected");
      logAudit("reject_tenant", "tenant", userId, tenant?.display_name || "—");
      await queryClient.invalidateQueries({ queryKey: ["all_tenants"] });
      await queryClient.invalidateQueries({ queryKey: ["all_plan_change_requests"] });
    }
  };

  const handleBlock = async (userId: string) => {
    const tenant = tenants?.find(t => t.user_id === userId);
    const { error } = await supabase
      .from("profiles")
      .update({ status: "blocked" } as any)
      .eq("user_id", userId);
    if (error) toast.error("Erro: " + error.message);
    else {
      toast.success("Tenant bloqueado. Notificação enviada.");
      notifyTenant(userId, "blocked");
      logAudit("block_tenant", "tenant", userId, tenant?.display_name || "—");
      await queryClient.invalidateQueries({ queryKey: ["all_tenants"] });
    }
  };

  const handleUnblock = async (userId: string) => {
    const tenant = tenants?.find(t => t.user_id === userId);
    const { error } = await supabase
      .from("profiles")
      .update({ status: "active" } as any)
      .eq("user_id", userId);
    if (error) toast.error("Erro: " + error.message);
    else {
      toast.success("Tenant desbloqueado e ativado. Notificação enviada.");
      notifyTenant(userId, "approved");
      logAudit("unblock_tenant", "tenant", userId, tenant?.display_name || "—");
      await queryClient.invalidateQueries({ queryKey: ["all_tenants"] });
    }
  };

  // Block/Unblock Store
  const handleToggleStoreBlock = async (userId: string, currentBlocked: boolean) => {
    const { error } = await supabase
      .from("store_settings")
      .update({ store_blocked: !currentBlocked } as any)
      .eq("user_id", userId);
    if (error) { toast.error("Erro: " + error.message); return; }
    const action = !currentBlocked ? "bloqueada" : "desbloqueada";
    toast.success(`Loja ${action}!`);
    // Notify tenant
    await supabase.from("admin_notifications").insert({
      sender_user_id: user!.id,
      target_user_id: userId,
      title: !currentBlocked ? "🚫 Loja Bloqueada" : "✅ Loja Desbloqueada",
      message: !currentBlocked
        ? "Sua loja foi bloqueada pelo administrador. Clientes não podem acessá-la."
        : "Sua loja foi desbloqueada! Clientes já podem acessá-la novamente.",
      type: "info",
    } as any);
    const tenant = tenants?.find(t => t.user_id === userId);
    logAudit(!currentBlocked ? "block_store" : "unblock_store", "store", userId, tenant?.display_name || "—");
    queryClient.invalidateQueries({ queryKey: ["all_tenants"] });
  };

  // Block/Unblock Admin Panel
  const handleToggleAdminBlock = async (userId: string, currentBlocked: boolean) => {
    const { error } = await supabase
      .from("store_settings")
      .update({ admin_blocked: !currentBlocked } as any)
      .eq("user_id", userId);
    if (error) { toast.error("Erro: " + error.message); return; }
    const action = !currentBlocked ? "bloqueado" : "desbloqueado";
    toast.success(`Painel ${action}!`);
    await supabase.from("admin_notifications").insert({
      sender_user_id: user!.id,
      target_user_id: userId,
      title: !currentBlocked ? "🔒 Painel Bloqueado" : "🔓 Painel Desbloqueado",
      message: !currentBlocked
        ? "O acesso ao painel administrativo da sua loja foi bloqueado."
        : "O acesso ao painel administrativo da sua loja foi liberado!",
      type: "info",
    } as any);
    const tenant = tenants?.find(t => t.user_id === userId);
    logAudit(!currentBlocked ? "block_admin_panel" : "unblock_admin_panel", "admin_panel", userId, tenant?.display_name || "—");
    queryClient.invalidateQueries({ queryKey: ["all_tenants"] });
  };

  // Toggle Promo Banner per tenant
  const handleTogglePromoBanner = async (userId: string, currentEnabled: boolean) => {
    const { error } = await supabase
      .from("store_settings")
      .update({ promo_banner_enabled: !currentEnabled } as any)
      .eq("user_id", userId);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success(`Banner promocional ${!currentEnabled ? "ativado" : "desativado"} para este tenant!`);
    queryClient.invalidateQueries({ queryKey: ["all_tenants"] });
  };

  // Delete User - states moved to top

  const handleDeleteUser = async () => {
    if (!deletingTenant) return;
    const userId = deletingTenant.user_id;
    // Delete store_settings, profiles, subscriptions, etc. (cascade will handle some)
    await supabase.from("tenant_subscriptions").delete().eq("user_id", userId);
    await supabase.from("store_settings").delete().eq("user_id", userId);
    await supabase.from("products").delete().eq("user_id", userId);
    await supabase.from("orders").delete().eq("user_id", userId);
    await supabase.from("categories").delete().eq("user_id", userId);
    await supabase.from("coupons").delete().eq("user_id", userId);
    await supabase.from("shipping_zones").delete().eq("user_id", userId);
    await supabase.from("store_banners").delete().eq("user_id", userId);
    await supabase.from("admin_notifications").delete().eq("target_user_id", userId);
    await supabase.from("admin_notifications").delete().eq("sender_user_id", userId);
    await supabase.from("push_subscriptions").delete().eq("user_id", userId);
    const { error: profileError } = await supabase.from("profiles").delete().eq("user_id", userId);
    if (profileError) { toast.error("Erro ao excluir: " + profileError.message); return; }

    // Log notification to all super admins
    const { data: superAdmins } = await supabase.from("user_roles").select("user_id").eq("role", "super_admin");
    for (const sa of (superAdmins || [])) {
      await supabase.from("admin_notifications").insert({
        sender_user_id: user!.id,
        target_user_id: sa.user_id,
        title: "🗑️ Tenant Excluído",
        message: `O tenant "${deletingTenant.display_name || "Sem nome"}" foi excluído permanentemente.`,
        type: "warning",
      } as any);
    }

    logAudit("delete_tenant", "tenant", userId, deletingTenant.display_name || "Sem nome", {
      store_name: deletingTenant.store?.store_name,
      products: deletingTenant.productCount,
      orders: deletingTenant.orders?.count,
    });
    toast.success("Tenant excluído permanentemente!");
    setDeleteDialogOpen(false);
    setDeletingTenant(null);
    queryClient.invalidateQueries({ queryKey: ["all_tenants"] });
  };

  const openAssignPlan = (tenant: any) => {
    setSelectedTenant(tenant);
    setSelectedPlanId(tenant.subscription?.plan_id || "");
    setPlanDialogOpen(true);
  };

  const handleAssignPlan = async () => {
    if (!selectedTenant || !selectedPlanId) return;
    const userId = selectedTenant.user_id;

    if (selectedTenant.subscription) {
      const { error } = await supabase
        .from("tenant_subscriptions")
        .update({
          plan_id: selectedPlanId,
          status: "active",
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        } as any)
        .eq("user_id", userId);
      if (error) { toast.error("Erro: " + error.message); return; }
    } else {
      const { error } = await supabase
        .from("tenant_subscriptions")
        .insert({
          user_id: userId,
          plan_id: selectedPlanId,
          status: "active",
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        } as any);
      if (error) { toast.error("Erro: " + error.message); return; }
    }

    toast.success("Plano atribuído com sucesso!");
    queryClient.invalidateQueries({ queryKey: ["all_tenants"] });
    setPlanDialogOpen(false);
  };

  const handleRemovePlan = async () => {
    if (!selectedTenant?.subscription) return;
    const { error } = await supabase
      .from("tenant_subscriptions")
      .delete()
      .eq("user_id", selectedTenant.user_id);
    if (error) toast.error("Erro: " + error.message);
    else {
      toast.success("Plano removido");
      queryClient.invalidateQueries({ queryKey: ["all_tenants"] });
      setPlanDialogOpen(false);
    }
  };

  const openGrantTrial = (tenant: any) => {
    setTrialTenant(tenant);
    setTrialPlanId(tenant.subscription?.plan_id || "");
    setTrialDays(7);
    setTrialDialogOpen(true);
  };

  const handleGrantTrial = async () => {
    if (!trialTenant || !trialPlanId || !trialDays || trialDays < 1) {
      toast.error("Selecione um plano e informe a duração em dias");
      return;
    }
    setTrialSaving(true);
    try {
      const userId = trialTenant.user_id;
      const now = new Date();
      const trialEnd = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000);
      const payload: any = {
        plan_id: trialPlanId,
        status: "trial",
        trial_ends_at: trialEnd.toISOString(),
        current_period_start: now.toISOString(),
        current_period_end: trialEnd.toISOString(),
      };

      if (trialTenant.subscription) {
        const { error } = await supabase
          .from("tenant_subscriptions")
          .update(payload)
          .eq("user_id", userId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("tenant_subscriptions")
          .insert({ user_id: userId, ...payload });
        if (error) throw error;
      }

      // Unblock store if blocked
      await supabase.from("store_settings").update({ store_blocked: false }).eq("user_id", userId);

      // Notify tenant
      const planName = plans?.find(p => p.id === trialPlanId)?.name || "Premium";
      await supabase.from("admin_notifications").insert({
        sender_user_id: user!.id,
        target_user_id: userId,
        title: "🎁 Trial Grátis Liberado!",
        message: `Você ganhou ${trialDays} dia(s) de teste grátis no plano ${planName}. Aproveite todas as funções premium!`,
        type: "info",
      } as any);

      try {
        await supabase.functions.invoke("send-push", {
          body: {
            title: "🎁 Trial Grátis Liberado!",
            body: `Você ganhou ${trialDays} dia(s) grátis no plano ${planName}.`,
            url: "/admin",
            targetUserId: userId,
          },
        });
      } catch {}

      toast.success(`Trial de ${trialDays} dia(s) liberado!`);
      queryClient.invalidateQueries({ queryKey: ["all_tenants"] });
      setTrialDialogOpen(false);
    } catch (err: any) {
      toast.error("Erro: " + (err.message || "Falha ao liberar trial"));
    } finally {
      setTrialSaving(false);
    }
  };

  const openOverrides = (tenant: any) => {
    setOverridesTenant(tenant);
    // Pre-select current plan as default — admin pode trocar para um superior
    setOverridesSourcePlanId(tenant.subscription?.plan_id || "");
    setOverridesDialogOpen(true);
  };

  const handleApplyOverrides = async (mode: "grant" | "clear") => {
    if (!overridesTenant) return;
    if (mode === "grant" && !overridesSourcePlanId) {
      toast.error("Selecione o plano cujas funcionalidades serão liberadas");
      return;
    }
    setOverridesSaving(true);
    try {
      const userId = overridesTenant.user_id;
      let overrides: Record<string, any> = {};
      let sourcePlanName = "";

      if (mode === "grant") {
        const sourcePlan: any = plans?.find((p) => p.id === overridesSourcePlanId);
        if (!sourcePlan) throw new Error("Plano de origem não encontrado");
        sourcePlanName = sourcePlan.name;
        const feats = (typeof sourcePlan.features === "object" && !Array.isArray(sourcePlan.features))
          ? (sourcePlan.features as Record<string, any>) : {};
        // Apenas features booleanas TRUE viram overrides (desbloqueiam)
        for (const [k, v] of Object.entries(feats)) {
          if (typeof v === "boolean" && v === true) overrides[k] = true;
        }
      }

      if (overridesTenant.subscription) {
        const { error } = await supabase
          .from("tenant_subscriptions")
          .update({ feature_overrides: overrides })
          .eq("user_id", userId);
        if (error) throw error;
      } else {
        toast.error("Tenant sem assinatura ativa. Atribua um plano antes de liberar funcionalidades.");
        setOverridesSaving(false);
        return;
      }

      if (mode === "grant") {
        await supabase.from("admin_notifications").insert({
          sender_user_id: user!.id,
          target_user_id: userId,
          title: "🎁 Funcionalidades Extras Liberadas!",
          message: `A plataforma liberou para você as funcionalidades do plano ${sourcePlanName} sem custo adicional. Aproveite enquanto sua assinatura estiver ativa.`,
          type: "info",
        } as any);
        toast.success(`Funcionalidades do plano ${sourcePlanName} liberadas!`);
      } else {
        toast.success("Funcionalidades extras removidas. O tenant volta às features do plano contratado.");
      }

      queryClient.invalidateQueries({ queryKey: ["all_tenants"] });
      setOverridesDialogOpen(false);
    } catch (err: any) {
      toast.error("Erro: " + (err.message || "Falha ao aplicar overrides"));
    } finally {
      setOverridesSaving(false);
    }
  };

  const handleSendMessage = async () => {
    if (!msgBody.trim() || !msgTenant) return;
    setMsgSending(true);
    try {
      // 1. In-app notification
      await supabase.from("admin_notifications").insert({
        sender_user_id: user!.id,
        target_user_id: msgTenant.user_id,
        title: msgTitle,
        message: msgBody,
        type: "info",
      } as any);

      // 2. Push Notification
      await supabase.functions.invoke("send-push", {
        body: {
          title: msgTitle,
          body: msgBody,
          url: "/admin",
          targetUserId: msgTenant.user_id,
        },
      });

      toast.success("Mensagem enviada!");
      setMsgDialogOpen(false);
      setMsgBody("");
    } catch (err) {
      toast.error("Erro ao enviar mensagem");
    } finally {
      setMsgSending(false);
    }
  };

  const getStatusBadge = (tenant: any) => {
    const status = tenant.status;
    const storeBlocked = tenant.store?.store_blocked;
    const adminBlocked = tenant.store?.admin_blocked;
    const isOnline = tenant.is_online;
    
    const badges = [];
    
    // Online Badge
    if (isOnline) {
      badges.push(
        <Badge key="online" variant="default" className="bg-green-500 hover:bg-green-600 animate-pulse border-none shadow-[0_0_12px_rgba(34,197,94,0.7)]">
          <span className="relative flex h-2 w-2 mr-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
          </span>
          Online
        </Badge>
      );
    }

    if (status === "pending") badges.push(<Badge key="pending" variant="secondary" className="bg-amber-500/10 text-amber-600 border-amber-500/30"><Clock className="mr-1 h-3 w-3" />Pendente</Badge>);
    else if (status === "rejected") badges.push(<Badge key="rejected" variant="destructive"><XCircle className="mr-1 h-3 w-3" />Desativado</Badge>);
    else if (status === "blocked") badges.push(<Badge key="blocked" variant="destructive"><Ban className="mr-1 h-3 w-3" />Bloqueado</Badge>);
    else badges.push(<Badge key="approved" variant="default" className="bg-green-600"><CheckCircle className="mr-1 h-3 w-3" />Ativo</Badge>);
    
    if (tenant.subscription) {
      const planName = (tenant.subscription.tenant_plans as any)?.name || "—";
      const subStatus = tenant.subscription.status;
      const isTrial = subStatus === "trial";
      const isFree = planName === "FREE";
      const isPaid = !isFree && !isTrial && subStatus === "active";
      
      if (isTrial) {
        const trialEnd = tenant.subscription.trial_ends_at ? new Date(tenant.subscription.trial_ends_at) : null;
        const daysLeft = trialEnd ? Math.max(0, Math.ceil((trialEnd.getTime() - Date.now()) / 86400000)) : 0;
        badges.push(<Badge key="sub" variant="outline" className="border-purple-500/50 text-purple-600 text-xs"><Clock className="mr-1 h-3 w-3" />Trial {daysLeft}d</Badge>);
      } else if (isPaid) {
        badges.push(<Badge key="sub" variant="outline" className="border-primary/50 text-primary text-xs"><CreditCard className="mr-1 h-3 w-3" />{planName}</Badge>);
      } else if (isFree) {
        badges.push(<Badge key="sub" variant="outline" className="border-muted-foreground/30 text-muted-foreground text-xs">FREE</Badge>);
      } else {
        badges.push(<Badge key="sub" variant="outline" className="border-orange-500/50 text-orange-600 text-xs">{subStatus}</Badge>);
      }
    } else {
      badges.push(<Badge key="nosub" variant="outline" className="border-muted-foreground/30 text-muted-foreground text-xs">Sem plano</Badge>);
    }
    
    if (storeBlocked) badges.push(<Badge key="store" variant="outline" className="border-orange-500/50 text-orange-600 text-xs"><StoreIcon className="mr-1 h-3 w-3" />Loja bloq.</Badge>);
    if (adminBlocked) badges.push(<Badge key="admin" variant="outline" className="border-red-500/50 text-red-600 text-xs"><ShieldOff className="mr-1 h-3 w-3" />Painel bloq.</Badge>);
    
    return <div className="flex items-center gap-1 flex-wrap">{badges}</div>;
  };


  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Store className="h-6 w-6 text-primary" />
            Tenants
          </h1>
          <p className="text-sm text-muted-foreground">
            Gerenciar todas as lojas da plataforma · <span className="font-semibold text-foreground">{tenants?.length || 0}</span> tenants
          </p>
        </div>
      </div>

      {/* Pro KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Total", value: tenants?.length || 0, icon: Store, color: "from-primary/20 to-primary/5", text: "text-primary", border: "border-primary/30", glow: "shadow-[0_0_20px_-8px_hsl(var(--primary)/0.5)]" },
          { label: "Online", value: onlineCount, icon: Activity, color: "from-emerald-500/20 to-emerald-500/5", text: "text-emerald-500", border: "border-emerald-500/30", glow: "shadow-[0_0_20px_-8px_rgba(16,185,129,0.6)]", pulse: true },
          { label: "Ativos", value: activeCount, icon: CheckCircle, color: "from-green-500/20 to-green-500/5", text: "text-green-500", border: "border-green-500/30", glow: "shadow-[0_0_20px_-8px_rgba(34,197,94,0.5)]" },
          { label: "Pendentes", value: pendingCount, icon: Clock, color: "from-amber-500/20 to-amber-500/5", text: "text-amber-500", border: "border-amber-500/30", glow: "shadow-[0_0_20px_-8px_rgba(245,158,11,0.5)]" },
          { label: "Trial", value: trialCount, icon: Sparkles, color: "from-purple-500/20 to-purple-500/5", text: "text-purple-500", border: "border-purple-500/30", glow: "shadow-[0_0_20px_-8px_rgba(168,85,247,0.5)]" },
          { label: "Bloqueados", value: blockedCount, icon: Ban, color: "from-red-500/20 to-red-500/5", text: "text-red-500", border: "border-red-500/30", glow: "shadow-[0_0_20px_-8px_rgba(239,68,68,0.5)]" },
        ].map((kpi, i) => {
          const Icon = kpi.icon;
          return (
            <Card
              key={kpi.label}
              className={`relative overflow-hidden border ${kpi.border} bg-gradient-to-br ${kpi.color} ${kpi.glow} transition-all duration-300 hover:scale-[1.03] hover:-translate-y-0.5 cursor-pointer group`}
              style={{ animationDelay: `${i * 50}ms` }}
              onClick={() => {
                const map: Record<string, string> = { Total: "all", Online: "online", Ativos: "active", Pendentes: "pending", Trial: "trial", Bloqueados: "blocked" };
                if (map[kpi.label]) setFilter(map[kpi.label]);
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardContent className="p-3 relative">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">{kpi.label}</span>
                  <Icon className={`h-4 w-4 ${kpi.text} ${kpi.pulse && kpi.value > 0 ? "animate-pulse" : ""}`} />
                </div>
                <div className={`text-2xl font-bold ${kpi.text} tabular-nums`}>{kpi.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Revenue strip */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/15 flex items-center justify-center">
              <CreditCard className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Receita total</p>
              <p className="text-xl font-bold text-foreground tabular-nums truncate">{formatCurrency(totalRevenue)}</p>
            </div>
            <Badge variant="outline" className="border-primary/40 text-primary text-[10px]">{paidCount} pagos</Badge>
          </CardContent>
        </Card>
        <Card className="border-emerald-500/20 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-500/15 flex items-center justify-center">
              <ShoppingCart className="h-5 w-5 text-emerald-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Pedidos</p>
              <p className="text-xl font-bold text-foreground tabular-nums truncate">{totalOrders.toLocaleString("pt-BR")}</p>
            </div>
            <Badge variant="outline" className="border-emerald-500/40 text-emerald-500 text-[10px]">total</Badge>
          </CardContent>
        </Card>
      </div>

      {/* Pending alert - informational only */}
      {pendingCount > 0 && (
        <Card className="border-blue-500/30 bg-gradient-to-r from-blue-500/10 via-blue-500/5 to-transparent shadow-[0_0_20px_-10px_rgba(59,130,246,0.5)]">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="h-10 w-10 rounded-lg bg-blue-500/15 flex items-center justify-center shrink-0">
              <Mail className="h-5 w-5 text-blue-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-blue-600 dark:text-blue-400">{pendingCount} novo(s) tenant(s) aguardando verificação de e-mail</p>
              <p className="text-xs text-muted-foreground">Os tenants são ativados automaticamente após verificar o e-mail</p>
            </div>
            <Button size="sm" variant="outline" className="border-blue-500/40 text-blue-600 hover:bg-blue-500/10" onClick={() => setFilter("pending")}>Ver pendentes</Button>
          </CardContent>
        </Card>
      )}

      {/* Plan Change Requests */}
      {planRequests && planRequests.length > 0 && (
        <Card className="border-primary/30 bg-gradient-to-r from-primary/10 to-transparent shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              📊 Solicitações de Plano ({planRequests.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {planRequests.map((req: any) => {
              const tenant = tenants?.find((t) => t.user_id === req.user_id);
              const handleApprovePlan = async () => {
                // Update subscription
                if (tenant?.subscription) {
                  await supabase.from("tenant_subscriptions").update({
                    plan_id: req.requested_plan_id,
                    status: "active",
                    current_period_start: new Date().toISOString(),
                    current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                  } as any).eq("user_id", req.user_id);
                } else {
                  await supabase.from("tenant_subscriptions").insert({
                    user_id: req.user_id,
                    plan_id: req.requested_plan_id,
                    status: "active",
                  } as any);
                }
                await supabase.from("plan_change_requests").update({
                  status: "approved",
                  resolved_at: new Date().toISOString(),
                  resolved_by: user!.id,
                } as any).eq("id", req.id);
                // Notify tenant
                await supabase.from("admin_notifications").insert({
                  sender_user_id: user!.id,
                  target_user_id: req.user_id,
                  title: "✅ Solicitação Aprovada",
                  message: `Seu ${req.request_type} para o plano ${req.requested_plan?.name || "—"} foi aprovado!`,
                  type: "info",
                } as any);
                toast.success("Solicitação aprovada!");
                queryClient.invalidateQueries({ queryKey: ["all_plan_change_requests"] });
                queryClient.invalidateQueries({ queryKey: ["all_tenants"] });
              };
              const handleRejectPlan = async () => {
                await supabase.from("plan_change_requests").update({
                  status: "rejected",
                  resolved_at: new Date().toISOString(),
                  resolved_by: user!.id,
                } as any).eq("id", req.id);
                await supabase.from("admin_notifications").insert({
                  sender_user_id: user!.id,
                  target_user_id: req.user_id,
                  title: "❌ Solicitação Recusada",
                  message: `Seu ${req.request_type} para o plano ${req.requested_plan?.name || "—"} foi recusado.`,
                  type: "warning",
                } as any);
                toast.success("Solicitação recusada");
                queryClient.invalidateQueries({ queryKey: ["all_plan_change_requests"] });
              };

              return (
                <div key={req.id} className="flex items-center justify-between rounded-lg border border-border/50 bg-background/60 p-3">
                  <div className="flex items-center gap-3">
                    {req.request_type === "upgrade" ? (
                      <ArrowUp className="h-4 w-4 text-green-600" />
                    ) : (
                      <ArrowDown className="h-4 w-4 text-amber-600" />
                    )}
                    <div>
                      <p className="text-sm font-medium">{tenant?.display_name || "Tenant"}</p>
                      <p className="text-xs text-muted-foreground">
                        {req.current_plan?.name || "Grátis"} → {req.requested_plan?.name || "—"} • {new Date(req.created_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white h-7 text-xs" onClick={handleApprovePlan}>
                      <CheckCircle className="mr-1 h-3 w-3" /> Aprovar
                    </Button>
                    <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={handleRejectPlan}>
                      <XCircle className="mr-1 h-3 w-3" /> Recusar
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <Card className="border-border/60 bg-card/50 backdrop-blur-sm">
        <CardContent className="p-3 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por nome ou loja..." className="pl-9 border-border/60 bg-background/60" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-2 flex-wrap">
            {[
              { key: "all", label: "Todos", count: tenants?.length || 0, active: "bg-primary text-primary-foreground hover:bg-primary/90 border-primary shadow-[0_0_15px_-4px_hsl(var(--primary)/0.6)]", inactive: "border-primary/30 text-primary hover:bg-primary/10" },
              { key: "active", label: "Ativos", count: activeCount, active: "bg-emerald-500 text-white hover:bg-emerald-600 border-emerald-500 shadow-[0_0_15px_-4px_rgba(16,185,129,0.7)]", inactive: "border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10" },
              { key: "pending", label: "Pendentes", count: pendingCount, active: "bg-amber-500 text-white hover:bg-amber-600 border-amber-500 shadow-[0_0_15px_-4px_rgba(245,158,11,0.7)]", inactive: "border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10" },
            ].map((f) => (
              <Button
                key={f.key}
                variant="outline"
                size="sm"
                onClick={() => setFilter(f.key)}
                className={`transition-all duration-200 ${filter === f.key ? f.active : f.inactive}`}
              >
                {f.label}
                <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold tabular-nums ${filter === f.key ? "bg-white/25" : "bg-current/10"}`}>
                  {f.count}
                </span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-muted-foreground">Nenhum tenant encontrado</CardContent></Card>
        ) : (
          filtered.map((tenant) => (
            <Card key={tenant.id} className={`border-border ${tenant.status === "pending" ? "border-amber-500/40 bg-amber-500/5" : ""}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full ${tenant.status === "pending" ? "bg-amber-500/20" : "bg-muted"}`}>
                      <Store className={`h-5 w-5 ${tenant.status === "pending" ? "text-amber-500" : "text-muted-foreground"}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{tenant.display_name || "Sem nome"}</p>
                        <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground font-mono truncate max-w-[150px] hidden sm:inline-block" title={tenant.email}>
                          {tenant.email}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground flex flex-wrap gap-x-2 gap-y-0.5 items-center">
                        <span className="font-medium text-foreground/80">{tenant.store?.store_name || "Sem loja"}</span>
                        {tenant.store?.store_slug && <span className="opacity-60">/{tenant.store.store_slug}</span>}
                        <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full transition-colors ${tenant.is_online ? "bg-green-500/10 text-green-600" : "bg-muted text-muted-foreground"}`}>
                          <Clock className={`h-3 w-3 ${tenant.is_online ? "animate-spin-slow" : ""}`} />
                          <span className="font-medium">
                            {tenant.is_online ? "Online agora" : `Visto há ${formatLastSeen(tenant.last_seen).replace("Há ", "")}`}
                          </span>
                        </div>
                      </div>
                        {tenant.referral_origin && (
                          <div className="flex items-center gap-1 text-xs mt-0.5">
                            <Gift className="h-3 w-3 text-primary" />
                            <span className="text-primary/80 font-medium">
                              Indicado por código <span className="font-mono font-bold">{tenant.referral_origin.referral_code}</span>
                            </span>
                          </div>
                        )}
                        {tenant.subscription?.tenant_plans && (
                          <p className="text-xs text-primary font-medium mt-0.5">
                            Plano: {(tenant.subscription.tenant_plans as any)?.name || "—"}
                          </p>
                        )}
                      </div>

                  </div>

                  <div className="flex items-center gap-3">
                    <div className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1"><Package className="h-3.5 w-3.5" />{tenant.productCount}</span>
                      <span className="flex items-center gap-1"><ShoppingCart className="h-3.5 w-3.5" />{tenant.orders?.count || 0}</span>
                      <span className="font-medium text-foreground">{formatCurrency(tenant.orders?.revenue || 0)}</span>
                    </div>

                    {getStatusBadge(tenant)}

                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-blue-500 hover:text-blue-600 hover:bg-blue-50"
                      onClick={() => navigate(`/superadmin/tenants/${tenant.user_id}/diagnostics?autoTest=true`)}
                      title="Testar Integridade"
                    >
                      <Activity className="h-4 w-4" />
                    </Button>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { setDetailTenant(tenant); setDetailDialogOpen(true); }}>
                          <Settings className="mr-2 h-4 w-4" /> Ver Detalhes
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => {
                          const url = buildStoreUrl({
                            slug: tenant.store?.store_slug,
                            customDomain: tenant.store?.custom_domain,
                            domainStatus: tenant.store?.domain_status,
                            sslReady: tenant.store?.domain_verify_details?.sslReady
                          });
                          window.open(url, "_blank");
                        }}>
                          <Eye className="mr-2 h-4 w-4" /> Ver Loja
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openAssignPlan(tenant)}>
                          <CreditCard className="mr-2 h-4 w-4" /> Gerenciar Plano
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openGrantTrial(tenant)}>
                          <Gift className="mr-2 h-4 w-4 text-pink-500" /> Liberar Trial Grátis
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openOverrides(tenant)}>
                          <Sparkles className="mr-2 h-4 w-4 text-amber-500" /> Liberar Funcionalidades Extras
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {/* Support actions */}
                        <DropdownMenuItem onClick={() => handleResendVerification(tenant)}>
                          <Mail className="mr-2 h-4 w-4" /> Reenviar Verificação
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleSendPasswordReset(tenant)}>
                          <KeyRound className="mr-2 h-4 w-4" /> Redefinir Senha (link)
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setEditTenant(tenant)}>
                          <ShieldAlert className="mr-2 h-4 w-4 text-amber-500" /> Editar Email/Senha/Slug (OTP)
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate(`/superadmin/tenants/${tenant.user_id}/diagnostics`)}>
                          <Activity className="mr-2 h-4 w-4 text-blue-500" /> Diagnóstico & Logs
                        </DropdownMenuItem>
                        {(tenant.status === "pending" || tenant.status === "blocked" || tenant.status === "rejected") && (
                          <DropdownMenuItem onClick={() => handleManualActivate(tenant)}>
                            <UserCheck className="mr-2 h-4 w-4 text-green-600" /> Ativar Manualmente
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        {/* Block/Unblock User */}
                        {tenant.status === "blocked" || tenant.status === "rejected" ? (
                          <DropdownMenuItem onClick={() => handleUnblock(tenant.user_id)}>
                            <Unlock className="mr-2 h-4 w-4" /> Desbloquear Usuário
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem className="text-destructive" onClick={() => handleBlock(tenant.user_id)}>
                            <Ban className="mr-2 h-4 w-4" /> Bloquear Usuário
                          </DropdownMenuItem>
                        )}
                        {/* Block/Unblock Store */}
                        <DropdownMenuItem onClick={() => handleToggleStoreBlock(tenant.user_id, tenant.store?.store_blocked || false)}>
                          {tenant.store?.store_blocked ? (
                            <><ShieldCheck className="mr-2 h-4 w-4 text-green-600" /> Desbloquear Loja</>
                          ) : (
                            <><StoreIcon className="mr-2 h-4 w-4 text-orange-500" /> Bloquear Loja</>
                          )}
                        </DropdownMenuItem>
                        {/* Block/Unblock Admin Panel */}
                        <DropdownMenuItem onClick={() => handleToggleAdminBlock(tenant.user_id, tenant.store?.admin_blocked || false)}>
                          {tenant.store?.admin_blocked ? (
                            <><ShieldCheck className="mr-2 h-4 w-4 text-green-600" /> Desbloquear Painel</>
                          ) : (
                            <><ShieldOff className="mr-2 h-4 w-4 text-red-500" /> Bloquear Painel</>
                          )}
                        </DropdownMenuItem>
                        {/* Toggle Promo Banner */}
                        <DropdownMenuItem onClick={() => handleTogglePromoBanner(tenant.user_id, tenant.store?.promo_banner_enabled || false)}>
                          {tenant.store?.promo_banner_enabled ? (
                            <><Megaphone className="mr-2 h-4 w-4 text-orange-500" /> Desativar Banner Promo</>
                          ) : (
                            <><Megaphone className="mr-2 h-4 w-4 text-pink-500" /> Ativar Banner Promo</>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {/* Delete User */}
                        <DropdownMenuItem className="text-destructive" onClick={() => { setDeletingTenant(tenant); setDeleteDialogOpen(true); }}>
                          <Trash2 className="mr-2 h-4 w-4" /> Excluir Tenant
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Assign Plan Dialog */}
      <Dialog open={planDialogOpen} onOpenChange={setPlanDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="h-5 w-5" />
              Gerenciar Plano — {selectedTenant?.display_name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Plano</Label>
              <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                <SelectTrigger><SelectValue placeholder="Selecione um plano" /></SelectTrigger>
                <SelectContent>
                  {plans?.filter(p => p.active).map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.name} — {formatCurrency(plan.price)}/mês (até {plan.max_products} produtos)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedTenant?.subscription && (
              <div className="rounded-lg border border-border p-3 text-sm">
                <p className="text-muted-foreground">Plano atual: <span className="font-medium text-foreground">{(selectedTenant.subscription.tenant_plans as any)?.name || "—"}</span></p>
                <p className="text-muted-foreground">Status: <Badge variant="outline" className="ml-1">{selectedTenant.subscription.status}</Badge></p>
              </div>
            )}

            <div className="flex justify-between">
              {selectedTenant?.subscription && (
                <Button variant="destructive" size="sm" onClick={handleRemovePlan}>
                  Remover Plano
                </Button>
              )}
              <div className="flex gap-2 ml-auto">
                <Button variant="outline" onClick={() => setPlanDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleAssignPlan} disabled={!selectedPlanId}>
                  {selectedTenant?.subscription ? "Alterar Plano" : "Atribuir Plano"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Tenant Detail Dialog */}
      <TenantDetailDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        tenant={detailTenant}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Excluir Tenant Permanentemente
            </DialogTitle>
            <DialogDescription>
              Esta ação é irreversível. Todos os dados do tenant serão excluídos permanentemente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
              <p className="text-sm font-medium">{deletingTenant?.display_name || "Sem nome"}</p>
              <p className="text-xs text-muted-foreground">{deletingTenant?.store?.store_name || "Sem loja"}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {deletingTenant?.productCount || 0} produtos • {deletingTenant?.orders?.count || 0} pedidos
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              Serão excluídos: perfil, loja, produtos, pedidos, cupons, configurações e todos os dados relacionados.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancelar</Button>
              <Button variant="destructive" onClick={handleDeleteUser}>
                <Trash2 className="mr-2 h-4 w-4" /> Excluir Permanentemente
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {/* Send Message Dialog */}
      <Dialog open={msgDialogOpen} onOpenChange={setMsgDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-lg shadow-primary/30">
                <Megaphone className="h-5 w-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-lg">Mensagem direta ao tenant</DialogTitle>
                <DialogDescription className="text-xs">
                  Enviado via push + sino de notificações no painel
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                <Store className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Destinatário</p>
                <p className="text-sm font-bold truncate">{msgTenant?.display_name || msgTenant?.store?.store_name || "Tenant"}</p>
              </div>
            </div>

            {/* Quick templates */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Modelos rápidos</Label>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: "👋 Boas-vindas", title: "Bem-vindo!", body: "Olá! Estamos felizes em ter você na plataforma. Qualquer dúvida, conte com nosso suporte." },
                  { label: "🎁 Promoção", title: "Oferta Especial", body: "Aproveite uma condição exclusiva no seu plano por tempo limitado." },
                  { label: "⚠️ Aviso", title: "Aviso Importante", body: "Por favor, verifique as atualizações recentes em sua conta." },
                  { label: "✨ Novidade", title: "Nova Funcionalidade", body: "Acabamos de liberar um novo recurso que vai ajudar suas vendas!" },
                ].map((tpl) => (
                  <Button
                    key={tpl.label}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs border-primary/20 hover:bg-primary/10 hover:border-primary/40"
                    onClick={() => { setMsgTitle(tpl.title); setMsgBody(tpl.body); }}
                  >
                    {tpl.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Título</Label>
              <Input value={msgTitle} onChange={(e) => setMsgTitle(e.target.value)} placeholder="Título da mensagem" maxLength={60} />
              <p className="text-[10px] text-muted-foreground text-right">{msgTitle.length}/60</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Mensagem</Label>
              <Textarea
                value={msgBody}
                onChange={(e) => setMsgBody(e.target.value)}
                placeholder="Escreva sua mensagem aqui..."
                rows={4}
                maxLength={240}
              />
              <p className="text-[10px] text-muted-foreground text-right">{msgBody.length}/240</p>
            </div>

            {/* Live preview */}
            {(msgTitle || msgBody) && (
              <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Pré-visualização</p>
                <div className="rounded-lg border border-border bg-background p-3 shadow-sm">
                  <div className="flex items-start gap-2">
                    <div className="h-8 w-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                      <Megaphone className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold truncate">{msgTitle || "Título"}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">{msgBody || "Sua mensagem..."}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <Button
              className="w-full bg-gradient-to-r from-primary to-purple-600 hover:opacity-90 font-semibold shadow-lg shadow-primary/30"
              onClick={handleSendMessage}
              disabled={msgSending || !msgBody.trim() || !msgTitle.trim()}
            >
              {msgSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              {msgSending ? "Enviando..." : "Enviar agora"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Grant Free Trial Dialog */}
      <Dialog open={trialDialogOpen} onOpenChange={setTrialDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-pink-500" />
              Liberar Trial Grátis — {trialTenant?.display_name || trialTenant?.store?.store_name}
            </DialogTitle>
            <DialogDescription>
              Conceda acesso gratuito a um plano por um período personalizado. Ao expirar, o tenant precisará assinar para continuar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" /> Plano para liberar
              </Label>
              <Select value={trialPlanId} onValueChange={setTrialPlanId}>
                <SelectTrigger><SelectValue placeholder="Selecione um plano" /></SelectTrigger>
                <SelectContent>
                  {plans?.filter(p => p.active).map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.name} — {formatCurrency(plan.price)}/mês
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-primary" /> Duração do trial (dias)
              </Label>
              <Input
                type="number"
                min={1}
                max={365}
                value={trialDays}
                onChange={(e) => setTrialDays(parseInt(e.target.value) || 0)}
                placeholder="Ex: 7, 14, 30..."
              />
              <div className="flex flex-wrap gap-2 pt-1">
                {[3, 7, 14, 30, 60, 90].map((d) => (
                  <Button
                    key={d}
                    type="button"
                    variant={trialDays === d ? "default" : "outline"}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setTrialDays(d)}
                  >
                    {d} dias
                  </Button>
                ))}
              </div>
            </div>

            {trialDays > 0 && (
              <div className="rounded-lg border border-pink-500/20 bg-pink-500/5 p-3 text-sm">
                <p className="text-muted-foreground">
                  Trial expira em:{" "}
                  <span className="font-medium text-foreground">
                    {new Date(Date.now() + trialDays * 86400000).toLocaleDateString("pt-BR", {
                      day: "2-digit", month: "2-digit", year: "numeric"
                    })}
                  </span>
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setTrialDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleGrantTrial} disabled={trialSaving || !trialPlanId || trialDays < 1}>
                {trialSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Gift className="mr-2 h-4 w-4" />}
                {trialSaving ? "Liberando..." : "Liberar Trial Grátis"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Feature Overrides Dialog */}
      <Dialog open={overridesDialogOpen} onOpenChange={setOverridesDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-500" />
              Liberar Funcionalidades Extras — {overridesTenant?.display_name || overridesTenant?.store?.store_name}
            </DialogTitle>
            <DialogDescription>
              Mantém o plano atual do tenant, mas libera os recursos de um plano superior. Se a assinatura ficar inadimplente, expirar ou for bloqueada, todas as funcionalidades (inclusive as extras) são automaticamente revogadas.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs space-y-1">
              <p><span className="text-muted-foreground">Plano contratado atual:</span>{" "}
                <span className="font-medium text-foreground">{overridesTenant?.subscription?.plan?.name || overridesTenant?.subscription?.tenant_plans?.name || "—"}</span>
              </p>
              <p><span className="text-muted-foreground">Status da assinatura:</span>{" "}
                <span className="font-medium text-foreground">{overridesTenant?.subscription?.status || "—"}</span>
              </p>
              {overridesTenant?.subscription?.feature_overrides && Object.keys(overridesTenant.subscription.feature_overrides).length > 0 && (
                <p className="text-amber-600">
                  ⚡ Já possui {Object.keys(overridesTenant.subscription.feature_overrides).length} funcionalidade(s) extra(s) liberada(s).
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" /> Liberar funções do plano
              </Label>
              <Select value={overridesSourcePlanId} onValueChange={setOverridesSourcePlanId}>
                <SelectTrigger><SelectValue placeholder="Selecione o plano superior" /></SelectTrigger>
                <SelectContent>
                  {plans?.filter((p) => p.active).map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.name} — {formatCurrency(plan.price)}/mês
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Todos os recursos ativos desse plano serão desbloqueados para o tenant, sem alterar o valor cobrado.
              </p>
            </div>

            {overridesSourcePlanId && (() => {
              const sp: any = plans?.find((p) => p.id === overridesSourcePlanId);
              const feats = (typeof sp?.features === "object" && !Array.isArray(sp?.features)) ? sp.features : {};
              const enabled = Object.entries(feats).filter(([_, v]) => typeof v === "boolean" && v === true).map(([k]) => k);
              return (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
                  <p className="font-medium text-foreground mb-1">{enabled.length} recursos serão liberados:</p>
                  <p className="text-muted-foreground leading-relaxed">{enabled.join(", ") || "Nenhum recurso booleano ativo neste plano."}</p>
                </div>
              );
            })()}

            <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-2 pt-2">
              <Button
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => handleApplyOverrides("clear")}
                disabled={overridesSaving || !overridesTenant?.subscription?.feature_overrides || Object.keys(overridesTenant?.subscription?.feature_overrides || {}).length === 0}
              >
                Remover liberação
              </Button>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setOverridesDialogOpen(false)}>Cancelar</Button>
                <Button onClick={() => handleApplyOverrides("grant")} disabled={overridesSaving || !overridesSourcePlanId}>
                  {overridesSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                  {overridesSaving ? "Liberando..." : "Liberar Funcionalidades"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {editTenant && (
        <SensitiveEditDialog
          open={!!editTenant}
          onOpenChange={(o) => !o && setEditTenant(null)}
          tenant={editTenant}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ["all_tenants"] })}
        />
      )}
    </div>
  );
}
