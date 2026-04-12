import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Copy, Share2, Users, MousePointerClick, CreditCard, Gift, TrendingUp, Check, Search,
  AlertTriangle, Filter, Rocket, Flame, Trophy, Zap, PartyPopper, Star, Target, ArrowRight
} from "lucide-react";
import { useReferralCode, useReferrals, useReferralDiscounts, useReferralStats } from "@/hooks/useReferrals";
import { toast } from "sonner";
import { format } from "date-fns";

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  clicked: { label: "Clicou", variant: "outline" },
  registered: { label: "Cadastrado", variant: "secondary" },
  subscribed: { label: "Assinou", variant: "default" },
  payment_pending: { label: "Pgto Pendente", variant: "outline" },
  payment_approved: { label: "Pgto Aprovado", variant: "default" },
  active: { label: "Ativo", variant: "default" },
  cancelled: { label: "Cancelado", variant: "destructive" },
  flagged: { label: "Suspeito", variant: "destructive" },
  expired: { label: "Expirado", variant: "outline" },
};

function MotivationalHero({ stats, referralLink, handleCopy, handleShare, copied, code, codeLoading }: any) {
  const hasReferrals = stats.registered > 0;
  const hasApproved = stats.approved > 0;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary/90 to-primary/70 p-6 md:p-8 text-primary-foreground">
      {/* Animated background particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-4 right-8 text-4xl opacity-20 animate-bounce" style={{ animationDelay: "0s" }}>🚀</div>
        <div className="absolute top-12 right-32 text-3xl opacity-15 animate-bounce" style={{ animationDelay: "0.5s" }}>💰</div>
        <div className="absolute bottom-8 right-16 text-3xl opacity-20 animate-bounce" style={{ animationDelay: "1s" }}>🔥</div>
        <div className="absolute top-6 left-[60%] text-2xl opacity-10 animate-pulse">⭐</div>
      </div>

      <div className="relative z-10 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-primary-foreground/20 backdrop-blur-sm flex items-center justify-center">
            <Rocket className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight">
              {!hasReferrals ? "Comece a ganhar AGORA!" : hasApproved ? "Você está voando! 🔥" : "Continue indicando!"}
            </h1>
            <p className="text-primary-foreground/80 text-sm md:text-base font-medium">
              {!hasReferrals
                ? "Cada indicação aprovada = desconto REAL na sua mensalidade"
                : `${stats.approved} indicação(ões) já geraram R$ ${stats.totalDiscount.toFixed(2).replace(".", ",")} de desconto!`}
            </p>
          </div>
        </div>

        {/* CTA banner */}
        <div className="bg-primary-foreground/10 backdrop-blur-sm rounded-xl p-4 border border-primary-foreground/20">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
            <div className="flex-1">
              <p className="font-bold text-lg flex items-center gap-2">
                <Flame className="h-5 w-5 text-yellow-300" />
                {!hasReferrals ? "Seu link exclusivo está pronto!" : "Compartilhe mais e ganhe mais!"}
              </p>
              <p className="text-sm text-primary-foreground/70 mt-1">
                Quando alguém se cadastra e assina um plano pago pelo seu link, você ganha desconto automático na sua mensalidade. Sem limite!
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-3">
            <div className="flex-1 rounded-lg bg-primary-foreground/10 border border-primary-foreground/20 px-4 py-2.5 text-sm font-mono truncate select-all">
              {codeLoading ? "Carregando..." : referralLink}
            </div>
            <Button
              variant="secondary"
              size="default"
              onClick={handleCopy}
              disabled={!referralLink}
              className="font-bold gap-2 shrink-0"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copiado!" : "Copiar"}
            </Button>
            <Button
              variant="secondary"
              size="default"
              onClick={handleShare}
              disabled={!referralLink}
              className="font-bold gap-2 shrink-0"
            >
              <Share2 className="h-4 w-4" />
              Compartilhar
            </Button>
          </div>

          {code?.code && (
            <p className="text-xs text-primary-foreground/60 mt-2">
              Código: <span className="font-mono font-bold text-primary-foreground">{code.code}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function MilestoneCards({ stats }: { stats: any }) {
  const milestones = [
    { target: 1, label: "1ª Indicação", icon: Star, reward: "Primeiro desconto!" },
    { target: 5, label: "5 Indicações", icon: Zap, reward: "Desconto acumulado!" },
    { target: 10, label: "10 Indicações", icon: Trophy, reward: "Super desconto!" },
    { target: 25, label: "25 Indicações", icon: PartyPopper, reward: "Lenda!" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {milestones.map((m) => {
        const achieved = stats.approved >= m.target;
        const progress = Math.min(100, (stats.approved / m.target) * 100);
        return (
          <Card
            key={m.target}
            className={`relative overflow-hidden transition-all ${
              achieved
                ? "border-primary/50 bg-primary/5 shadow-md"
                : "border-border bg-card opacity-80"
            }`}
          >
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2 mb-2">
                <m.icon className={`h-5 w-5 ${achieved ? "text-primary" : "text-muted-foreground"}`} />
                <span className={`text-sm font-bold ${achieved ? "text-primary" : "text-muted-foreground"}`}>
                  {m.label}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden mb-1.5">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${achieved ? "bg-primary" : "bg-primary/40"}`}
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground">
                {achieved ? (
                  <span className="text-primary font-bold flex items-center gap-1">
                    <Check className="h-3 w-3" /> {m.reward}
                  </span>
                ) : (
                  `${stats.approved}/${m.target} aprovados`
                )}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export default function Indicacoes() {
  const { data: code, isLoading: codeLoading } = useReferralCode();
  const { data: referrals, isLoading: referralsLoading } = useReferrals();
  const { data: discounts } = useReferralDiscounts();
  const stats = useReferralStats();
  const [copied, setCopied] = useState(false);

  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [emailSearch, setEmailSearch] = useState("");

  const PRODUCTION_ORIGIN = "https://www.cartlly.lovable.app";
  const referralLink = code?.code ? `${PRODUCTION_ORIGIN}/login?ref=${code.code}` : "";

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast.success("Link copiado! Agora é só compartilhar! 🚀");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Crie sua loja online GRÁTIS!",
          text: "🔥 Use meu link de indicação e comece sua loja agora! Rápido, fácil e profissional.",
          url: referralLink,
        });
      } catch {}
    } else {
      handleCopy();
    }
  };

  const filteredReferrals = useMemo(() => {
    let list = (referrals || []).filter((r: any) => r.status !== "clicked");
    if (statusFilter !== "all") list = list.filter((r: any) => r.status === statusFilter);
    if (paymentFilter !== "all") {
      if (paymentFilter === "approved") list = list.filter((r: any) => r.payment_status === "approved");
      else if (paymentFilter === "pending") list = list.filter((r: any) => !r.payment_status || r.payment_status === "pending");
      else if (paymentFilter === "refused") list = list.filter((r: any) => r.payment_status === "refused");
    }
    if (emailSearch.trim()) {
      const q = emailSearch.toLowerCase();
      list = list.filter((r: any) => r.referred_email?.toLowerCase().includes(q));
    }
    return list;
  }, [referrals, statusFilter, paymentFilter, emailSearch]);

  return (
    <div className="space-y-6">
      {/* Aggressive Hero */}
      <MotivationalHero
        stats={stats}
        referralLink={referralLink}
        handleCopy={handleCopy}
        handleShare={handleShare}
        copied={copied}
        code={code}
        codeLoading={codeLoading}
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <MousePointerClick className="h-3.5 w-3.5" /> Cliques
            </div>
            <p className="text-2xl font-bold text-foreground">{stats.clicks}</p>
            <p className="text-[10px] text-muted-foreground">Pessoas acessaram seu link</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Users className="h-3.5 w-3.5" /> Cadastros
            </div>
            <p className="text-2xl font-bold text-foreground">{stats.registered}</p>
            <p className="text-[10px] text-muted-foreground">Se cadastraram</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <CreditCard className="h-3.5 w-3.5" /> Pagos
            </div>
            <p className="text-2xl font-bold text-foreground">{stats.approved}</p>
            <p className="text-[10px] text-muted-foreground">Pagamento aprovado ✅</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <TrendingUp className="h-3.5 w-3.5" /> Ativos
            </div>
            <p className="text-2xl font-bold text-foreground">{stats.activeDiscounts}</p>
            <p className="text-[10px] text-muted-foreground">Gerando desconto</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <AlertTriangle className="h-3.5 w-3.5" /> Suspeitos
            </div>
            <p className="text-2xl font-bold text-foreground">{stats.flagged}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/30 shadow-sm">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-primary text-xs mb-1">
              <Gift className="h-3.5 w-3.5" /> Seu Desconto
            </div>
            <p className="text-2xl font-black text-primary">
              R$ {stats.totalDiscount.toFixed(2).replace(".", ",")}
            </p>
            <p className="text-[10px] text-primary/70 font-medium">Economizado 🎉</p>
          </CardContent>
        </Card>
      </div>

      {/* Milestones */}
      <MilestoneCards stats={stats} />

      {/* How it works mini-guide */}
      <Card className="border-dashed border-2 border-primary/20 bg-primary/[0.02]">
        <CardContent className="py-4 px-5">
          <p className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" /> Como funciona?
          </p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {[
              { step: "1", text: "Copie seu link exclusivo", emoji: "🔗" },
              { step: "2", text: "Envie para amigos e empreendedores", emoji: "📲" },
              { step: "3", text: "Eles se cadastram e assinam um plano", emoji: "✅" },
              { step: "4", text: "Você ganha desconto automático!", emoji: "💰" },
            ].map((s, i) => (
              <div key={i} className="flex items-center gap-2.5 text-sm">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                  {s.step}
                </div>
                <span className="text-muted-foreground">{s.emoji} {s.text}</span>
                {i < 3 && <ArrowRight className="h-3 w-3 text-muted-foreground/40 hidden md:block ml-auto" />}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="referrals">
        <TabsList>
          <TabsTrigger value="referrals">Meus Indicados ({filteredReferrals.length})</TabsTrigger>
          <TabsTrigger value="discounts">Histórico de Descontos</TabsTrigger>
        </TabsList>

        <TabsContent value="referrals" className="mt-4 space-y-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3 text-sm font-medium text-muted-foreground">
                <Filter className="h-4 w-4" /> Filtros
              </div>
              <div className="flex flex-wrap gap-3">
                <div className="w-48">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os status</SelectItem>
                      <SelectItem value="registered">Cadastrado</SelectItem>
                      <SelectItem value="subscribed">Assinou</SelectItem>
                      <SelectItem value="payment_approved">Pgto Aprovado</SelectItem>
                      <SelectItem value="active">Ativo</SelectItem>
                      <SelectItem value="cancelled">Cancelado</SelectItem>
                      <SelectItem value="flagged">Suspeito</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-48">
                  <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Pagamento" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos pagamentos</SelectItem>
                      <SelectItem value="approved">Aprovado</SelectItem>
                      <SelectItem value="pending">Pendente</SelectItem>
                      <SelectItem value="refused">Recusado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Buscar por email..." value={emailSearch} onChange={(e) => setEmailSearch(e.target.value)} className="pl-9 h-9 text-sm" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              {referralsLoading ? (
                <div className="p-8 text-center text-muted-foreground text-sm">Carregando...</div>
              ) : filteredReferrals.length === 0 ? (
                <div className="p-12 text-center space-y-3">
                  <div className="text-4xl">🎯</div>
                  <p className="text-lg font-bold text-foreground">Nenhum indicado ainda!</p>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    Compartilhe seu link agora e comece a ganhar descontos reais na sua mensalidade. Cada pessoa que assinar gera economia pra você!
                  </p>
                  <Button onClick={handleCopy} className="mt-2 gap-2 font-bold">
                    <Copy className="h-4 w-4" /> Copiar Meu Link
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Plano</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Pagamento</TableHead>
                        <TableHead>Fraude</TableHead>
                        <TableHead className="text-right">Desconto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredReferrals.map((r: any) => {
                        const st = statusLabels[r.status] || { label: r.status, variant: "outline" as const };
                        return (
                          <TableRow key={r.id} className={r.flagged ? "bg-destructive/5" : ""}>
                            <TableCell className="font-medium text-sm">{r.referred_email || "—"}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{format(new Date(r.created_at), "dd/MM/yyyy")}</TableCell>
                            <TableCell className="text-sm">{(r.tenant_plans as any)?.name || "—"}</TableCell>
                            <TableCell><Badge variant={st.variant} className="text-xs">{st.label}</Badge></TableCell>
                            <TableCell>
                              <Badge variant={r.payment_status === "approved" ? "default" : "outline"} className="text-xs">
                                {r.payment_status === "approved" ? "Aprovado" : r.payment_status === "refused" ? "Recusado" : "Pendente"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {r.flagged ? (
                                <Badge variant="destructive" className="text-xs"><AlertTriangle className="h-3 w-3 mr-1" /> Suspeito</Badge>
                              ) : <span className="text-xs text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell className="text-right font-medium text-sm">
                              {r.discount_amount > 0
                                ? <span className="text-primary font-bold">R$ {Number(r.discount_amount).toFixed(2).replace(".", ",")}</span>
                                : "—"}
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
                <div className="p-8 text-center text-muted-foreground text-sm">Nenhum desconto gerado ainda.</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Indicado</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Ciclo</TableHead>
                        <TableHead>Aplicado</TableHead>
                        <TableHead>Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {discounts.map((d: any) => (
                        <TableRow key={d.id}>
                          <TableCell className="text-sm">{(d.referrals as any)?.referred_email || "—"}</TableCell>
                          <TableCell className="font-bold text-sm text-primary">R$ {Number(d.amount).toFixed(2).replace(".", ",")}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{d.billing_cycle || "—"}</TableCell>
                          <TableCell><Badge variant={d.applied ? "default" : "outline"} className="text-xs">{d.applied ? "Sim" : "Não"}</Badge></TableCell>
                          <TableCell className="text-xs text-muted-foreground">{format(new Date(d.created_at), "dd/MM/yyyy")}</TableCell>
                        </TableRow>
                      ))}
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
