import { PlanGate } from "@/components/PlanGate";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Search, Users, Mail, Phone, MapPin, MoreVertical, 
  Edit2, Lock, TrendingUp, ShoppingBag, Filter, Bell
} from "lucide-react";
import { useState, useMemo } from "react";
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, 
  DropdownMenuTrigger, DropdownMenuSeparator 
} from "@/components/ui/dropdown-menu";
import { 
  Dialog, DialogContent, DialogHeader, 
  DialogTitle, DialogFooter 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getPasswordRecoveryErrorMessage, getPasswordResetRedirectUrl } from "@/lib/authRedirect";
import { useTranslation } from "@/i18n";

export default function Clientes() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "orders" | "spent">("name");
  const [editingCustomer, setEditingCustomer] = useState<any>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const { data: customers, isLoading } = useQuery({
    queryKey: ["customers", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("store_user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: orders } = useQuery({
    queryKey: ["all_orders_for_customers", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("customer_email, total, status")
        .eq("user_id", user!.id);
      if (error) throw error;
      return data;
    },
  });

  const customerStats = useMemo(() => {
    if (!orders) return {};
    const stats: Record<string, { count: number; total: number }> = {};
    orders.forEach((o) => {
      if (!o.customer_email) return;
      if (!stats[o.customer_email]) stats[o.customer_email] = { count: 0, total: 0 };
      stats[o.customer_email].count += 1;
      stats[o.customer_email].total += Number(o.total);
    });
    return stats;
  }, [orders]);

  const updateCustomerMutation = useMutation({
    mutationFn: async (updatedData: any) => {
      const { error } = await supabase
        .from("customers")
        .update(updatedData)
        .eq("id", editingCustomer.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setIsEditDialogOpen(false);
      toast.success("Cliente atualizado com sucesso!");
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (email: string) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: getPasswordResetRedirectUrl(),
      });
      if (error) throw new Error(getPasswordRecoveryErrorMessage(error));
    },
    onSuccess: () => toast.success("Link de redefinição enviado para o cliente!"),
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const notifyAdminMutation = useMutation({
    mutationFn: async (customer: any) => {
      const stats = customerStats[customer.email] || { count: 0, total: 0 };
      const { error } = await supabase.from("admin_notifications").insert({
        sender_user_id: user?.id,
        target_user_id: user?.id,
        title: "🔝 Cliente de Alto Valor",
        message: `${customer.name} é um cliente recorrente com ${stats.count} pedidos e total de R$ ${stats.total.toFixed(2)} gastos.`,
        type: "high_value_customer",
        read: false,
      });
      if (error) throw error;
    },
    onSuccess: () => toast.success("Notificação enviada ao painel do admin!"),
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const filtered = useMemo(() => {
    if (!customers) return [];
    let list = [...customers];
    
    if (search.trim()) {
      const term = search.toLowerCase();
      list = list.filter(
        (c: any) =>
          c.name?.toLowerCase().includes(term) ||
          c.email?.toLowerCase().includes(term) ||
          c.phone?.includes(term)
      );
    }

    list.sort((a: any, b: any) => {
      const statsA = customerStats[a.email] || { count: 0, total: 0 };
      const statsB = customerStats[b.email] || { count: 0, total: 0 };
      
      if (sortBy === "orders") return statsB.count - statsA.count;
      if (sortBy === "spent") return statsB.total - statsA.total;
      return (a.name || "").localeCompare(b.name || "");
    });

    return list;
  }, [customers, search, sortBy, customerStats]);

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const data = {
      name: formData.get("name"),
      phone: formData.get("phone"),
      city: formData.get("city"),
      state: formData.get("state"),
      gender: formData.get("gender"),
      routine_notes: formData.get("routine_notes"),
    };
    updateCustomerMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <PlanGate feature="customer_management">
    <div className="space-y-6">
      <div id="customers-header" className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{t.customers.title}</h1>
          <p className="text-muted-foreground">{t.customers.totalCustomers}</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="secondary" className="px-3 py-1">
            <Users className="mr-1.5 h-4 w-4" /> {customers?.length || 0}
          </Badge>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, e-mail ou telefone..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
          <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Ordenar por" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Ordem alfabética</SelectItem>
              <SelectItem value="orders">Mais pedidos</SelectItem>
              <SelectItem value="spent">Maior valor total</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
            <h3 className="text-lg font-medium text-foreground">{t.customers.noCustomers}</h3>
            <p>{t.common.noResults}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filtered.map((customer: any) => {
            const stats = customerStats[customer.email] || { count: 0, total: 0 };
            const isVip = stats.count >= 3 || stats.total > 500;

            return (
              <Card key={customer.id} className={`border-border transition-all hover:shadow-sm ${isVip ? "border-primary/20 bg-primary/5" : ""}`}>
                <CardContent className="p-5">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold ${isVip ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                        {customer.name?.charAt(0)?.toUpperCase() || "?"}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-base">{customer.name}</p>
                          {isVip && (
                            <Badge variant="default" className="bg-primary text-[10px] h-5 px-1.5 font-bold animate-pulse">
                              <TrendingUp className="mr-1 h-3 w-3" /> VIP
                            </Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1.5">
                            <Mail className="h-3.5 w-3.5" /> {customer.email}
                          </span>
                          {customer.phone && (
                            <span className="flex items-center gap-1.5">
                              <Phone className="h-3.5 w-3.5" /> {customer.phone}
                            </span>
                          )}
                          {customer.city && (
                            <span className="flex items-center gap-1.5">
                              <MapPin className="h-3.5 w-3.5" /> {customer.city}, {customer.state}
                            </span>
                          )}
                          {customer.gender && (
                            <Badge variant="outline" className="text-[10px] py-0 h-5">
                              {customer.gender}
                            </Badge>
                          )}
                        </div>
                        {customer.routine_notes && (
                          <p className="text-xs text-primary/70 mt-1 italic line-clamp-1">
                            " {customer.routine_notes} "
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-6 justify-between md:justify-end">
                      <div className="flex gap-4 text-right">
                        <div className="space-y-0.5">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">{t.sidebar.orders}</p>
                          <div className="flex items-center justify-end gap-1 font-medium">
                            <ShoppingBag className="h-3.5 w-3.5 text-primary" /> {stats.count}
                          </div>
                        </div>
                        <div className="space-y-0.5 border-l pl-4 border-border">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">{t.customers.totalSpent}</p>
                          <p className="font-bold text-foreground">
                            R$ {stats.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          <DropdownMenuItem onClick={() => {
                            setEditingCustomer(customer);
                            setIsEditDialogOpen(true);
                          }}>
                            <Edit2 className="mr-2 h-4 w-4" /> Editar Dados
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => resetPasswordMutation.mutate(customer.email)}>
                            <Lock className="mr-2 h-4 w-4" /> Redefinir Senha
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => notifyAdminMutation.mutate(customer)}
                            className="text-primary font-medium"
                          >
                            <Bell className="mr-2 h-4 w-4" /> Notificar Admin (Push)
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit Customer Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Editar Cliente</DialogTitle>
          </DialogHeader>
          {editingCustomer && (
            <form onSubmit={handleEditSubmit}>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Nome Completo</Label>
                  <Input id="name" name="name" defaultValue={editingCustomer.name} required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="phone">Telefone</Label>
                    <Input id="phone" name="phone" defaultValue={editingCustomer.phone} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="gender">Gênero</Label>
                    <Select name="gender" defaultValue={editingCustomer.gender}>
                      <SelectTrigger id="gender">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Masculino">Masculino</SelectItem>
                        <SelectItem value="Feminino">Feminino</SelectItem>
                        <SelectItem value="Outro">Outro</SelectItem>
                        <SelectItem value="Prefiro não dizer">Prefiro não dizer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="city">Cidade</Label>
                    <Input id="city" name="city" defaultValue={editingCustomer.city} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="state">Estado</Label>
                    <Input id="state" name="state" defaultValue={editingCustomer.state} maxLength={2} />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="routine_notes">Notas de Rotina / IA (Hooks)</Label>
                  <Input 
                    id="routine_notes" 
                    name="routine_notes" 
                    defaultValue={editingCustomer.routine_notes} 
                    placeholder="Ex: Gosta de comprar à noite, fã de chocolate amargo..."
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={updateCustomerMutation.isPending}>
                  {updateCustomerMutation.isPending ? "Salvando..." : "Salvar Alterações"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
    </PlanGate>
  );
}
