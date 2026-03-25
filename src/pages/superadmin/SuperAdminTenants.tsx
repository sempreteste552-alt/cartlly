import { useState } from "react";
import { useAllTenants, useAllPlans } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreVertical, Search, Store, Package, ShoppingCart, Eye, Ban, Unlock, CreditCard, UserCog, CheckCircle, XCircle, Clock, Settings } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { TenantDetailDialog } from "@/components/TenantDetailDialog";

export default function SuperAdminTenants() {
  const { data: tenants, isLoading } = useAllTenants();
  const { data: plans } = useAllPlans();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const queryClient = useQueryClient();

  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<any>(null);
  const [selectedPlanId, setSelectedPlanId] = useState("");

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const pendingCount = tenants?.filter(t => t.status === "pending").length || 0;

  const filtered = tenants?.filter((t) => {
    const matchSearch = !search.trim() ||
      t.display_name?.toLowerCase().includes(search.toLowerCase()) ||
      t.store?.store_name?.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" ||
      (filter === "pending" && t.status === "pending") ||
      (filter === "approved" && t.status === "approved") ||
      (filter === "active" && t.subscription?.status === "active") ||
      (filter === "trial" && t.subscription?.status === "trial") ||
      (filter === "blocked" && (t.status === "blocked" || t.subscription?.status === "blocked")) ||
      (filter === "no_plan" && !t.subscription && t.status === "approved");
    return matchSearch && matchFilter;
  }) ?? [];

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
    const { error } = await supabase
      .from("profiles")
      .update({ status: "approved" } as any)
      .eq("user_id", userId);
    if (error) toast.error("Erro: " + error.message);
    else {
      toast.success("Conta aprovada! Notificação enviada.");
      notifyTenant(userId, "approved");
      queryClient.invalidateQueries({ queryKey: ["all_tenants"] });
    }
  };

  const handleReject = async (userId: string) => {
    const { error } = await supabase
      .from("profiles")
      .update({ status: "rejected" } as any)
      .eq("user_id", userId);
    if (error) toast.error("Erro: " + error.message);
    else {
      toast.success("Conta rejeitada. Notificação enviada.");
      notifyTenant(userId, "rejected");
      queryClient.invalidateQueries({ queryKey: ["all_tenants"] });
    }
  };

  const handleBlock = async (userId: string) => {
    const { error } = await supabase
      .from("profiles")
      .update({ status: "blocked" } as any)
      .eq("user_id", userId);
    if (error) toast.error("Erro: " + error.message);
    else {
      toast.success("Tenant bloqueado. Notificação enviada.");
      notifyTenant(userId, "blocked");
      queryClient.invalidateQueries({ queryKey: ["all_tenants"] });
    }
  };

  const handleUnblock = async (userId: string) => {
    const { error } = await supabase
      .from("profiles")
      .update({ status: "approved" } as any)
      .eq("user_id", userId);
    if (error) toast.error("Erro: " + error.message);
    else {
      toast.success("Tenant desbloqueado e aprovado. Notificação enviada.");
      notifyTenant(userId, "approved");
      queryClient.invalidateQueries({ queryKey: ["all_tenants"] });
    }
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

  const getStatusBadge = (tenant: any) => {
    const status = tenant.status;
    if (status === "pending") return <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 border-amber-500/30"><Clock className="mr-1 h-3 w-3" />Pendente</Badge>;
    if (status === "rejected") return <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" />Rejeitado</Badge>;
    if (status === "blocked") return <Badge variant="destructive"><Ban className="mr-1 h-3 w-3" />Bloqueado</Badge>;
    return <Badge variant="default" className="bg-green-600"><CheckCircle className="mr-1 h-3 w-3" />Aprovado</Badge>;
  };

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Tenants</h1>
        <p className="text-muted-foreground">Gerenciar todas as lojas da plataforma ({tenants?.length || 0} tenants)</p>
      </div>

      {/* Pending alert */}
      {pendingCount > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="flex items-center gap-3 p-4">
            <Clock className="h-5 w-5 text-amber-500" />
            <div className="flex-1">
              <p className="font-medium text-amber-600">{pendingCount} conta(s) aguardando aprovação</p>
              <p className="text-xs text-muted-foreground">Revise e aprove para liberar o acesso</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => setFilter("pending")}>Ver pendentes</Button>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar tenant..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2 flex-wrap">
          {[
            { key: "all", label: "Todos" },
            { key: "pending", label: `Pendentes${pendingCount > 0 ? ` (${pendingCount})` : ""}` },
            { key: "approved", label: "Aprovados" },
            { key: "blocked", label: "Bloqueados" },
            { key: "no_plan", label: "Sem plano" },
          ].map((f) => (
            <Button key={f.key} variant={filter === f.key ? "default" : "outline"} size="sm" onClick={() => setFilter(f.key)}>
              {f.label}
            </Button>
          ))}
        </div>
      </div>

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
                      <p className="font-medium">{tenant.display_name || "Sem nome"}</p>
                      <p className="text-xs text-muted-foreground">
                        {tenant.store?.store_name || "Sem loja"} {tenant.store?.store_slug ? `• /${tenant.store.store_slug}` : ""}
                      </p>
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

                    {tenant.status === "pending" ? (
                      <div className="flex gap-1">
                        <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => handleApprove(tenant.user_id)}>
                          <CheckCircle className="mr-1 h-3.5 w-3.5" /> Aprovar
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleReject(tenant.user_id)}>
                          <XCircle className="mr-1 h-3.5 w-3.5" /> Rejeitar
                        </Button>
                      </div>
                    ) : (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => window.open(tenant.store?.store_slug ? `/loja/${tenant.store.store_slug}` : "#", "_blank")}>
                            <Eye className="mr-2 h-4 w-4" /> Ver Loja
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openAssignPlan(tenant)}>
                            <CreditCard className="mr-2 h-4 w-4" /> Gerenciar Plano
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {tenant.status === "blocked" || tenant.status === "rejected" ? (
                            <DropdownMenuItem onClick={() => handleUnblock(tenant.user_id)}>
                              <Unlock className="mr-2 h-4 w-4" /> Desbloquear / Aprovar
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem className="text-destructive" onClick={() => handleBlock(tenant.user_id)}>
                              <Ban className="mr-2 h-4 w-4" /> Bloquear
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
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
    </div>
  );
}
