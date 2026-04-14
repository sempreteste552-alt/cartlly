import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Package, User, LogOut, Heart, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useCustomerAuth } from "@/hooks/useCustomerAuth";
import { useWishlist } from "@/hooks/useWishlist";
import { useCustomerLoyaltyPoints, useLoyaltyConfig } from "@/hooks/useLoyalty";
import { Link } from "react-router-dom";
import { Award, Star, TrendingUp, Gift, Share2, Copy, Check } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface CustomerProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeUserId: string;
  basePath?: string;
}

export function CustomerProfileModal({ open, onOpenChange, storeUserId, basePath }: CustomerProfileModalProps) {
  const { customer, signOut, updateProfile, getOrders } = useCustomerAuth();
  const { wishlistIds, wishlistProducts, toggleWishlist } = useWishlist(storeUserId);
  const [tab, setTab] = useState("profile");
  const { data: loyaltyPoints } = useCustomerLoyaltyPoints(customer?.id, storeUserId);
  const { data: loyaltyConfig } = useLoyaltyConfig();
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [cep, setCep] = useState("");
  const [cpf, setCpf] = useState("");
  const [cepLoading, setCepLoading] = useState(false);

  useEffect(() => {
    if (customer) {
      setName(customer.name || "");
      setPhone(customer.phone || "");
      setAddress(customer.address || "");
      setCity(customer.city || "");
      setState(customer.state || "");
      setCep(customer.cep || "");
      setCpf(customer.cpf || "");
    }
  }, [customer]);

  const lookupCep = useCallback(async (rawCep: string) => {
    const cleanCep = rawCep.replace(/\D/g, "");
    if (cleanCep.length !== 8) return;
    setCepLoading(true);
    try {
      const resp = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await resp.json();
      if (!data.erro) {
        if (data.logradouro) setAddress(data.logradouro + (data.bairro ? `, ${data.bairro}` : ""));
        if (data.localidade) setCity(data.localidade);
        if (data.uf) setState(data.uf);
      }
    } catch {
      // silently ignore
    } finally {
      setCepLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "orders" && open) {
      loadOrders();
    }
  }, [tab, open]);

  const loadOrders = async () => {
    setOrdersLoading(true);
    try {
      const data = await getOrders(storeUserId);
      setOrders(data);
    } catch {
      toast.error("Erro ao carregar pedidos");
    } finally {
      setOrdersLoading(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await updateProfile({ name, phone, address, city, state, cep, cpf });
      toast.success("Dados atualizados!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    onOpenChange(false);
    toast.success("Desconectado com sucesso");
  };

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(price);

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString("pt-BR");

  const statusColors: Record<string, string> = {
    pendente: "bg-yellow-100 text-yellow-800",
    confirmado: "bg-blue-100 text-blue-800",
    enviado: "bg-purple-100 text-purple-800",
    entregue: "bg-green-100 text-green-800",
    cancelado: "bg-red-100 text-red-800",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" /> Minha Conta
          </DialogTitle>
        </DialogHeader>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="profile">Meus Dados</TabsTrigger>
            <TabsTrigger value="orders">Pedidos</TabsTrigger>
            <TabsTrigger value="loyalty" className="flex items-center gap-1">
              <Award className="h-3 w-3" /> Fidelidade
            </TabsTrigger>
            <TabsTrigger value="wishlist" className="flex items-center gap-1">
              <Heart className="h-3 w-3" /> Favoritos
              {wishlistIds.size > 0 && (
                <span className="ml-1 text-xs bg-red-500 text-white rounded-full h-4 w-4 flex items-center justify-center">{wishlistIds.size}</span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome completo" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-9999" />
                </div>
                <div className="space-y-2">
                  <Label>CPF</Label>
                  <Input value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="000.000.000-00" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Endereço</Label>
                <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Rua, número, bairro" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    CEP
                    {cepLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                  </Label>
                  <Input
                    value={cep}
                    onChange={(e) => {
                      const v = e.target.value;
                      setCep(v);
                      const clean = v.replace(/\D/g, "");
                      if (clean.length === 8) lookupCep(v);
                    }}
                    placeholder="00000-000"
                    maxLength={9}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Cidade</Label>
                  <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Cidade" />
                </div>
                <div className="space-y-2">
                  <Label>Estado</Label>
                  <Input value={state} onChange={(e) => setState(e.target.value)} placeholder="UF" maxLength={2} />
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={loading} className="flex-1 bg-black text-white hover:bg-gray-800">
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Salvar Dados
                </Button>
                <Button variant="outline" onClick={handleSignOut} className="text-red-500 hover:text-red-600">
                  <LogOut className="mr-2 h-4 w-4" /> Sair
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="orders">
            <div className="space-y-3 pt-2">
              {ordersLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                </div>
              ) : orders.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Package className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                  <p>Nenhum pedido encontrado</p>
                </div>
              ) : (
                orders.map((order) => (
                  <div key={order.id} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">#{order.id.slice(0, 8)}</span>
                      <Badge className={statusColors[order.status] || "bg-gray-100 text-gray-800"}>
                        {order.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-500">{formatDate(order.created_at)}</p>
                    <Separator />
                    <div className="space-y-1">
                      {order.order_items?.map((item: any) => (
                        <div key={item.id} className="flex justify-between text-xs">
                          <span>{item.quantity}x {item.product_name}</span>
                          <span>{formatPrice(item.unit_price * item.quantity)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <p className="font-semibold text-sm">Total: {formatPrice(order.total)}</p>
                      {basePath && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs font-medium text-primary hover:bg-primary/5"
                          asChild
                          onClick={() => onOpenChange(false)}
                        >
                          <Link to={`${basePath}/rastreio/${order.id}`}>Ver Pedido</Link>
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="loyalty">
            <div className="space-y-6 pt-4 pb-2">
              <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl p-6 text-center border border-primary/20">
                <Award className="h-10 w-10 text-primary mx-auto mb-2" />
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Seu Saldo</p>
                <p className="text-4xl font-black text-primary mt-1">
                  {loyaltyPoints?.points_balance || 0} <span className="text-lg">pts</span>
                </p>
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-xs font-medium">
                    <span>Progresso para resgate</span>
                    <span>{loyaltyPoints?.points_balance || 0} / {loyaltyConfig?.min_redemption || 100} pts</span>
                  </div>
                  <Progress value={Math.min(100, ((loyaltyPoints?.points_balance || 0) / (loyaltyConfig?.min_redemption || 100)) * 100)} className="h-2" />
                  { (loyaltyPoints?.points_balance || 0) >= (loyaltyConfig?.min_redemption || 100) ? (
                    <p className="text-xs text-green-600 font-bold flex items-center justify-center gap-1 mt-2">
                      <Check className="h-3 w-3" /> Você já pode resgatar descontos!
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-2">
                      Faltam {Math.max(0, (loyaltyConfig?.min_redemption || 100) - (loyaltyPoints?.points_balance || 0))} pontos para o próximo resgate
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/50 rounded-xl p-3 border border-border">
                  <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground mb-1">
                    <Star className="h-3 w-3" /> TOTAL GANHO
                  </div>
                  <p className="text-xl font-bold">{loyaltyPoints?.lifetime_points || 0}</p>
                </div>
                <div className="bg-muted/50 rounded-xl p-3 border border-border">
                  <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground mb-1">
                    <TrendingUp className="h-3 w-3" /> VALOR ESTIMADO
                  </div>
                  <p className="text-xl font-bold">R$ {((loyaltyPoints?.points_balance || 0) * (loyaltyConfig?.redemption_rate || 0.01)).toFixed(2)}</p>
                </div>
              </div>

              {loyaltyConfig?.referral_enabled && (
                <div className="bg-yellow-500/5 rounded-2xl p-5 border border-yellow-500/20">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-8 w-8 rounded-full bg-yellow-500/10 flex items-center justify-center">
                      <Gift className="h-4 w-4 text-yellow-600" />
                    </div>
                    <div>
                      <p className="font-bold text-sm">Indique e Ganhe!</p>
                      <p className="text-xs text-muted-foreground">Ganhe {loyaltyConfig.referral_reward_points} pontos por cada amigo!</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-white border rounded-lg px-3 py-2 text-xs font-mono truncate select-all">
                      {window.location.origin}{basePath}?ref={customer?.referral_code}
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="h-9 gap-1.5"
                      onClick={() => {
                        const url = `${window.location.origin}${basePath}?ref=${customer?.referral_code}`;
                        navigator.clipboard.writeText(url);
                        toast.success("Link de indicação copiado!");
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
          <TabsContent value="wishlist">
            <div className="py-4">
              {wishlistIds.size === 0 ? (
                <div className="text-center text-sm text-muted-foreground">
                  <Heart className="h-10 w-10 mx-auto mb-2 text-muted-foreground/30" />
                  <p>Nenhum favorito ainda</p>
                  <p className="text-xs mt-1">Toque no ❤️ nos produtos para salvar</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-foreground">{wishlistIds.size} favorito(s)</p>
                  {wishlistProducts.map((product) => (
                    <div key={product.id} className="flex items-center gap-3 border rounded-lg p-2">
                      <div className="h-16 w-16 rounded-md overflow-hidden bg-muted shrink-0">
                        {product.image_url ? (
                          <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-2xl">📦</div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{product.name}</p>
                        <p className="text-sm font-bold text-primary">{formatPrice(product.price)}</p>
                      </div>
                      <button
                        onClick={() => toggleWishlist(product.id)}
                        className="shrink-0 h-8 w-8 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
                        title="Remover dos favoritos"
                      >
                        <Heart className="h-4 w-4 fill-red-500 text-red-500" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
