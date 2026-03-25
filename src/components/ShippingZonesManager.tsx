import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Plus } from "lucide-react";
import { useShippingZones, useCreateShippingZone, useDeleteShippingZone } from "@/hooks/useShippingZones";

export function ShippingZonesManager() {
  const { data: zones } = useShippingZones();
  const createZone = useCreateShippingZone();
  const deleteZone = useDeleteShippingZone();

  const [zoneName, setZoneName] = useState("");
  const [cepStart, setCepStart] = useState("");
  const [cepEnd, setCepEnd] = useState("");
  const [price, setPrice] = useState("");
  const [days, setDays] = useState("5-10 dias úteis");

  const formatPrice = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!zoneName.trim() || !cepStart || !cepEnd || !price) return;
    createZone.mutate(
      {
        zone_name: zoneName.trim(),
        cep_start: cepStart.replace(/\D/g, ""),
        cep_end: cepEnd.replace(/\D/g, ""),
        price: parseFloat(price) || 0,
        estimated_days: days,
        active: true,
      },
      { onSuccess: () => { setZoneName(""); setCepStart(""); setCepEnd(""); setPrice(""); } }
    );
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Configure faixas de CEP com preços diferentes. O sistema busca o endereço via ViaCEP e aplica o preço da zona correspondente.
      </p>

      <form onSubmit={handleAdd} className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end">
        <div className="space-y-1">
          <Label className="text-xs">Região</Label>
          <Input value={zoneName} onChange={(e) => setZoneName(e.target.value)} placeholder="Sul" maxLength={50} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">CEP Início</Label>
          <Input value={cepStart} onChange={(e) => setCepStart(e.target.value)} placeholder="01000000" maxLength={8} className="font-mono" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">CEP Fim</Label>
          <Input value={cepEnd} onChange={(e) => setCepEnd(e.target.value)} placeholder="19999999" maxLength={8} className="font-mono" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Preço (R$)</Label>
          <Input type="number" step="0.01" min="0" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="15.00" />
        </div>
        <Button type="submit" size="sm" disabled={createZone.isPending} className="self-end">
          <Plus className="h-4 w-4 mr-1" /> Adicionar
        </Button>
      </form>

      {zones && zones.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Região</TableHead>
              <TableHead>CEP Início</TableHead>
              <TableHead>CEP Fim</TableHead>
              <TableHead>Preço</TableHead>
              <TableHead>Prazo</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {zones.map((z) => (
              <TableRow key={z.id}>
                <TableCell className="font-medium">{z.zone_name}</TableCell>
                <TableCell className="font-mono text-xs">{z.cep_start}</TableCell>
                <TableCell className="font-mono text-xs">{z.cep_end}</TableCell>
                <TableCell>{formatPrice(z.price)}</TableCell>
                <TableCell className="text-xs">{z.estimated_days}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteZone.mutate(z.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
