import { useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "@/i18n";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Gift, TrendingUp, Search, Filter, Share2, Copy, Check } from "lucide-react";
import { useCustomerReferrals, useCustomerReferralStats } from "@/hooks/useCustomerReferrals";
import { useLoyaltyConfig, useUpsertLoyaltyConfig } from "@/hooks/useLoyalty";
import { toast } from "sonner";
import { format } from "date-fns";
import { PlanGate } from "@/components/PlanGate";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function CustomerReferrals() {
  const { slug } = useParams();
  const { t } = useTranslation();
  const { data: referrals, isLoading: referralsLoading } = useCustomerReferrals();
  const { data: stats } = useCustomerReferralStats();
  const { data: config } = useLoyaltyConfig();
  const upsertConfig = useUpsertLoyaltyConfig();

  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const url = `${window.location.origin}/s/${slug}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Link da loja copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredReferrals = (referrals || []).filter(r => 
    r.referrer?.name?.toLowerCase().includes(search.toLowerCase()) ||
    r.referred?.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <PlanGate feature="referral_program">
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Gift className="h-6 w-6 text-primary" />
              Sistema de Indicações (Vitrine)
            </h1>
            <p className="text-muted-foreground">Gerencie o programa de afiliados para seus clientes da vitrine</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total de Indicações</p>
                  <h3 className="text-2xl font-bold">{stats?.total || 0}</h3>
                </div>
                <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center">
                  <Users className="h-6 w-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Concluídas (Vendas)</p>
                  <h3 className="text-2xl font-bold text-green-600">{stats?.completed || 0}</h3>
                </div>
                <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Pendentes</p>
                  <h3 className="text-2xl font-bold text-yellow-600">{stats?.pending || 0}</h3>
                </div>
                <div className="h-12 w-12 bg-yellow-100 rounded-full flex items-center justify-center">
                  <Filter className="h-6 w-6 text-yellow-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="referrals">
          <TabsList>
            <TabsTrigger value="referrals">Indicados</TabsTrigger>
            <TabsTrigger value="config">Configurar Regras</TabsTrigger>
          </TabsList>

          <TabsContent value="referrals" className="space-y-4 pt-4">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Buscar por nome de cliente..." 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quem Indicou</TableHead>
                    <TableHead>Quem foi Indicado</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Recompensa</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {referralsLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8">Carregando...</TableCell>
                    </TableRow>
                  ) : filteredReferrals.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8">Nenhuma indicação encontrada</TableCell>
                    </TableRow>
                  ) : (
                    filteredReferrals.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium text-sm">{r.referrer?.name || "Cliente Excluído"}</span>
                            <span className="text-xs text-muted-foreground">{r.referrer?.email}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium text-sm">{r.referred?.name || "Cliente Excluído"}</span>
                            <span className="text-xs text-muted-foreground">{r.referred?.email}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{format(new Date(r.created_at), "dd/MM/yyyy HH:mm")}</TableCell>
                        <TableCell>
                          <Badge variant={r.status === "completed" ? "default" : "secondary"}>
                            {r.status === "completed" ? "Finalizada" : "Pendente"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {r.reward_type === "points" ? `${r.reward_value} pts` : r.reward_description}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="config" className="pt-4">
            <Card>
              <CardHeader>
                <CardTitle>Regras de Recompensa</CardTitle>
                <CardDescription>Defina o que seu cliente ganha ao trazer novos clientes para sua vitrine</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Habilitar Programa de Indicações</Label>
                    <p className="text-sm text-muted-foreground">Permite que seus clientes gerem links de convite na vitrine</p>
                  </div>
                  <Switch 
                    checked={config?.referral_enabled || false} 
                    onCheckedChange={(checked) => upsertConfig.mutate({ ...config, referral_enabled: checked })} 
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                  <div className="space-y-2">
                    <Label>Tipo de Recompensa</Label>
                    <Select 
                      value={config?.referral_reward_type || "points"} 
                      onValueChange={(val) => upsertConfig.mutate({ ...config, referral_reward_type: val })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="points">Pontos no Programa de Fidelidade</SelectItem>
                        <SelectItem value="discount">Cupom de Desconto</SelectItem>
                        <SelectItem value="product">Brinde / Produto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {config?.referral_reward_type === "points" ? (
                    <div className="space-y-2">
                      <Label>Quantidade de Pontos</Label>
                      <Input 
                        type="number" 
                        value={config?.referral_reward_points || 0}
                        onChange={(e) => upsertConfig.mutate({ ...config, referral_reward_points: Number(e.target.value) })}
                        placeholder="Ex: 50"
                      />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label>Descrição da Recompensa</Label>
                      <Input 
                        value={config?.referral_reward_description || ""}
                        onChange={(e) => upsertConfig.mutate({ ...config, referral_reward_description: e.target.value })}
                        placeholder="Ex: Cupom de 10% OFF ou 1 Hamburguer Grátis"
                      />
                    </div>
                  )}
                </div>

                <div className="bg-muted p-4 rounded-lg">
                  <h4 className="text-sm font-bold mb-2">Como funciona?</h4>
                  <ul className="text-xs text-muted-foreground space-y-2 list-disc pl-4">
                    <li>O cliente acessa o painel dele na vitrine e copia o link de indicação único.</li>
                    <li>Um amigo se cadastra e faz a primeira compra.</li>
                    <li>Quando o status do pedido for "Entregue" ou "Concluído", a recompensa é liberada automaticamente.</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PlanGate>
  );
}
