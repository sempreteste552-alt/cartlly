import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "@/i18n";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Gift, TrendingUp, Search, Filter, Share2, Copy, Check, Package } from "lucide-react";
import { useCustomerReferrals, useCustomerReferralStats } from "@/hooks/useCustomerReferrals";
import { useLoyaltyConfig, useUpsertLoyaltyConfig } from "@/hooks/useLoyalty";
import { useProducts, useUpdateProduct } from "@/hooks/useProducts";
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
  const { data: products } = useProducts();
  const updateProduct = useUpdateProduct();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const url = `${window.location.origin}/s/${slug}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Link da loja copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredReferrals = (referrals || []).filter(r => {
    const matchesSearch = 
      r.referrer?.name?.toLowerCase().includes(search.toLowerCase()) ||
      r.referred?.name?.toLowerCase().includes(search.toLowerCase()) ||
      r.referrer?.email?.toLowerCase().includes(search.toLowerCase()) ||
      r.referred?.email?.toLowerCase().includes(search.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || r.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const localStats = useMemo(() => {
    return {
      total: filteredReferrals.length,
      completed: filteredReferrals.filter(r => r.status === "completed").length,
      pending: filteredReferrals.filter(r => r.status === "pending").length,
    };
  }, [filteredReferrals]);

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
                  <h3 className="text-2xl font-bold">{localStats.total}</h3>
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
                  <p className="text-sm font-medium text-muted-foreground">Cadastros / Compras Indicadas</p>
                  <h3 className="text-2xl font-bold text-green-600">{localStats.completed}</h3>
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
                  <p className="text-sm font-medium text-muted-foreground">Indicações Pendentes</p>
                  <h3 className="text-2xl font-bold text-yellow-600">{localStats.pending}</h3>
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
            <TabsTrigger value="prizes">Produtos de Brinde / Prêmios</TabsTrigger>
          </TabsList>

          <TabsContent value="referrals" className="space-y-4 pt-4">
            <div className="flex flex-col md:flex-row items-center gap-4">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Buscar por nome de cliente..." 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-[200px]">
                  <SelectValue placeholder="Filtrar por status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="completed">Finalizada</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quem Indicou</TableHead>
                    <TableHead>Quem foi Indicado</TableHead>
                    <TableHead>Data Cadastro</TableHead>
                    <TableHead>Status / Evento</TableHead>
                    <TableHead>Pedido Vinculado</TableHead>
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
                        <TableCell className="text-sm">{format(new Date(r.created_at), "dd/MM/yy HH:mm")}</TableCell>
                        <TableCell>
                          <Badge variant={r.status === "completed" ? "default" : "secondary"}>
                            {r.status === "completed" 
                              ? (config?.referral_reward_condition === "sale" ? "Compra Paga" : "Cadastro Realizado") 
                              : "Pendente"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {r.order_id ? (
                            <div className="flex items-center gap-1 font-mono text-xs">
                              <ShoppingCart className="h-3 w-3" />
                              #{r.order_id.slice(0, 8)}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
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
                    <Label>Condição da Recompensa</Label>
                    <Select 
                      value={config?.referral_reward_condition || "sale"} 
                      onValueChange={(val) => upsertConfig.mutate({ ...config, referral_reward_condition: val })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Quando o cliente ganha?" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="lead">Apenas Cadastro (Lead)</SelectItem>
                        <SelectItem value="sale">Compra Aprovada (Venda)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Meta de Indicações (Progresso)</Label>
                    <Input 
                      type="number" 
                      value={config?.referral_goal || 5}
                      onChange={(e) => upsertConfig.mutate({ ...config, referral_goal: Number(e.target.value) })}
                      placeholder="Ex: 5"
                    />
                    <p className="text-xs text-muted-foreground">Define o objetivo final da barra de progresso do cliente</p>
                  </div>

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
                        placeholder="Ex: Cupom de 10% OFF"
                      />
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="space-y-0.5">
                    <Label className="text-base">Ocultar Indicações Pendentes</Label>
                    <p className="text-sm text-muted-foreground">Mostra indicações para os clientes apenas quando forem finalizadas (cadastradas ou pagas)</p>
                  </div>
                  <Switch 
                    checked={!(config?.referral_show_pending ?? true)} 
                    onCheckedChange={(checked) => upsertConfig.mutate({ ...config, referral_show_pending: !checked })} 
                  />
                </div>

                <div className="bg-muted p-4 rounded-lg">
                  <h4 className="text-sm font-bold mb-2">Como funciona?</h4>
                  <ul className="text-xs text-muted-foreground space-y-2 list-disc pl-4">
                    <li>O cliente acessa o painel dele na vitrine e copia o link de indicação único.</li>
                    <li>Um amigo se cadastra usando o link de indicação.</li>
                    {config?.referral_reward_condition === "lead" ? (
                      <li>A recompensa é liberada imediatamente após o cadastro do amigo ser confirmado.</li>
                    ) : (
                      <>
                        <li>O amigo faz a primeira compra na vitrine.</li>
                        <li>Quando o status do pedido for "Entregue", a recompensa é liberada automaticamente.</li>
                      </>
                    )}
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="prizes" className="pt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" />
                  Produtos de Brinde / Prêmios
                </CardTitle>
                <CardDescription>
                  Selecione quais produtos são brindes ou prêmios. Produtos marcados ficam ocultos na loja, 
                  disponíveis apenas para resgate de prêmios.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead>Preço</TableHead>
                      <TableHead className="text-right">É um Prêmio?</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!products || products.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                          Nenhum produto cadastrado
                        </TableCell>
                      </TableRow>
                    ) : (
                      products.map((product) => (
                        <TableRow key={product.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              {product.image_url ? (
                                <img src={product.image_url} alt={product.name} className="h-10 w-10 rounded-md object-cover" />
                              ) : (
                                <div className="h-10 w-10 bg-muted rounded-md flex items-center justify-center">
                                  <Package className="h-5 w-5 text-muted-foreground" />
                                </div>
                              )}
                              <div>
                                <p className="font-medium">{product.name}</p>
                                <p className="text-xs text-muted-foreground line-clamp-1">{product.description}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(product.price)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Switch 
                              checked={!!product.is_prize} 
                              onCheckedChange={(checked) => updateProduct.mutate({ id: product.id, is_prize: checked })}
                            />
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PlanGate>
  );
}
