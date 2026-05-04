import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Settings, Save, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function AITenantSettings() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTenant, setSelectedTenant] = useState<any>(null);

  const { data: tenants, isLoading } = useQuery({
    queryKey: ["ai-tenants", searchTerm],
    queryFn: async () => {
      let query = supabase
        .from("store_settings")
        .select(`
          user_id,
          store_name,
          store_slug,
          tenant_ai_settings (
            is_ai_enabled,
            is_text_gen_enabled,
            is_image_gen_enabled,
            is_smart_automation_enabled
          ),
          tenant_ai_quotas (
            monthly_token_limit,
            daily_token_limit,
            monthly_image_limit,
            monthly_text_limit,
            monthly_push_limit,
            allow_overage
          ),
          tenant_ai_balances (
            balance
          )
        `);
      
      if (searchTerm) {
        query = query.ilike("store_name", `%${searchTerm}%`);
      }

      const { data, error } = await query.limit(20);
      if (error) throw error;
      return data;
    },
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (variables: { tenant_id: string; settings: any; quotas: any; balance: number; tenant_name?: string }) => {
      const { error: sError } = await supabase
        .from("tenant_ai_settings")
        .upsert({ tenant_id: variables.tenant_id, ...variables.settings });
      if (sError) throw sError;

      const { error: qError } = await supabase
        .from("tenant_ai_quotas")
        .upsert({ tenant_id: variables.tenant_id, ...variables.quotas });
      if (qError) throw qError;

      const { error: bError } = await supabase
        .from("tenant_ai_balances")
        .upsert({ tenant_id: variables.tenant_id, balance: variables.balance });
      if (bError) throw bError;

      // Audit log
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("audit_logs").insert({
          actor_user_id: user.id,
          action: "ai.tenant_settings.update",
          target_type: "tenant",
          target_id: variables.tenant_id,
          target_name: variables.tenant_name ?? null,
          details: { settings: variables.settings, quotas: variables.quotas, balance: variables.balance },
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-tenants"] });
      toast.success("Configurações do tenant salvas com sucesso");
      setSelectedTenant(null);
    },
    onError: (error: any) => {
      toast.error(`Erro ao salvar: ${error.message}`);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <h3 className="text-lg font-medium">Configuração por Tenant</h3>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar tenant..." 
            className="pl-8" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-4">
        {tenants?.map((tenant: any) => {
          const aiSettings = tenant.tenant_ai_settings?.[0];
          const aiQuotas = tenant.tenant_ai_quotas?.[0];
          const aiBalance = tenant.tenant_ai_balances?.[0];

          return (
            <Card key={tenant.user_id} className="hover:border-primary/50 transition-colors">
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold">{tenant.store_name}</h4>
                      {aiSettings?.is_ai_enabled ? (
                        <Badge className="bg-green-500/10 text-green-500 hover:bg-green-500/20 border-none">IA Ativa</Badge>
                      ) : (
                        <Badge variant="secondary">IA Inativa</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">ID: {tenant.user_id}</p>
                  </div>

                  <div className="flex flex-wrap gap-2 items-center">
                    <div className="flex gap-4 mr-4">
                      <div className="text-center">
                        <p className="text-[10px] text-muted-foreground uppercase">Saldo</p>
                        <p className="text-sm font-semibold">R$ {aiBalance?.balance || "0,00"}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-muted-foreground uppercase">Limite Texto</p>
                        <p className="text-sm font-semibold">{aiQuotas?.monthly_text_limit || "1000"}</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setSelectedTenant(tenant)} className="gap-2">
                      <Settings className="h-4 w-4" />
                      Configurar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {tenants?.length === 0 && (
          <div className="text-center p-12 bg-muted/30 rounded-lg">
            <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground">Nenhum tenant encontrado.</p>
          </div>
        )}
      </div>

      {selectedTenant && (
        <Dialog open={!!selectedTenant} onOpenChange={(open) => !open && setSelectedTenant(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Configurar IA: {selectedTenant.store_name}</DialogTitle>
              <DialogDescription>
                Ajuste permissões, limites e saldo para este tenant.
              </DialogDescription>
            </DialogHeader>
            <form className="space-y-6" onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              updateSettingsMutation.mutate({
                tenant_id: selectedTenant.user_id,
                tenant_name: selectedTenant.store_name,
                settings: {
                  is_ai_enabled: formData.get("is_ai_enabled") === "on",
                  is_text_gen_enabled: formData.get("is_text_gen_enabled") === "on",
                  is_image_gen_enabled: formData.get("is_image_gen_enabled") === "on",
                  is_smart_automation_enabled: formData.get("is_smart_automation_enabled") === "on",
                },
                quotas: {
                  monthly_text_limit: parseInt(formData.get("monthly_text_limit") as string),
                  monthly_image_limit: parseInt(formData.get("monthly_image_limit") as string),
                  monthly_push_limit: parseInt(formData.get("monthly_push_limit") as string),
                  allow_overage: formData.get("allow_overage") === "on",
                },
                balance: parseFloat(formData.get("balance") as string),
              });
            }}>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h5 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Permissões</h5>
                  <div className="space-y-4 border p-4 rounded-lg">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="is_ai_enabled">Ativar IA Geral</Label>
                      <Switch id="is_ai_enabled" name="is_ai_enabled" defaultChecked={selectedTenant.tenant_ai_settings?.[0]?.is_ai_enabled ?? true} />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="is_text_gen_enabled">Geração de Texto</Label>
                      <Switch id="is_text_gen_enabled" name="is_text_gen_enabled" defaultChecked={selectedTenant.tenant_ai_settings?.[0]?.is_text_gen_enabled ?? true} />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="is_image_gen_enabled">Geração de Imagem</Label>
                      <Switch id="is_image_gen_enabled" name="is_image_gen_enabled" defaultChecked={selectedTenant.tenant_ai_settings?.[0]?.is_image_gen_enabled ?? true} />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="is_smart_automation_enabled">Automações Inteligentes</Label>
                      <Switch id="is_smart_automation_enabled" name="is_smart_automation_enabled" defaultChecked={selectedTenant.tenant_ai_settings?.[0]?.is_smart_automation_enabled ?? true} />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h5 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Limites Mensais</h5>
                  <div className="space-y-3 border p-4 rounded-lg">
                    <div className="space-y-1">
                      <Label htmlFor="monthly_text_limit">Limite de Textos</Label>
                      <Input type="number" id="monthly_text_limit" name="monthly_text_limit" defaultValue={selectedTenant.tenant_ai_quotas?.[0]?.monthly_text_limit ?? 1000} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="monthly_image_limit">Limite de Imagens</Label>
                      <Input type="number" id="monthly_image_limit" name="monthly_image_limit" defaultValue={selectedTenant.tenant_ai_quotas?.[0]?.monthly_image_limit ?? 100} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="monthly_push_limit">Limite de Push</Label>
                      <Input type="number" id="monthly_push_limit" name="monthly_push_limit" defaultValue={selectedTenant.tenant_ai_quotas?.[0]?.monthly_push_limit ?? 5000} />
                    </div>
                    <div className="flex items-center justify-between pt-2">
                      <Label htmlFor="allow_overage">Permitir Excedente</Label>
                      <Switch id="allow_overage" name="allow_overage" defaultChecked={selectedTenant.tenant_ai_quotas?.[0]?.allow_overage ?? false} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2 border p-4 rounded-lg bg-primary/5">
                <Label htmlFor="balance" className="text-primary font-bold">Saldo / Créditos (R$)</Label>
                <Input 
                  type="number" 
                  step="0.01" 
                  id="balance" 
                  name="balance" 
                  className="text-lg font-bold" 
                  defaultValue={selectedTenant.tenant_ai_balances?.[0]?.balance ?? 0} 
                />
                <p className="text-[10px] text-muted-foreground">O saldo será consumido conforme o uso de IA, caso configurado no provedor.</p>
              </div>

              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setSelectedTenant(null)}>Cancelar</Button>
                <Button type="submit" disabled={updateSettingsMutation.isPending} className="gap-2">
                  {updateSettingsMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  <Save className="h-4 w-4" />
                  Salvar Alterações
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
