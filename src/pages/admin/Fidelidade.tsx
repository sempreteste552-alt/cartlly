import { PlanGate } from "@/components/PlanGate";
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Award, Gift, Star, TrendingUp, Users, Loader2 } from "lucide-react";
import { useLoyaltyConfig, useUpsertLoyaltyConfig, useLoyaltyPoints, useLoyaltyTransactions } from "@/hooks/useLoyalty";
import { toast } from "sonner";

export default function Fidelidade() {
  const { data: config, isLoading } = useLoyaltyConfig();
  const { data: points } = useLoyaltyPoints();
  const { data: transactions } = useLoyaltyTransactions();
  const upsert = useUpsertLoyaltyConfig();

  const [enabled, setEnabled] = useState(false);
  const [pointsPerReal, setPointsPerReal] = useState("1");
  const [redemptionRate, setRedemptionRate] = useState("0.01");
  const [minRedemption, setMinRedemption] = useState("100");
  const [referralEnabled, setReferralEnabled] = useState(false);
  const [referralPoints, setReferralPoints] = useState("50");

  useEffect(() => {
    if (config) {
      setEnabled(config.enabled);
      setPointsPerReal(String(config.points_per_real));
      setRedemptionRate(String(config.redemption_rate));
      setMinRedemption(String(config.min_redemption));
      setReferralEnabled(config.referral_enabled || false);
      setReferralPoints(String(config.referral_reward_points || 50));
    }
  }, [config]);

  const handleSave = () => {
    upsert.mutate(
      {
        enabled,
        points_per_real: Number(pointsPerReal),
        redemption_rate: Number(redemptionRate),
        min_redemption: Number(minRedemption),
      },
      { onSuccess: () => toast.success("Configurações de fidelidade salvas!") }
    );
  };

  const totalCustomers = points?.length || 0;
  const totalPoints = points?.reduce((s: number, p: any) => s + (p.points_balance || 0), 0) || 0;
  const totalLifetime = points?.reduce((s: number, p: any) => s + (p.lifetime_points || 0), 0) || 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <PlanGate feature="loyalty_program">
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Award className="h-6 w-6 text-primary" />
          Programa de Fidelidade
        </h1>
        <p className="text-muted-foreground">Configure cashback e pontos para seus clientes</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalCustomers}</p>
              <p className="text-xs text-muted-foreground">Clientes com pontos</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-yellow-500/10 flex items-center justify-center">
              <Star className="h-5 w-5 text-yellow-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalPoints.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Pontos ativos</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalLifetime.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Pontos distribuídos (total)</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Config */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5" />
            Configurações
          </CardTitle>
          <CardDescription>Defina as regras do programa de fidelidade</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base font-medium">Ativar programa</Label>
              <p className="text-sm text-muted-foreground">Clientes ganham pontos a cada compra</p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Pontos por R$ gasto</Label>
              <Input
                type="number"
                min="0.1"
                step="0.1"
                value={pointsPerReal}
                onChange={(e) => setPointsPerReal(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Ex: 1 = a cada R$1 gasto, ganha 1 ponto
              </p>
            </div>
            <div className="space-y-2">
              <Label>Valor do ponto (R$)</Label>
              <Input
                type="number"
                min="0.001"
                step="0.001"
                value={redemptionRate}
                onChange={(e) => setRedemptionRate(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Ex: 0.01 = cada ponto vale R$0,01
              </p>
            </div>
            <div className="space-y-2">
              <Label>Mínimo para resgate</Label>
              <Input
                type="number"
                min="1"
                value={minRedemption}
                onChange={(e) => setMinRedemption(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Pontos mínimos para resgatar desconto
              </p>
            </div>
          </div>

          {enabled && (
            <div className="rounded-lg border bg-muted/50 p-4">
              <p className="text-sm font-medium">Exemplo:</p>
              <p className="text-sm text-muted-foreground mt-1">
                Cliente compra R$100 → ganha <strong>{Math.floor(100 * Number(pointsPerReal))}</strong> pontos.
                {" "}Com <strong>{minRedemption}</strong> pontos, resgata{" "}
                <strong>R${(Number(minRedemption) * Number(redemptionRate)).toFixed(2)}</strong> de desconto.
              </p>
            </div>
          )}

          <Button onClick={handleSave} disabled={upsert.isPending}>
            {upsert.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Salvar configurações
          </Button>
        </CardContent>
      </Card>

      {/* Recent transactions */}
      {transactions && transactions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Últimas movimentações</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Pontos</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.slice(0, 20).map((t: any) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <Badge variant={t.type === "earn" ? "default" : "secondary"}>
                        {t.type === "earn" ? "Ganho" : "Resgate"}
                      </Badge>
                    </TableCell>
                    <TableCell className={t.points > 0 ? "text-green-600" : "text-red-500"}>
                      {t.points > 0 ? "+" : ""}{t.points}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{t.description}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(t.created_at).toLocaleDateString("pt-BR")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
    </PlanGate>
  );
}
