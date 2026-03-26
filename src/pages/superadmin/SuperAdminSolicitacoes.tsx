import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowUp, ArrowDown, CheckCircle, XCircle, Clock, Mail, User, Store, CreditCard } from "lucide-react";
import { toast } from "sonner";

export default function SuperAdminSolicitacoes() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [tab, setTab] = useState("pending");

  const { data: requests, isLoading } = useQuery({
    queryKey: ["all_plan_change_requests_full"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plan_change_requests")
        .select("*, requested_plan:tenant_plans!plan_change_requests_requested_plan_id_fkey(*), current_plan:tenant_plans!plan_change_requests_current_plan_id_fkey(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch profiles + store settings for tenant info
  const { data: profiles } = useQuery({
    queryKey: ["all_profiles_for_requests"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: stores } = useQuery({
    queryKey: ["all_stores_for_requests"],
    queryFn: async () => {
      const { data, error } = await supabase.from("store_settings").select("user_id, store_name, store_slug");
      if (error) throw error;
      return data;
    },
  });

  // Get auth emails via profiles (display_name usually has email or name)
  const getTenantInfo = (userId: string) => {
    const profile = profiles?.find((p: any) => p.user_id === userId);
    const store = stores?.find((s: any) => s.user_id === userId);
    return {
      name: profile?.display_name || "Sem nome",
      store_name: store?.store_name || "Sem loja",
      store_slug: store?.store_slug || "",
    };
  };

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const pendingRequests = requests?.filter((r: any) => r.status === "pending") || [];
  const approvedRequests = requests?.filter((r: any) => r.status === "approved") || [];
  const rejectedRequests = requests?.filter((r: any) => r.status === "rejected") || [];

  const handleApprove = async (req: any) => {
    const tenantInfo = getTenantInfo(req.user_id);

    // Check if tenant has existing subscription
    const { data: existingSub } = await supabase
      .from("tenant_subscriptions")
      .select("id")
      .eq("user_id", req.user_id)
      .maybeSingle();

    if (existingSub) {
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
      title: "✅ Solicitação de Plano Aprovada",
      message: `Seu ${req.request_type === "upgrade" ? "upgrade" : "downgrade"} para o plano ${req.requested_plan?.name || "—"} foi aprovado! Seu plano já está ativo.`,
      type: "info",
    } as any);

    toast.success("Solicitação aprovada com sucesso!");
    queryClient.invalidateQueries({ queryKey: ["all_plan_change_requests_full"] });
    queryClient.invalidateQueries({ queryKey: ["all_tenants"] });
  };

  const openRejectDialog = (req: any) => {
    setSelectedRequest(req);
    setRejectReason("");
    setRejectDialogOpen(true);
  };

  const handleReject = async () => {
    if (!selectedRequest) return;
    if (!rejectReason.trim()) {
      toast.error("Descreva o motivo da recusa.");
      return;
    }

    await supabase.from("plan_change_requests").update({
      status: "rejected",
      resolved_at: new Date().toISOString(),
      resolved_by: user!.id,
    } as any).eq("id", selectedRequest.id);

    // Notify tenant with reason
    await supabase.from("admin_notifications").insert({
      sender_user_id: user!.id,
      target_user_id: selectedRequest.user_id,
      title: "❌ Solicitação de Plano Recusada",
      message: `Seu ${selectedRequest.request_type === "upgrade" ? "upgrade" : "downgrade"} para o plano ${selectedRequest.requested_plan?.name || "—"} foi recusado.\n\nMotivo: ${rejectReason}`,
      type: "warning",
    } as any);

    toast.success("Solicitação recusada. Tenant notificado com o motivo.");
    setRejectDialogOpen(false);
    setSelectedRequest(null);
    queryClient.invalidateQueries({ queryKey: ["all_plan_change_requests_full"] });
  };

  const getStatusBadge = (status: string) => {
    if (status === "pending") return <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 border-amber-500/30"><Clock className="mr-1 h-3 w-3" />Aguardando</Badge>;
    if (status === "approved") return <Badge className="bg-green-600 text-white"><CheckCircle className="mr-1 h-3 w-3" />Aprovado</Badge>;
    if (status === "rejected") return <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" />Recusado</Badge>;
    return <Badge variant="outline">{status}</Badge>;
  };

  const renderRequestCard = (req: any) => {
    const tenant = getTenantInfo(req.user_id);
    const isPending = req.status === "pending";

    return (
      <Card key={req.id} className={`border-border ${isPending ? "border-amber-500/40 bg-amber-500/5" : ""}`}>
        <CardContent className="p-5">
          <div className="flex flex-col gap-4">
            {/* Header with type badge + status */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {req.request_type === "upgrade" ? (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/10">
                    <ArrowUp className="h-5 w-5 text-green-600" />
                  </div>
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10">
                    <ArrowDown className="h-5 w-5 text-amber-600" />
                  </div>
                )}
                <div>
                  <p className="font-semibold text-foreground">
                    {req.request_type === "upgrade" ? "Upgrade" : "Downgrade"} de Plano
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(req.created_at).toLocaleDateString("pt-BR")} às {new Date(req.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
              {getStatusBadge(req.status)}
            </div>

            {/* Tenant Info */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-lg border border-border/50 bg-muted/30 p-3">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Tenant</p>
                  <p className="text-sm font-medium">{tenant.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Store className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Loja</p>
                  <p className="text-sm font-medium">{tenant.store_name}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Slug</p>
                  <p className="text-sm font-medium">/{tenant.store_slug || "—"}</p>
                </div>
              </div>
            </div>

            {/* Plan change details */}
            <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-background p-3">
              <CreditCard className="h-5 w-5 text-primary" />
              <div className="flex-1">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium">{req.current_plan?.name || "Sem plano"}</span>
                  <span className="text-muted-foreground">
                    {req.current_plan ? formatCurrency(req.current_plan.price) + "/mês" : "Grátis"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">Plano atual</p>
              </div>
              <div className="text-muted-foreground text-lg">→</div>
              <div className="flex-1">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium text-primary">{req.requested_plan?.name || "—"}</span>
                  <span className="text-muted-foreground">
                    {req.requested_plan ? formatCurrency(req.requested_plan.price) + "/mês" : "—"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">Plano solicitado</p>
              </div>
            </div>

            {/* Resolved info for non-pending */}
            {req.status === "rejected" && req.resolved_at && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <p className="text-xs font-medium text-destructive mb-1">Motivo da Recusa:</p>
                <p className="text-sm text-foreground">
                  {/* The reason is stored in the notification message */}
                  Recusado em {new Date(req.resolved_at).toLocaleDateString("pt-BR")}
                </p>
              </div>
            )}

            {req.status === "approved" && req.resolved_at && (
              <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-3">
                <p className="text-sm text-green-700">
                  ✅ Aprovado em {new Date(req.resolved_at).toLocaleDateString("pt-BR")}
                </p>
              </div>
            )}

            {/* Actions for pending */}
            {isPending && (
              <div className="flex gap-2 justify-end">
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => openRejectDialog(req)}
                >
                  <XCircle className="mr-1 h-4 w-4" /> Recusar
                </Button>
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => handleApprove(req)}
                >
                  <CheckCircle className="mr-1 h-4 w-4" /> Aprovar
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Solicitações de Plano</h1>
        <p className="text-muted-foreground">
          Gerencie upgrades e downgrades solicitados pelos tenants
          {pendingRequests.length > 0 && (
            <Badge variant="secondary" className="ml-2 bg-amber-500/10 text-amber-600 border-amber-500/30">
              {pendingRequests.length} pendente(s)
            </Badge>
          )}
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="pending" className="gap-1">
            <Clock className="h-3.5 w-3.5" />
            Pendentes ({pendingRequests.length})
          </TabsTrigger>
          <TabsTrigger value="approved" className="gap-1">
            <CheckCircle className="h-3.5 w-3.5" />
            Aprovadas ({approvedRequests.length})
          </TabsTrigger>
          <TabsTrigger value="rejected" className="gap-1">
            <XCircle className="h-3.5 w-3.5" />
            Recusadas ({rejectedRequests.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-3 mt-4">
          {pendingRequests.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">Nenhuma solicitação pendente</CardContent></Card>
          ) : pendingRequests.map(renderRequestCard)}
        </TabsContent>

        <TabsContent value="approved" className="space-y-3 mt-4">
          {approvedRequests.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">Nenhuma solicitação aprovada</CardContent></Card>
          ) : approvedRequests.map(renderRequestCard)}
        </TabsContent>

        <TabsContent value="rejected" className="space-y-3 mt-4">
          {rejectedRequests.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">Nenhuma solicitação recusada</CardContent></Card>
          ) : rejectedRequests.map(renderRequestCard)}
        </TabsContent>
      </Tabs>

      {/* Reject Reason Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-destructive" />
              Recusar Solicitação
            </DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border/50 bg-muted/30 p-3 text-sm">
                <p><strong>Tenant:</strong> {getTenantInfo(selectedRequest.user_id).name}</p>
                <p><strong>Tipo:</strong> {selectedRequest.request_type === "upgrade" ? "Upgrade" : "Downgrade"}</p>
                <p><strong>Plano solicitado:</strong> {selectedRequest.requested_plan?.name || "—"}</p>
              </div>
              <div className="space-y-2">
                <Label>Motivo da recusa *</Label>
                <Textarea
                  placeholder="Descreva o motivo da recusa para o tenant..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">
                  O tenant receberá uma notificação com este motivo.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleReject} disabled={!rejectReason.trim()}>
              <XCircle className="mr-1 h-4 w-4" /> Confirmar Recusa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
