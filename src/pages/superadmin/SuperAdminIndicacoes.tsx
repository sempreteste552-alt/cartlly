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
  Smartphone, Monitor, Laptop, Timer, ArrowRightLeft, Mail, DollarSign, BarChart3,
  EyeOff, Eye
} from "lucide-react";
import { useAllReferrals, useAllReferralCodes, useAllReferralDiscounts, useFlagReferral, useInvalidateDiscount, useOverrideReferralPayment } from "@/hooks/useReferrals";
import { format, differenceInHours, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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

function useEnrichedReferrals() {
  const { data: referrals, isLoading } = useAllReferrals();

  const enriched = useQuery({
    queryKey: ["enriched_referrals", referrals?.length],
    enabled: !!referrals && referrals.length > 0,
    queryFn: async () => {
      const referredIds = [...new Set(referrals!.map((r: any) => r.referred_user_id).filter(Boolean))];
      if (referredIds.length === 0) return referrals;

      const { data: subs } = await supabase
        .from("tenant_subscriptions")
        .select("user_id, status, plan_id, trial_ends_at, current_period_end, tenant_plans:plan_id(name, price)")
        .in("user_id", referredIds);

      const subMap: Record<string, any> = {};
      (subs || []).forEach((s: any) => { subMap[s.user_id] = s; });

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

/* ─── Mobile Card for referral row ─── */
function ReferralMobileCard({ r, flagMutation, overrideMutation }: { r: any; flagMutation: any; overrideMutation: any }) {
  const st = statusLabels[r.status] || { label: r.status, variant: "outline" as const };
  const referrerName = r.referrer_store?.store_name || r.referrer_tenant_id?.substring(0, 8) + "...";
  const { device, icon: DeviceIcon } = parseDevice(r.user_agent);
  const isNotCounted = r.payment_status === "not_counted";

  return (
    <Card className={`${r.flagged ? "border-destructive/40 bg-destructive/5" : ""}`}>
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-sm font-medium">
              <Store className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="truncate">{referrerName}</span>
              <span className="text-muted-foreground">→</span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{r.referred_email || "—"}</p>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <Badge variant={st.variant} className="text-[10px]">{st.label}</Badge>
            {r.flagged && <Badge variant="destructive" className="text-[10px]"><AlertTriangle className="h-2.5 w-2.5 mr-0.5" />Suspeito</Badge>}
          </div>
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-muted-foreground">Código:</span>
            <span className="font-mono font-bold ml-1">{r.referral_code}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Dispositivo:</span>
            <span className="ml-1">{device}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Pagamento:</span>
            <Badge variant={r.payment_status === "approved" ? "default" : isNotCounted ? "destructive" : "outline"} className="text-[10px] ml-1">
              {isNotCounted ? "Não contado" : r.payment_status === "approved" ? "Aprovado" : "Pendente"}
            </Badge>
          </div>
          <div>
            <span className="text-muted-foreground">Data:</span>
            <span className="ml-1">{format(new Date(r.created_at), "dd/MM/yy", { locale: ptBR })}</span>
          </div>
        </div>

        {r.discount_amount > 0 && !isNotCounted && (
          <div className="text-xs text-green-600 font-medium">Desconto: R$ {Number(r.discount_amount).toFixed(2).replace(".", ",")}</div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-1 border-t border-border/50">
          {!r.flagged ? (
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-destructive hover:text-destructive"
              onClick={() => flagMutation.mutate({ id: r.id, flagged: true, reason: "Marcado manualmente pelo admin" })}
              disabled={flagMutation.isPending}>
              <Flag className="h-3 w-3 mr-1" /> Marcar Suspeito
            </Button>
          ) : (
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs"
              onClick={() => flagMutation.mutate({ id: r.id, flagged: false })}
              disabled={flagMutation.isPending}>
              <ShieldCheck className="h-3 w-3 mr-1" /> Limpar
            </Button>
          )}
          {r.payment_status === "approved" && !isNotCounted ? (
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-destructive hover:text-destructive"
              onClick={() => overrideMutation.mutate({ id: r.id, paymentStatus: "not_counted", discountApplied: false })}
              disabled={overrideMutation.isPending}>
              <EyeOff className="h-3 w-3 mr-1" /> Não Contar
            </Button>
          ) : isNotCounted ? (
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-green-600 hover:text-green-700"
              onClick={() => overrideMutation.mutate({ id: r.id, paymentStatus: "approved", discountApplied: true })}
              disabled={overrideMutation.isPending}>
              <Eye className="h-3 w-3 mr-1" /> Restaurar
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

export default function SuperAdminIndicacoes() {
  const { data: referrals, isLoading } = useEnrichedReferrals();
  const { data: codes } = useAllReferralCodes();
  const { data: discounts } = useAllReferralDiscounts();
  const flagMutation = useFlagReferral();
  const invalidateDiscountMutation = useInvalidateDiscount();
  const overrideMutation = useOverrideReferralPayment();

  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [fraudFilter, setFraudFilter] = useState("all");
  const [deviceFilter, setDeviceFilter] = useState("all");
  const [emailSearch, setEmailSearch] = useState("");
  const [tenantSearch, setTenantSearch] = useState("");

  // Stats calculated from filtered list
  const totalReferrals = filtered.length;
  const totalClicked = filtered.filter((r: any) => r.status === "clicked").length;
  const totalRegistered = filtered.filter((r: any) => r.status !== "clicked").length;
  const totalSubscribed = filtered.filter((r: any) => ["subscribed", "payment_pending", "payment_approved", "active"].includes(r.status)).length;
  const totalApproved = filtered.filter((r: any) => ["payment_approved", "active"].includes(r.status) && r.payment_status !== "not_counted").length;
  const totalNotCounted = filtered.filter((r: any) => r.payment_status === "not_counted").length;
  const totalFlagged = filtered.filter((r: any) => r.flagged).length;
  const totalCancelled = filtered.filter((r: any) => r.status === "cancelled").length;
  const totalDiscountValue = filtered.reduce((sum: number, r: any) => {
    // Only sum discount if it's approved and not flagged as not_counted
    if (["payment_approved", "active"].includes(r.status) && r.payment_status !== "not_counted") {
      return sum + Number(r.discount_amount || 0);
    }
    return sum;
  }, 0);

  // We still use totalClicks from code for overall rate if no tenant filter is active
  // but if tenantSearch is active, we might want to adjust. For now, let's keep it simple.
  const totalClicks = tenantSearch.trim() 
    ? filtered.filter((r: any) => r.status === "clicked").length // approximation
    : codes?.reduce((sum: number, c: any) => sum + (c.clicks || 0), 0) || 0;
    
  const conversionRate = totalClicks > 0 ? ((totalRegistered / totalClicks) * 100).toFixed(1) : "0";
  const subRate = totalRegistered > 0 ? ((totalSubscribed / totalRegistered) * 100).toFixed(1) : "0";

  const deviceBreakdown = useMemo(() => {
    const map = { Mobile: 0, Desktop: 0, Tablet: 0, Desconhecido: 0 };
    filtered.forEach((r: any) => {
      const { device } = parseDevice(r.user_agent);
      map[device as keyof typeof map] = (map[device as keyof typeof map] || 0) + 1;
    });
    return map;
  }, [filtered]);

  const topReferrers = useMemo(() => {
    if (!referrals) return [];
    const map: Record<string, { count: number; approved: number; notCounted: number; storeName: string; storeSlug: string; revenue: number }> = {};
    referrals.forEach((r: any) => {
      const id = r.referrer_tenant_id;
      if (!map[id]) {
        map[id] = {
          count: 0, approved: 0, notCounted: 0, revenue: 0,
          storeName: r.referrer_store?.store_name || id.substring(0, 8),
          storeSlug: r.referrer_store?.store_slug || ""
        };
      }
      map[id].count++;
      if (r.payment_status === "not_counted") {
        map[id].notCounted++;
      } else if (["payment_approved", "active"].includes(r.status)) {
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
      else if (paymentFilter === "not_counted") list = list.filter((r: any) => r.payment_status === "not_counted");
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
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Indicações — Visão Global</h1>
        <p className="text-muted-foreground text-xs sm:text-sm mt-1">Acompanhe, audite e gerencie todas as indicações.</p>
      </div>

      {/* Stats Row 1 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
        <Card><CardContent className="pt-3 pb-2 px-3 sm:pt-4 sm:pb-3 sm:px-4">
          <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] sm:text-xs mb-1"><MousePointerClick className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> Cliques</div>
          <p className="text-lg sm:text-2xl font-bold text-foreground">{totalClicks}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-3 pb-2 px-3 sm:pt-4 sm:pb-3 sm:px-4">
          <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] sm:text-xs mb-1"><Users className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> Cadastrados</div>
          <p className="text-lg sm:text-2xl font-bold text-foreground">{totalRegistered}</p>
          <p className="text-[9px] sm:text-[10px] text-muted-foreground">{conversionRate}% conv.</p>
        </CardContent></Card>
        <Card><CardContent className="pt-3 pb-2 px-3 sm:pt-4 sm:pb-3 sm:px-4">
          <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] sm:text-xs mb-1"><CreditCard className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> Pagos</div>
          <p className="text-lg sm:text-2xl font-bold text-foreground">{totalApproved}</p>
        </CardContent></Card>
        <Card className="border-destructive/20 bg-destructive/5"><CardContent className="pt-3 pb-2 px-3 sm:pt-4 sm:pb-3 sm:px-4">
          <div className="flex items-center gap-1.5 text-destructive text-[10px] sm:text-xs mb-1"><EyeOff className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> Não Contados</div>
          <p className="text-lg sm:text-2xl font-bold text-destructive">{totalNotCounted}</p>
        </CardContent></Card>
        <Card className="bg-primary/5 border-primary/20"><CardContent className="pt-3 pb-2 px-3 sm:pt-4 sm:pb-3 sm:px-4">
          <div className="flex items-center gap-1.5 text-primary text-[10px] sm:text-xs mb-1"><Gift className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> Descontos</div>
          <p className="text-lg sm:text-2xl font-bold text-primary">R$ {totalDiscountValue.toFixed(2).replace(".", ",")}</p>
        </CardContent></Card>
      </div>

      {/* Stats Row 2 */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-3">
        <Card><CardContent className="pt-2 pb-2 px-3">
          <div className="flex items-center gap-1 text-muted-foreground text-[10px] mb-0.5"><AlertTriangle className="h-3 w-3" /> Suspeitos</div>
          <p className="text-base sm:text-xl font-bold text-destructive">{totalFlagged}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-2 pb-2 px-3">
          <div className="flex items-center gap-1 text-muted-foreground text-[10px] mb-0.5"><Ban className="h-3 w-3" /> Cancelados</div>
          <p className="text-base sm:text-xl font-bold text-foreground">{totalCancelled}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-2 pb-2 px-3">
          <div className="flex items-center gap-1 text-muted-foreground text-[10px] mb-0.5"><Smartphone className="h-3 w-3" /> Mobile</div>
          <p className="text-base sm:text-xl font-bold text-foreground">{deviceBreakdown.Mobile}</p>
        </CardContent></Card>
        <Card className="hidden sm:block"><CardContent className="pt-2 pb-2 px-3">
          <div className="flex items-center gap-1 text-muted-foreground text-[10px] mb-0.5"><Monitor className="h-3 w-3" /> Desktop</div>
          <p className="text-base sm:text-xl font-bold text-foreground">{deviceBreakdown.Desktop}</p>
        </CardContent></Card>
        <Card className="hidden sm:block"><CardContent className="pt-2 pb-2 px-3">
          <div className="flex items-center gap-1 text-muted-foreground text-[10px] mb-0.5"><BarChart3 className="h-3 w-3" /> Total</div>
          <p className="text-base sm:text-xl font-bold text-foreground">{totalReferrals}</p>
        </CardContent></Card>
      </div>

      {/* Top Referrers */}
      {topReferrers.length > 0 && (
        <Card>
          <CardHeader className="pb-3 px-4">
            <CardTitle className="text-sm sm:text-base flex items-center gap-2"><Store className="h-4 w-4" /> Top Indicadores</CardTitle>
          </CardHeader>
          <CardContent className="pb-4 px-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2 sm:gap-3">
              {topReferrers.map(([id, info], idx) => (
                <div key={id} className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
                  <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs sm:text-sm shrink-0">
                    #{idx + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-medium text-foreground truncate">{info.storeName}</p>
                    <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5">
                      <span className="text-[10px] text-muted-foreground">{info.count} ind.</span>
                      <span className="text-[10px] text-green-600">{info.approved} pagos</span>
                      {info.notCounted > 0 && (
                        <span className="text-[10px] text-destructive">{info.notCounted} não contados</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="referrals">
        <TabsList className="w-full sm:w-auto flex overflow-x-auto">
          <TabsTrigger value="referrals" className="text-xs sm:text-sm flex-1 sm:flex-none">Indicações ({totalReferrals})</TabsTrigger>
          <TabsTrigger value="discounts" className="text-xs sm:text-sm flex-1 sm:flex-none">Descontos ({discounts?.length || 0})</TabsTrigger>
          <TabsTrigger value="codes" className="text-xs sm:text-sm flex-1 sm:flex-none">Códigos ({codes?.length || 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="referrals" className="mt-4 space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-2 mb-2 sm:mb-3 text-xs sm:text-sm font-medium text-muted-foreground">
                <Filter className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Filtros
              </div>
              <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 sm:gap-3">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-8 sm:h-9 text-xs sm:text-sm sm:w-40"><SelectValue placeholder="Status" /></SelectTrigger>
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
                  <SelectTrigger className="h-8 sm:h-9 text-xs sm:text-sm sm:w-40"><SelectValue placeholder="Pagamento" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos pagamentos</SelectItem>
                    <SelectItem value="approved">Aprovado</SelectItem>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="refused">Recusado</SelectItem>
                    <SelectItem value="not_counted">Não Contado</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={fraudFilter} onValueChange={setFraudFilter}>
                  <SelectTrigger className="h-8 sm:h-9 text-xs sm:text-sm sm:w-36"><SelectValue placeholder="Fraude" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="flagged">Suspeitos</SelectItem>
                    <SelectItem value="clean">Limpos</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={deviceFilter} onValueChange={setDeviceFilter}>
                  <SelectTrigger className="h-8 sm:h-9 text-xs sm:text-sm sm:w-36"><SelectValue placeholder="Dispositivo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="Mobile">Mobile</SelectItem>
                    <SelectItem value="Desktop">Desktop</SelectItem>
                    <SelectItem value="Tablet">Tablet</SelectItem>
                  </SelectContent>
                </Select>
                <div className="relative col-span-2 sm:col-span-1 sm:flex-1 sm:min-w-[150px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
                  <Input placeholder="Email indicado..." value={emailSearch} onChange={(e) => setEmailSearch(e.target.value)} className="pl-8 sm:pl-9 h-8 sm:h-9 text-xs sm:text-sm" />
                </div>
                <div className="relative col-span-2 sm:col-span-1 sm:min-w-[150px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
                  <Input placeholder="Loja/código..." value={tenantSearch} onChange={(e) => setTenantSearch(e.target.value)} className="pl-8 sm:pl-9 h-8 sm:h-9 text-xs sm:text-sm" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Mobile cards */}
          <div className="block md:hidden space-y-3">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground text-sm">Carregando...</div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">Nenhuma indicação encontrada.</div>
            ) : (
              filtered.map((r: any) => (
                <ReferralMobileCard key={r.id} r={r} flagMutation={flagMutation} overrideMutation={overrideMutation} />
              ))
            )}
          </div>

          {/* Desktop table */}
          <Card className="hidden md:block">
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
                        <TableHead>Plano</TableHead>
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
                        const isNotCounted = r.payment_status === "not_counted";

                        return (
                          <TableRow key={r.id} className={`${r.flagged ? "bg-destructive/5" : ""} ${isNotCounted ? "opacity-60" : ""}`}>
                            <TableCell>
                              <div className="space-y-0.5">
                                <div className="text-sm font-medium flex items-center gap-1.5">
                                  <Store className="h-3.5 w-3.5 text-muted-foreground" />
                                  <span className="truncate max-w-[120px]" title={referrerName}>{referrerName}</span>
                                </div>
                                {r.referrer_store?.store_slug && (
                                  <span className="text-[10px] text-muted-foreground font-mono">/{r.referrer_store.store_slug}</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-1.5">
                                  <Mail className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-sm font-medium">{r.referred_email || "—"}</span>
                                </div>
                                {profile?.display_name && (
                                  <p className="text-[10px] text-muted-foreground">{profile.display_name}</p>
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
                            <TableCell>
                              {r.referred_store ? (
                                <div className="space-y-0.5">
                                  <div className="text-sm font-medium flex items-center gap-1">
                                    <UserCheck className="h-3 w-3 text-green-500" />
                                    {r.referred_store.store_name}
                                  </div>
                                  <span className="text-[10px] text-muted-foreground font-mono">/{r.referred_store.store_slug}</span>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground italic">Sem loja</span>
                              )}
                            </TableCell>
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
                                      {sub.status === "active" ? "Ativo" : sub.status === "trial" ? "Trial" : sub.status}
                                    </Badge>
                                  </>
                                ) : (
                                  <span className="text-muted-foreground italic">Sem assinatura</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-xs font-mono font-bold">{r.referral_code}</TableCell>
                            <TableCell>
                              <div className="text-xs space-y-0.5">
                                <div className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3 text-muted-foreground" />
                                  {format(createdAt, "dd/MM/yy HH:mm", { locale: ptBR })}
                                </div>
                                {subscribedAt && (
                                  <div className="text-[10px] text-green-600">Assinou: {format(subscribedAt, "dd/MM HH:mm")}</div>
                                )}
                                {approvedAt && (
                                  <div className="text-[10px] text-blue-600">Aprovado: {format(approvedAt, "dd/MM HH:mm")}</div>
                                )}
                                {ttc && (
                                  <div className="flex items-center gap-1 text-[10px] text-primary mt-0.5">
                                    <Timer className="h-3 w-3" /> {ttc}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell><Badge variant={st.variant} className="text-xs">{st.label}</Badge></TableCell>
                            <TableCell>
                              <div className="space-y-0.5">
                                <Badge variant={isNotCounted ? "destructive" : r.payment_status === "approved" ? "default" : "outline"} className="text-xs">
                                  {isNotCounted ? "Não Contado" : r.payment_status === "approved" ? "Aprovado" : "Pendente"}
                                </Badge>
                                {r.discount_amount > 0 && !isNotCounted && (
                                  <div className="text-[10px] text-green-600">
                                    R$ {Number(r.discount_amount).toFixed(2).replace(".", ",")}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5 text-xs">
                                <DeviceIcon className="h-3.5 w-3.5 text-muted-foreground" />
                                <div>
                                  <p className="font-medium">{device}</p>
                                  <p className="text-[10px] text-muted-foreground">{browser}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <IpLocationCell ip={r.ip_address} />
                            </TableCell>
                            <TableCell>
                              {r.flagged ? (
                                <Badge variant="destructive" className="text-xs"><AlertTriangle className="h-3 w-3 mr-1" /> Sim</Badge>
                              ) : <span className="text-xs text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
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
                                {r.payment_status === "approved" && !isNotCounted ? (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                                        onClick={() => overrideMutation.mutate({ id: r.id, paymentStatus: "not_counted", discountApplied: false })}
                                        disabled={overrideMutation.isPending}>
                                        <EyeOff className="h-3 w-3 mr-1" /> Não Contar
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p className="text-xs">Marca como não pago — não gera desconto para o indicador</p>
                                    </TooltipContent>
                                  </Tooltip>
                                ) : isNotCounted ? (
                                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-green-600 hover:text-green-700"
                                    onClick={() => overrideMutation.mutate({ id: r.id, paymentStatus: "approved", discountApplied: true })}
                                    disabled={overrideMutation.isPending}>
                                    <Eye className="h-3 w-3 mr-1" /> Restaurar
                                  </Button>
                                ) : null}
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
                        <TableHead>Status</TableHead>
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
                        <TableHead>Loja</TableHead>
                        <TableHead>Código</TableHead>
                        <TableHead>Cliques</TableHead>
                        <TableHead>Indicados</TableHead>
                        <TableHead>Pagos</TableHead>
                        <TableHead>Conv.</TableHead>
                        <TableHead>Criado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {codes.map((c: any) => {
                        const codeReferrals = referrals?.filter((r: any) => r.referral_code === c.code) || [];
                        const referralCount = codeReferrals.length;
                        const paidCount = codeReferrals.filter((r: any) => ["payment_approved", "active"].includes(r.status) && r.payment_status !== "not_counted").length;
                        const conv = c.clicks > 0 ? ((referralCount / c.clicks) * 100).toFixed(1) : "0";
                        return (
                          <TableRow key={c.id}>
                            <TableCell>
                              <div className="text-sm font-medium">{c.store_name || c.tenant_id?.substring(0, 8) + "..."}</div>
                            </TableCell>
                            <TableCell className="font-mono font-bold text-sm">{c.code}</TableCell>
                            <TableCell className="text-sm">{c.clicks}</TableCell>
                            <TableCell><Badge variant={referralCount > 0 ? "default" : "outline"} className="text-xs">{referralCount}</Badge></TableCell>
                            <TableCell><Badge variant={paidCount > 0 ? "default" : "outline"} className="text-xs">{paidCount}</Badge></TableCell>
                            <TableCell className="text-sm text-muted-foreground">{conv}%</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{format(new Date(c.created_at), "dd/MM/yyyy", { locale: ptBR })}</TableCell>
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
