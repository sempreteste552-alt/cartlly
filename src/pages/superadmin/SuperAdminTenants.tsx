import { useState } from "react";
import { useAllTenants } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreVertical, Search, Store, Package, ShoppingCart, Eye, Ban, Unlock, Mail } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export default function SuperAdminTenants() {
  const { data: tenants, isLoading } = useAllTenants();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const queryClient = useQueryClient();

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const filtered = tenants?.filter((t) => {
    const matchSearch = !search.trim() ||
      t.display_name?.toLowerCase().includes(search.toLowerCase()) ||
      t.store?.store_name?.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" ||
      (filter === "active" && t.subscription?.status === "active") ||
      (filter === "trial" && t.subscription?.status === "trial") ||
      (filter === "blocked" && (t.subscription?.status === "blocked" || t.subscription?.status === "expired")) ||
      (filter === "no_plan" && !t.subscription);
    return matchSearch && matchFilter;
  }) ?? [];

  const handleBlock = async (userId: string) => {
    const { error } = await supabase
      .from("tenant_subscriptions")
      .update({ status: "blocked" } as any)
      .eq("user_id", userId);
    if (error) toast.error("Erro: " + error.message);
    else { toast.success("Tenant bloqueado"); queryClient.invalidateQueries({ queryKey: ["all_tenants"] }); }
  };

  const handleUnblock = async (userId: string) => {
    const { error } = await supabase
      .from("tenant_subscriptions")
      .update({ status: "active" } as any)
      .eq("user_id", userId);
    if (error) toast.error("Erro: " + error.message);
    else { toast.success("Tenant desbloqueado"); queryClient.invalidateQueries({ queryKey: ["all_tenants"] }); }
  };

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Tenants</h1>
        <p className="text-muted-foreground">Gerenciar todas as lojas da plataforma</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar tenant..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2">
          {["all", "active", "trial", "blocked", "no_plan"].map((f) => (
            <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)}>
              {{ all: "Todos", active: "Ativos", trial: "Teste", blocked: "Bloqueados", no_plan: "Sem plano" }[f]}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-muted-foreground">Nenhum tenant encontrado</CardContent></Card>
        ) : (
          filtered.map((tenant) => (
            <Card key={tenant.id} className="border-border">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                      <Store className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">{tenant.display_name || "Sem nome"}</p>
                      <p className="text-xs text-muted-foreground">{tenant.store?.store_name || "Sem loja"} {tenant.store?.store_slug ? `• /${tenant.store.store_slug}` : ""}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1"><Package className="h-3.5 w-3.5" />{tenant.productCount}</span>
                      <span className="flex items-center gap-1"><ShoppingCart className="h-3.5 w-3.5" />{tenant.orders?.count || 0}</span>
                      <span className="font-medium text-foreground">{formatCurrency(tenant.orders?.revenue || 0)}</span>
                    </div>

                    <Badge variant={
                      tenant.subscription?.status === "active" ? "default" :
                      tenant.subscription?.status === "trial" ? "secondary" :
                      tenant.subscription?.status === "blocked" ? "destructive" :
                      "outline"
                    }>
                      {tenant.subscription?.status || "sem plano"}
                    </Badge>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => window.open(tenant.store?.store_slug ? `/loja/${tenant.store.store_slug}` : "/loja", "_blank")}>
                          <Eye className="mr-2 h-4 w-4" /> Ver Loja
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toast.info("Funcionalidade em desenvolvimento")}>
                          <Mail className="mr-2 h-4 w-4" /> Enviar Mensagem
                        </DropdownMenuItem>
                        {tenant.subscription?.status !== "blocked" ? (
                          <DropdownMenuItem className="text-destructive" onClick={() => handleBlock(tenant.user_id)}>
                            <Ban className="mr-2 h-4 w-4" /> Bloquear
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => handleUnblock(tenant.user_id)}>
                            <Unlock className="mr-2 h-4 w-4" /> Desbloquear
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
