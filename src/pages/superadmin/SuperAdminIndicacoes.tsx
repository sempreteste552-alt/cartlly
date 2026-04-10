import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertTriangle, Users, CreditCard, Gift, Search, Filter, Flag, ShieldCheck, Ban,
  MousePointerClick, TrendingUp, Clock, MapPin, Globe, Calendar, Store, UserCheck,
  Smartphone, Monitor, Laptop, Timer, ArrowRightLeft, Mail, DollarSign, BarChart3
} from "lucide-react";
import { useAllReferrals, useAllReferralCodes, useAllReferralDiscounts, useFlagReferral, useInvalidateDiscount } from "@/hooks/useReferrals";
import { format, differenceInHours, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  clicked: { label: "Clicou", variant: "outline" },
  registered: { label: "Cadastrado", variant: "secondary" },
  subscribed: { label: "Assinou", variant: "default" },
  payment_pending: { label: "Pgto Pendente", variant: "outline" },
  payment_approved: { label: "Pgto Aprovado", variant: "default" },
  active: { label: "Ativo", variant: "default" },
  cancelled: { label: "Cancelado", variant: "destructive" },
  flagged: { label: "Suspeito", variant: "destructive" },
};

const ipCache: Record<string, { city?: string; region?: string; country?: string } | null> = {};

function useIpLocation(ip?: string | null) {
  return useQuery({
    queryKey: ["ip_location", ip],
    enabled: !!ip && ip !== "—",
    staleTime: Infinity,
    queryFn: async () => {
      if (!ip) return null;
      if (ipCache[ip] !== undefined) return ipCache[ip];
      try {
        const res = await fetch(`https://ipapi.co/${ip}/json/`);
        if (!res.ok) { ipCache[ip] = null; return null; }
        const data = await res.json();
        const loc = { city: data.city, region: data.region, country: data.country_name };
        ipCache[ip] = loc;
        return loc;
      } catch {
        ipCache[ip] = null;
        return null;
      }
    },
  });
}

function IpLocationCell({ ip }: { ip?: string | null }) {
  const { data: loc } = useIpLocation(ip);
  if (!ip) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div className="text-xs">
      <span className="font-mono text-muted-foreground">{ip}</span>
      {loc?.city && (
        <div className="flex items-center gap-1 text-muted-foreground mt-0.5">
          <MapPin className="h-3 w-3" />
          {loc.city}, {loc.region}
        </div>
      )}
    </div>
  );
}

function parseDevice(ua?: string | null) {
  if (!ua) return { device: "Desconhecido", icon: Monitor };
  const lower = ua.toLowerCase();
  if (lower.includes("mobile") || lower.includes("android") || lower.includes("iphone"))
    return { device: "Mobile", icon: Smartphone };
  if (lower.includes("tablet") || lower.includes("ipad"))
    return { device: "Tablet", icon: Laptop };
  return { device: "Desktop", icon: Monitor };
}

function parseBrowser(ua?: string | null) {
  if (!ua) return "—";
  if (ua.includes("Chrome") && !ua.includes("Edg")) return "Chrome";
  if (ua.includes("Safari") && !ua.includes("Chrome")) return "Safari";
  if (ua.includes("Firefox")) return "Firefox";
  if (ua.includes("Edg")) return "Edge";
  if (ua.includes("Opera") || ua.includes("OPR")) return "Opera";
  return "Outro";
}

function timeToConvert(createdAt: string, subscribedAt?: string | null) {
  if (!subscribedAt) return null;
  const hours = differenceInHours(new Date(subscribedAt), new Date(createdAt));
  if (hours < 1) return "< 1h";
  if (hours < 24) return `${hours}h`;
  const days = differenceInDays(new Date(subscribedAt), new Date(createdAt));
  return `${days}d`;
}

// Enrich referrals with subscription data
function useEnrichedReferrals() {
  const { data: referrals, isLoading } = useAllReferrals();

  const enriched = useQuery({
    queryKey: ["enriched_referrals", referrals?.length],
    enabled: !!referrals && referrals.length > 0,
    queryFn: async () => {
      const referredIds = [...new Set(referrals!.map((r: any) => r.referred_user_id).filter(Boolean))];
      if (referredIds.length === 0) return referrals;

      // Get subscription info
      const { data: subs } = await supabase
        .from("tenant_subscriptions")
        .select("user_id, status, plan_id, trial_ends_at, current_period_end, tenant_plans:plan_id(name, price)")
        .in("user_id", referredIds);

      const subMap: Record<string, any> = {};
      (subs || []).forEach((s: any) => { subMap[s.user_id] = s; });

      // Get profiles for online status
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, is_online, last_seen, status, display_name")
        .in("user_id", referredIds);

      const profileMap: Record<string, any> = {};
      (profiles || []).forEach((p: any) => { profileMap[p.user_id] = p; });

      return referrals!.map((r: any) => ({
        ...r,
        subscription: subMap[r.referred_user_id] || null,
        referred_profile: profileMap[r.referred_user_id] || null,
      }));
    },
  });

  return { data: enriched.data || referrals, isLoading: isLoading || enriched.isLoading };
}

export default function SuperAdminIndicacoes() {
  const { data: referrals, isLoading } = useEnrichedReferrals();
  const { data: codes } = useAllReferralCodes();
  const { data: discounts } = useAllReferralDiscounts();
  const flagMutation = useFlagReferral();
  const invalidateDiscountMutation = useInvalidateDiscount();

  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [fraudFilter, setFraudFilter] = useState("all");
  const [deviceFilter, setDeviceFilter] = useState("all");
  const [emailSearch, setEmailSearch] = useState("");
  const [tenantSearch, setTenantSearch] = useState("");

  // Stats
  const totalReferrals = referrals?.length || 0;
  const totalClicked = referrals?.filter((r: any) => r.status === "clicked").length || 0;
  const totalRegistered = referrals?.filter((r: any) => r.status !== "clicked").length || 0;
  const totalSubscribed = referrals?.filter((r: any) => ["subscribed", "payment_pending", "payment_approved", "active"].includes(r.status)).length || 0;
  const totalApproved = referrals?.filter((r: any) => ["payment_approved", "active"].includes(r.status)).length || 0;
  const totalFlagged = referrals?.filter((r: any) => r.flagged).length || 0;
  const totalCancelled = referrals?.filter((r: any) => r.status === "cancelled").length || 0;
  const totalDiscountValue = discounts?.reduce((sum: number, d: any) => sum + (d.amount || 0), 0) || 0;
  const totalClicks = codes?.reduce((sum: number, c: any) => sum + (c.clicks || 0), 0) || 0;
  const conversionRate = totalClicks > 0 ? ((totalRegistered / totalClicks) * 100).toFixed(1) : "0";
  const subRate = totalRegistered > 0 ? ((totalSubscribed / totalRegistered) * 100).toFixed(1) : "0";

  // Device breakdown
  const deviceBreakdown = useMemo(() => {
    const map = { Mobile: 0, Desktop: 0, Tablet: 0, Desconhecido: 0 };
    (referrals || []).forEach((r: any) => {
      const { device } = parseDevice(r.user_agent);
      map[device as keyof typeof map] = (map[device as keyof typeof map] || 0) + 1;
    });
    return map;
  }, [referrals]);

  // Top referrers
  const topReferrers = useMemo(() => {
    if (!referrals) return [];
    const map: Record<string, { count: number; approved: number; storeName: string; storeSlug: string; revenue: number }> = {};
    referrals.forEach((r: any) => {
      const id = r.referrer_tenant_id;
      if (!map[id]) {
        map[id] = {
          count: 0, approved: 0, revenue: 0,
          storeName: r.referrer_store?.store_name || id.substring(0, 8),
          storeSlug: r.referrer_store?.store_slug || ""
        };
      }
      map[id].count++;
      if (["payment_approved", "active"].includes(r.status)) {
        map[id].approved++;
        map[id].revenue += Number(r.discount_amount || 0);
      }
    });
    return Object.entries(map).sort((a, b) => b[1].count - a[1].count).slice(0, 6);
  }, [referrals]);

  const filtered = useMemo(() => {
    let list = referrals || [];
    if (statusFilter !== "all") list = list.filter((r: any) => r.status === statusFilter);
    if (paymentFilter !== "all") {
      if (paymentFilter === "approved") list = list.filter((r: any) => r.payment_status === "approved");
      else if (paymentFilter === "pending") list = list.filter((r: any) => !r.payment_status || r.payment_status === "pending");
      else if (paymentFilter === "refused") list = list.filter((r: any) => r.payment_status === "refused");
    }
    if (fraudFilter === "flagged") list = list.filter((r: any) => r.flagged);
    else if (fraudFilter === "clean") list = list.filter((r: any) => !r.flagged);
    if (deviceFilter !== "all") {
      list = list.filter((r: any) => parseDevice(r.user_agent).device === deviceFilter);
    }
    if (emailSearch.trim()) {
      const q = emailSearch.toLowerCase();
      list = list.filter((r: any) => r.referred_email?.toLowerCase().includes(q));
    }
    if (tenantSearch.trim()) {
      const q = tenantSearch.toLowerCase();
      list = list.filter((r: any) =>
        r.referrer_tenant_id?.toLowerCase().includes(q) ||
        r.referral_code?.toLowerCase().includes(q) ||
        (r.referrer_store?.store_name || "").toLowerCase().includes(q) ||
        (r.referred_store?.store_name || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [referrals, statusFilter, paymentFilter, fraudFilter, deviceFilter, emailSearch, tenantSearch]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Indicações — Visão Global</h1>
        <p className="text-muted-foreground text-sm mt-1">Acompanhe, audite e gerencie todas as indicações com dados completos de rastreio.</p>
      </div>

      {/* Stats Row 1 */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
        <Card><CardContent className="pt-4 pb-3 px-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><MousePointerClick className="h-3.5 w-3.5" /> Total Cliques</div>
          <p className="text-2xl font-bold text-foreground">{totalClicks}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{totalClicked} com status "clicou"</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3 px-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><Users className="h-3.5 w-3.5" /> Cadastrados</div>
          <p className="text-2xl font-bold text-foreground">{totalRegistered}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Conv. clique→cadastro: {conversionRate}%</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3 px-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><ArrowRightLeft className="h-3.5 w-3.5" /> Assinaram</div>
          <p className="text-2xl font-bold text-foreground">{totalSubscribed}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Conv. cadastro→assinou: {subRate}%</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3 px-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><CreditCard className="h-3.5 w-3.5" /> Pgto Aprovado</div>
          <p className="text-2xl font-bold text-foreground">{totalApproved}</p>
        </CardContent></Card>
        <Card className="bg-primary/5 border-primary/20"><CardContent className="pt-4 pb-3 px-4">
          <div className="flex items-center gap-2 text-primary text-xs mb-1"><Gift className="h-3.5 w-3.5" /> Descontos Gerados</div>
          <p className="text-2xl font-bold text-primary">R$ {totalDiscountValue.toFixed(2).replace(".", ",")}</p>
        </CardContent></Card>
      </div>

      {/* Stats Row 2 - secondary */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
        <Card><CardContent className="pt-3 pb-2 px-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><AlertTriangle className="h-3.5 w-3.5" /> Suspeitos</div>
          <p className="text-xl font-bold text-destructive">{totalFlagged}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-3 pb-2 px-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><Ban className="h-3.5 w-3.5" /> Cancelados</div>
          <p className="text-xl font-bold text-foreground">{totalCancelled}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-3 pb-2 px-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><Smartphone className="h-3.5 w-3.5" /> Mobile</div>
          <p className="text-xl font-bold text-foreground">{deviceBreakdown.Mobile}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-3 pb-2 px-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><Monitor className="h-3.5 w-3.5" /> Desktop</div>
          <p className="text-xl font-bold text-foreground">{deviceBreakdown.Desktop}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-3 pb-2 px-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><BarChart3 className="h-3.5 w-3.5" /> Total Indicações</div>
          <p className="text-xl font-bold text-foreground">{totalReferrals}</p>
        </CardContent></Card>
      </div>

      {/* Top Referrers */}
      {topReferrers.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Store className="h-4 w-4" /> Top Indicadores</CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {topReferrers.map(([id, info], idx) => (
                <div key={id} className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                    #{idx + 1}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{info.storeName}</p>
                    {info.storeSlug && <p className="text-[10px] text-muted-foreground">/{info.storeSlug}</p>}
                    <div className="flex gap-2 mt-0.5">
                      <span className="text-[10px] text-muted-foreground">{info.count} ind.</span>
                      <span className="text-[10px] text-green-600">{info.approved} pagos</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="referrals">
        <TabsList>
          <TabsTrigger value="referrals">Todas Indicações ({totalReferrals})</TabsTrigger>
          <TabsTrigger value="discounts">Descontos ({discounts?.length || 0})</TabsTrigger>
          <TabsTrigger value="codes">Códigos ({codes?.length || 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="referrals" className="mt-4 space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3 text-sm font-medium text-muted-foreground">
                <Filter className="h-4 w-4" /> Filtros
              </div>
              <div className="flex flex-wrap gap-3">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-9 text-sm w-40"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos status</SelectItem>
                    <SelectItem value="clicked">Clicou</SelectItem>
                    <SelectItem value="registered">Cadastrado</SelectItem>
                    <SelectItem value="subscribed">Assinou</SelectItem>
                    <SelectItem value="payment_approved">Pgto Aprovado</SelectItem>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="cancelled">Cancelado</SelectItem>
                    <SelectItem value="flagged">Suspeito</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                  <SelectTrigger className="h-9 text-sm w-40"><SelectValue placeholder="Pagamento" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos pagamentos</SelectItem>
                    <SelectItem value="approved">Aprovado</SelectItem>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="refused">Recusado</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={fraudFilter} onValueChange={setFraudFilter}>
                  <SelectTrigger className="h-9 text-sm w-36"><SelectValue placeholder="Fraude" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="flagged">Suspeitos</SelectItem>
                    <SelectItem value="clean">Limpos</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={deviceFilter} onValueChange={setDeviceFilter}>
                  <SelectTrigger className="h-9 text-sm w-36"><SelectValue placeholder="Dispositivo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos dispositivos</SelectItem>
                    <SelectItem value="Mobile">Mobile</SelectItem>
                    <SelectItem value="Desktop">Desktop</SelectItem>
                    <SelectItem value="Tablet">Tablet</SelectItem>
                  </SelectContent>
                </Select>
                <div className="relative flex-1 min-w-[150px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Email indicado..." value={emailSearch} onChange={(e) => setEmailSearch(e.target.value)} className="pl-9 h-9 text-sm" />
                </div>
                <div className="relative min-w-[150px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Loja/código..." value={tenantSearch} onChange={(e) => setTenantSearch(e.target.value)} className="pl-9 h-9 text-sm" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-8 text-center text-muted-foreground text-sm">Carregando...</div>
              ) : filtered.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">Nenhuma indicação encontrada.</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Indicador</TableHead>
                        <TableHead>Indicado</TableHead>
                        <TableHead>Loja Indicado</TableHead>
                        <TableHead>Plano / Assinatura</TableHead>
                        <TableHead>Código</TableHead>
                        <TableHead>Cronologia</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Pagamento</TableHead>
                        <TableHead>Dispositivo</TableHead>
                        <TableHead>IP / Local</TableHead>
                        <TableHead>Fraude</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((r: any) => {
                        const st = statusLabels[r.status] || { label: r.status, variant: "outline" as const };
                        const referrerName = r.referrer_store?.store_name || r.referrer_tenant_id?.substring(0, 8) + "...";
                        const createdAt = new Date(r.created_at);
                        const clickedAt = r.clicked_at ? new Date(r.clicked_at) : null;
                        const subscribedAt = r.subscribed_at ? new Date(r.subscribed_at) : null;
                        const approvedAt = r.approved_at ? new Date(r.approved_at) : null;
                        const cancelledAt = r.cancelled_at ? new Date(r.cancelled_at) : null;
                        const ttc = timeToConvert(r.created_at, r.subscribed_at);
                        const { device, icon: DeviceIcon } = parseDevice(r.user_agent);
                        const browser = parseBrowser(r.user_agent);
                        const sub = r.subscription;
                        const profile = r.referred_profile;

                        return (
                          <TableRow key={r.id} className={r.flagged ? "bg-destructive/5" : ""}>
                            {/* Indicador */}
                            <TableCell>
                              <div className="space-y-0.5">
                                <div className="text-sm font-medium flex items-center gap-1.5">
                                  <Store className="h-3.5 w-3.5 text-muted-foreground" />
                                  <span className="truncate max-w-[120px]" title={referrerName}>{referrerName}</span>
                                </div>
                                {r.referrer_store?.store_slug && (
                                  <span className="text-[10px] text-muted-foreground font-mono">/{r.referrer_store.store_slug}</span>
                                )}
                                {r.referrer_store?.store_category && (
                                  <Badge variant="outline" className="text-[9px] px-1 py-0">{r.referrer_store.store_category}</Badge>
                                )}
                              </div>
                            </TableCell>

                            {/* Indicado */}
                            <TableCell>
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-1.5">
                                  <Mail className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-sm font-medium">{r.referred_email || "—"}</span>
                                </div>
                                {profile?.display_name && (
                                  <p className="text-[10px] text-muted-foreground">{profile.display_name}</p>
                                )}
                                {r.referred_user_id && (
                                  <span className="text-[10px] font-mono text-muted-foreground">{r.referred_user_id.substring(0, 8)}...</span>
                                )}
                                {profile && (
                                  <div className="flex items-center gap-1 mt-0.5">
                                    <span className={`h-2 w-2 rounded-full ${profile.is_online ? "bg-green-500 animate-pulse" : "bg-muted-foreground/30"}`} />
                                    <span className="text-[10px] text-muted-foreground">
                                      {profile.is_online ? "Online" : profile.last_seen ? `Visto ${format(new Date(profile.last_seen), "dd/MM HH:mm")}` : "Offline"}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </TableCell>

                            {/* Loja do Indicado */}
                            <TableCell>
                              {r.referred_store ? (
                                <div className="space-y-0.5">
                                  <div className="text-sm font-medium flex items-center gap-1">
                                    <UserCheck className="h-3 w-3 text-green-500" />
                                    {r.referred_store.store_name}
                                  </div>
                                  <span className="text-[10px] text-muted-foreground font-mono">/{r.referred_store.store_slug}</span>
                                  {r.referred_store.store_category && (
                                    <Badge variant="outline" className="text-[9px] px-1 py-0">{r.referred_store.store_category}</Badge>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground italic">Sem loja</span>
                              )}
                            </TableCell>

                            {/* Plano / Assinatura */}
                            <TableCell>
                              <div className="text-xs space-y-0.5">
                                {sub ? (
                                  <>
                                    <div className="font-medium flex items-center gap-1">
                                      <DollarSign className="h-3 w-3 text-muted-foreground" />
                                      {(sub.tenant_plans as any)?.name || "—"}
                                    </div>
                                    {(sub.tenant_plans as any)?.price && (
                                      <span className="text-[10px] text-green-600">R$ {Number((sub.tenant_plans as any).price).toFixed(2).replace(".", ",")}/mês</span>
                                    )}
                                    <Badge variant={sub.status === "active" ? "default" : sub.status === "trial" ? "secondary" : "outline"} className="text-[9px]">
                                      {sub.status === "active" ? "Ativo" : sub.status === "trial" ? "Trial" : sub.status === "expired" ? "Expirado" : sub.status}
                                    </Badge>
                                    {sub.trial_ends_at && sub.status === "trial" && (
                                      <p className="text-[10px] text-muted-foreground">Trial até {format(new Date(sub.trial_ends_at), "dd/MM/yy")}</p>
                                    )}
                                  </>
                                ) : (
                                  <>
                                    <span className="text-muted-foreground italic">Sem assinatura</span>
                                    {(r.tenant_plans as any)?.name && (
                                      <p className="text-[10px]">Plano ref: {(r.tenant_plans as any).name}</p>
                                    )}
                                  </>
                                )}
                              </div>
                            </TableCell>

                            {/* Código */}
                            <TableCell className="text-xs font-mono font-bold">{r.referral_code}</TableCell>

                            {/* Cronologia */}
                            <TableCell>
                              <div className="text-xs space-y-0.5">
                                <div className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3 text-muted-foreground" />
                                  {format(createdAt, "dd/MM/yy HH:mm", { locale: ptBR })}
                                </div>
                                {clickedAt && (
                                  <div className="text-[10px] text-muted-foreground">Clicou: {format(clickedAt, "dd/MM HH:mm")}</div>
                                )}
                                {subscribedAt && (
                                  <div className="text-[10px] text-green-600">Assinou: {format(subscribedAt, "dd/MM HH:mm")}</div>
                                )}
                                {approvedAt && (
                                  <div className="text-[10px] text-blue-600">Aprovado: {format(approvedAt, "dd/MM HH:mm")}</div>
                                )}
                                {cancelledAt && (
                                  <div className="text-[10px] text-destructive">Cancelou: {format(cancelledAt, "dd/MM HH:mm")}</div>
                                )}
                                {ttc && (
                                  <div className="flex items-center gap-1 text-[10px] text-primary mt-0.5">
                                    <Timer className="h-3 w-3" /> Conversão: {ttc}
                                  </div>
                                )}
                              </div>
                            </TableCell>

                            {/* Status */}
                            <TableCell><Badge variant={st.variant} className="text-xs">{st.label}</Badge></TableCell>

                            {/* Pagamento */}
                            <TableCell>
                              <Badge variant={r.payment_status === "approved" ? "default" : "outline"} className="text-xs">
                                {r.payment_status === "approved" ? "Aprovado" : r.payment_status === "refused" ? "Recusado" : "Pendente"}
                              </Badge>
                              {r.discount_amount > 0 && (
                                <div className="text-[10px] text-green-600 mt-0.5">
                                  R$ {Number(r.discount_amount).toFixed(2).replace(".", ",")}
                                </div>
                              )}
                            </TableCell>

                            {/* Dispositivo */}
                            <TableCell>
                              <div className="flex items-center gap-1.5 text-xs">
                                <DeviceIcon className="h-3.5 w-3.5 text-muted-foreground" />
                                <div>
                                  <p className="font-medium">{device}</p>
                                  <p className="text-[10px] text-muted-foreground">{browser}</p>
                                </div>
                              </div>
                            </TableCell>

                            {/* IP / Local */}
                            <TableCell>
                              <IpLocationCell ip={r.ip_address} />
                            </TableCell>

                            {/* Fraude */}
                            <TableCell>
                              {r.flagged ? (
                                <div>
                                  <Badge variant="destructive" className="text-xs"><AlertTriangle className="h-3 w-3 mr-1" /> Sim</Badge>
                                  {r.flagged_reason && <p className="text-[10px] text-destructive mt-0.5 max-w-[120px] truncate" title={r.flagged_reason}>{r.flagged_reason}</p>}
                                </div>
                              ) : <span className="text-xs text-muted-foreground">—</span>}
                            </TableCell>

                            {/* Ações */}
                            <TableCell>
                              <div className="flex gap-1">
                                {!r.flagged ? (
                                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                                    onClick={() => flagMutation.mutate({ id: r.id, flagged: true, reason: "Marcado manualmente pelo admin" })}
                                    disabled={flagMutation.isPending}>
                                    <Flag className="h-3 w-3 mr-1" /> Marcar
                                  </Button>
                                ) : (
                                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs"
                                    onClick={() => flagMutation.mutate({ id: r.id, flagged: false })}
                                    disabled={flagMutation.isPending}>
                                    <ShieldCheck className="h-3 w-3 mr-1" /> Limpar
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="discounts" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {!discounts || discounts.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">Nenhum desconto gerado.</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tenant</TableHead>
                        <TableHead>Email Indicado</TableHead>
                        <TableHead>Status Indicação</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Ciclo</TableHead>
                        <TableHead>Aplicado</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {discounts.map((d: any) => (
                        <TableRow key={d.id}>
                          <TableCell>
                            <div className="text-sm font-mono">{d.tenant_id?.substring(0, 8)}...</div>
                          </TableCell>
                          <TableCell className="text-sm">{(d.referrals as any)?.referred_email || "—"}</TableCell>
                          <TableCell>
                            {(d.referrals as any)?.status && (
                              <Badge variant={statusLabels[(d.referrals as any).status]?.variant || "outline"} className="text-xs">
                                {statusLabels[(d.referrals as any).status]?.label || (d.referrals as any).status}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="font-medium text-sm">R$ {Number(d.amount).toFixed(2).replace(".", ",")}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{d.billing_cycle || "—"}</TableCell>
                          <TableCell><Badge variant={d.applied ? "default" : "outline"} className="text-xs">{d.applied ? "Sim" : "Não"}</Badge></TableCell>
                          <TableCell className="text-xs text-muted-foreground">{format(new Date(d.created_at), "dd/MM/yy HH:mm")}</TableCell>
                          <TableCell>
                            {d.amount > 0 && (
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                                onClick={() => invalidateDiscountMutation.mutate({ discountId: d.id })}
                                disabled={invalidateDiscountMutation.isPending}>
                                <Ban className="h-3 w-3 mr-1" /> Invalidar
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="codes" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {!codes || codes.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">Nenhum código de indicação.</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Loja (Tenant)</TableHead>
                        <TableHead>Código</TableHead>
                        <TableHead>Cliques</TableHead>
                        <TableHead>Indicados</TableHead>
                        <TableHead>Pagos</TableHead>
                        <TableHead>Conversão</TableHead>
                        <TableHead>Criado em</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {codes.map((c: any) => {
                        const codeReferrals = referrals?.filter((r: any) => r.referral_code === c.code) || [];
                        const referralCount = codeReferrals.length;
                        const paidCount = codeReferrals.filter((r: any) => ["payment_approved", "active"].includes(r.status)).length;
                        const conv = c.clicks > 0 ? ((referralCount / c.clicks) * 100).toFixed(1) : "0";
                        return (
                          <TableRow key={c.id}>
                            <TableCell>
                              <div className="text-sm font-medium">{c.store_name || c.tenant_id?.substring(0, 8) + "..."}</div>
                              <span className="text-[10px] font-mono text-muted-foreground">{c.tenant_id?.substring(0, 8)}...</span>
                            </TableCell>
                            <TableCell className="font-mono font-bold text-sm">{c.code}</TableCell>
                            <TableCell className="text-sm">{c.clicks}</TableCell>
                            <TableCell>
                              <Badge variant={referralCount > 0 ? "default" : "outline"} className="text-xs">{referralCount}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={paidCount > 0 ? "default" : "outline"} className="text-xs">{paidCount}</Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{conv}%</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{format(new Date(c.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
