import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy, Share2, Users, MousePointerClick, CreditCard, Gift, TrendingUp, Check } from "lucide-react";
import { useReferralCode, useReferrals, useReferralDiscounts, useReferralStats } from "@/hooks/useReferrals";
import { toast } from "sonner";
import { format } from "date-fns";

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  clicked: { label: "Clicou", variant: "outline" },
  registered: { label: "Cadastrado", variant: "secondary" },
  subscribed: { label: "Assinou", variant: "default" },
  payment_approved: { label: "Pagamento Aprovado", variant: "default" },
  active: { label: "Ativo", variant: "default" },
  cancelled: { label: "Cancelado", variant: "destructive" },
  expired: { label: "Expirado", variant: "outline" },
};

export default function Indicacoes() {
  const { data: code, isLoading: codeLoading } = useReferralCode();
  const { data: referrals, isLoading: referralsLoading } = useReferrals();
  const { data: discounts } = useReferralDiscounts();
  const stats = useReferralStats();
  const [copied, setCopied] = useState(false);

  const PRODUCTION_ORIGIN = "https://cartlly.lovable.app";
  const referralLink = code?.code
    ? `${PRODUCTION_ORIGIN}/login?ref=${code.code}`
    : "";

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast.success("Link copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Crie sua loja online!",
          text: "Use meu link de indicação e comece sua loja agora!",
          url: referralLink,
        });
      } catch {}
    } else {
      handleCopy();
    }
  };

  const filteredReferrals = (referrals || []).filter((r: any) => r.status !== "clicked");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Indicações</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Indique novos assinantes e ganhe desconto na sua mensalidade.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <MousePointerClick className="h-3.5 w-3.5" /> Cliques
            </div>
            <p className="text-2xl font-bold text-foreground">{stats.clicks}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Users className="h-3.5 w-3.5" /> Cadastros
            </div>
            <p className="text-2xl font-bold text-foreground">{stats.registered}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <CreditCard className="h-3.5 w-3.5" /> Pagos
            </div>
            <p className="text-2xl font-bold text-foreground">{stats.approved}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <TrendingUp className="h-3.5 w-3.5" /> Ativos
            </div>
            <p className="text-2xl font-bold text-foreground">{stats.activeDiscounts}</p>
          </CardContent>
        </Card>
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-primary text-xs mb-1">
              <Gift className="h-3.5 w-3.5" /> Desconto Acumulado
            </div>
            <p className="text-2xl font-bold text-primary">
              R$ {stats.totalDiscount.toFixed(2).replace(".", ",")}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Referral Link */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Seu Link de Indicação</CardTitle>
          <CardDescription>
            Compartilhe este link. O desconto só é ativado quando o indicado assina um plano pago e o pagamento é aprovado.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex-1 rounded-lg border border-border bg-muted/50 px-4 py-2.5 text-sm font-mono text-foreground truncate select-all">
              {codeLoading ? "Carregando..." : referralLink}
            </div>
            <Button variant="outline" size="icon" onClick={handleCopy} disabled={!referralLink}>
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </Button>
            <Button variant="outline" size="icon" onClick={handleShare} disabled={!referralLink}>
              <Share2 className="h-4 w-4" />
            </Button>
          </div>
          {code?.code && (
            <p className="text-xs text-muted-foreground">
              Código: <span className="font-mono font-bold text-foreground">{code.code}</span>
            </p>
          )}
        </CardContent>
      </Card>

      {/* Tabs: Indicados and Descontos */}
      <Tabs defaultValue="referrals">
        <TabsList>
          <TabsTrigger value="referrals">Indicados</TabsTrigger>
          <TabsTrigger value="discounts">Histórico de Descontos</TabsTrigger>
        </TabsList>

        <TabsContent value="referrals" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {referralsLoading ? (
                <div className="p-8 text-center text-muted-foreground text-sm">Carregando...</div>
              ) : filteredReferrals.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  Nenhum indicado ainda. Compartilhe seu link para começar!
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
                        <TableHead className="text-right">Desconto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredReferrals.map((r: any) => {
                        const st = statusLabels[r.status] || { label: r.status, variant: "outline" as const };
                        return (
                          <TableRow key={r.id}>
                            <TableCell className="font-medium text-sm">
                              {r.referred_email || "—"}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {format(new Date(r.created_at), "dd/MM/yyyy")}
                            </TableCell>
                            <TableCell className="text-sm">
                              {(r.tenant_plans as any)?.name || "—"}
                            </TableCell>
                            <TableCell>
                              <Badge variant={st.variant} className="text-xs">
                                {st.label}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={r.payment_status === "approved" ? "default" : "outline"}
                                className="text-xs"
                              >
                                {r.payment_status === "approved" ? "Aprovado" : r.payment_status === "refused" ? "Recusado" : "Pendente"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-medium text-sm">
                              {r.discount_amount > 0
                                ? `R$ ${Number(r.discount_amount).toFixed(2).replace(".", ",")}`
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
                <div className="p-8 text-center text-muted-foreground text-sm">
                  Nenhum desconto gerado ainda.
                </div>
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
                          <TableCell className="text-sm">
                            {(d.referrals as any)?.referred_email || "—"}
                          </TableCell>
                          <TableCell className="font-medium text-sm">
                            R$ {Number(d.amount).toFixed(2).replace(".", ",")}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {d.billing_cycle || "—"}
                          </TableCell>
                          <TableCell>
                            <Badge variant={d.applied ? "default" : "outline"} className="text-xs">
                              {d.applied ? "Sim" : "Não"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {format(new Date(d.created_at), "dd/MM/yyyy")}
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
      </Tabs>
    </div>
  );
}
