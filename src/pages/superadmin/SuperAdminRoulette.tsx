import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Edit, Plus, Gift, CheckCircle, XCircle, Clock, Trash2, Settings } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export default function SuperAdminRoulette() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editPrize, setEditPrize] = useState<any>(null);
  const [prizeFormOpen, setPrizeFormOpen] = useState(false);
  const [payoutsEnabled, setPayoutsEnabled] = useState(false);
  
  // Prize Form State
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [prizeType, setPrizeType] = useState("percentage_discount");
  const [prizeValue, setPrizeValue] = useState("");
  const [probability, setProbability] = useState("0.1");
  const [minTier, setMinTier] = useState("FREE");
  const [isActive, setIsActive] = useState(true);
  const [manualApproval, setManualApproval] = useState(false);

  // Fetch Prizes
  const { data: prizes, isLoading: prizesLoading } = useQuery({
    queryKey: ["superadmin_roulette_prizes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("roulette_prizes")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch Spins for Approval
  const { data: spins, isLoading: spinsLoading } = useQuery({
    queryKey: ["superadmin_roulette_spins_pending"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("roulette_spins")
        .select("*, roulette_prizes(*), profiles(display_name)")
        .eq("status", "pending_approval")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch Global Settings
  const { data: globalSettings } = useQuery({
    queryKey: ["superadmin_roulette_settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_settings")
        .select("*")
        .in("key", ["roulette_payouts_enabled"]);
      if (error) throw error;
      
      const payoutsSetting = data?.find(s => s.key === "roulette_payouts_enabled");
      if (payoutsSetting) {
        setPayoutsEnabled(payoutsSetting.value?.value === true);
      }
      return data;
    },
  });

  const togglePayouts = async (enabled: boolean) => {
    try {
      const { error } = await supabase
        .from("platform_settings")
        .upsert({ 
          key: "roulette_payouts_enabled", 
          value: { value: enabled } 
        });
      if (error) throw error;
      setPayoutsEnabled(enabled);
      toast.success(enabled ? "Pagamentos da roleta habilitados!" : "Pagamentos da roleta desabilitados (Todos perderão).");
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    }
  };

  const handleSavePrize = async () => {
    const payload = {
      label,
      description,
      prize_type: prizeType,
      prize_value: parseFloat(prizeValue) || 0,
      probability: parseFloat(probability) || 0.1,
      min_subscription_tier: minTier,
      is_active: isActive,
      manual_approval_required: manualApproval,
    };

    try {
      if (editPrize) {
        const { error } = await supabase
          .from("roulette_prizes")
          .update(payload)
          .eq("id", editPrize.id);
        if (error) throw error;
        toast.success("Prêmio atualizado!");
      } else {
        const { error } = await supabase
          .from("roulette_prizes")
          .insert(payload);
        if (error) throw error;
        toast.success("Prêmio criado!");
      }
      queryClient.invalidateQueries({ queryKey: ["superadmin_roulette_prizes"] });
      setPrizeFormOpen(false);
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    }
  };

  const openEditPrize = (prize: any) => {
    setEditPrize(prize);
    setLabel(prize.label);
    setDescription(prize.description || "");
    setPrizeType(prize.prize_type);
    setPrizeValue(String(prize.prize_value));
    setProbability(String(prize.probability));
    setMinTier(prize.min_subscription_tier);
    setIsActive(prize.is_active);
    setManualApproval(prize.manual_approval_required);
    setPrizeFormOpen(true);
  };

  const openNewPrize = () => {
    setEditPrize(null);
    setLabel("");
    setDescription("");
    setPrizeType("percentage_discount");
    setPrizeValue("");
    setProbability("0.1");
    setMinTier("FREE");
    setIsActive(true);
    setManualApproval(false);
    setPrizeFormOpen(true);
  };

  const handleDeletePrize = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este prêmio?")) return;
    try {
      const { error } = await supabase.from("roulette_prizes").delete().eq("id", id);
      if (error) throw error;
      toast.success("Prêmio excluído!");
      queryClient.invalidateQueries({ queryKey: ["superadmin_roulette_prizes"] });
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    }
  };

  const handleSpinAction = async (spinId: string, status: string) => {
    try {
      const { error } = await supabase
        .from("roulette_spins")
        .update({ status } as any)
        .eq("id", spinId);
      if (error) throw error;
      
      toast.success(status === "won" ? "Prêmio aprovado!" : "Giro recusado.");
      queryClient.invalidateQueries({ queryKey: ["superadmin_roulette_spins_pending"] });
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Roleta de Prêmios</h1>
          <p className="text-muted-foreground">Gerencie prêmios, probabilidades e aprovações de giros.</p>
        </div>
        <Button onClick={openNewPrize}>
          <Plus className="mr-2 h-4 w-4" /> Novo Prêmio
        </Button>
      </div>

      <Tabs defaultValue="prizes" className="w-full">
        <TabsList>
          <TabsTrigger value="prizes" className="flex items-center gap-2">
            <Gift className="h-4 w-4" /> Prêmios
          </TabsTrigger>
          <TabsTrigger value="approvals" className="flex items-center gap-2">
            <Clock className="h-4 w-4" /> Aprovações Pendentes
            {spins && spins.length > 0 && (
              <Badge variant="destructive" className="ml-1 px-1.5 py-0 text-[10px]">
                {spins.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="prizes" className="mt-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {prizesLoading ? (
              Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-40 w-full" />)
            ) : prizes?.map((prize) => (
              <Card key={prize.id} className={!prize.is_active ? "opacity-60" : ""}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div className="flex items-center gap-2">
                    <Gift className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">{prize.label}</CardTitle>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEditPrize(prize)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDeletePrize(prize.id)} className="text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">{prize.description || "Sem descrição"}</p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">{prize.prize_type}</Badge>
                    <Badge variant="outline">Prob: {(prize.probability * 100).toFixed(1)}%</Badge>
                    <Badge variant="outline">Tier: {prize.min_subscription_tier}</Badge>
                    {prize.manual_approval_required && (
                      <Badge className="bg-amber-500">Requer Aprovação</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="approvals" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Solicitações de Prêmios</CardTitle>
            </CardHeader>
            <CardContent>
              {spinsLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : spins && spins.length > 0 ? (
                <div className="space-y-4">
                  {spins.map((spin: any) => (
                    <div key={spin.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <p className="font-bold">{spin.profiles?.display_name || "Tenant Desconhecido"}</p>
                        <p className="text-sm text-muted-foreground">Ganhou: <span className="text-foreground font-medium">{spin.roulette_prizes?.label}</span></p>
                        <p className="text-[10px] text-muted-foreground">{new Date(spin.created_at).toLocaleString()}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="text-destructive border-destructive" onClick={() => handleSpinAction(spin.id, "rejected")}>
                          <XCircle className="mr-2 h-4 w-4" /> Recusar
                        </Button>
                        <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => handleSpinAction(spin.id, "won")}>
                          <CheckCircle className="mr-2 h-4 w-4" /> Aprovar
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  Nenhuma solicitação pendente no momento.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Prize Form Dialog */}
      <Dialog open={prizeFormOpen} onOpenChange={setPrizeFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editPrize ? "Editar Prêmio" : "Novo Prêmio"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Rótulo (Ex: 10% Off)</Label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="O que aparece na roleta" />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Detalhes internos" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de Prêmio</Label>
                <select 
                  className="w-full p-2 border rounded-md bg-background"
                  value={prizeType} 
                  onChange={(e) => setPrizeType(e.target.value)}
                >
                  <option value="percentage_discount">Desconto %</option>
                  <option value="fixed_discount">Valor Fixo</option>
                  <option value="free_gift">Brinde</option>
                  <option value="special_access">Acesso Especial</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Valor</Label>
                <Input type="number" value={prizeValue} onChange={(e) => setPrizeValue(e.target.value)} placeholder="10, 50, etc" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Probabilidade (0-1)</Label>
                <Input type="number" step="0.01" min="0" max="1" value={probability} onChange={(e) => setProbability(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Tier Mínimo</Label>
                <select 
                  className="w-full p-2 border rounded-md bg-background"
                  value={minTier} 
                  onChange={(e) => setMinTier(e.target.value)}
                >
                  <option value="FREE">FREE</option>
                  <option value="STARTER">STARTER</option>
                  <option value="PRO">PRO</option>
                  <option value="PREMIUM">PREMIUM</option>
                </select>
              </div>
            </div>
            <div className="flex items-center justify-between border p-3 rounded-lg">
              <div className="space-y-0.5">
                <Label>Requer Aprovação Manual</Label>
                <p className="text-[10px] text-muted-foreground">O super admin deve liberar o prêmio</p>
              </div>
              <Switch checked={manualApproval} onCheckedChange={setManualApproval} />
            </div>
            <div className="flex items-center justify-between border p-3 rounded-lg">
              <Label>Prêmio Ativo</Label>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPrizeFormOpen(false)}>Cancelar</Button>
            <Button onClick={handleSavePrize}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
