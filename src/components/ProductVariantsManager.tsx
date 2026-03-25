import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Palette, Ruler, Box } from "lucide-react";
import { useProductVariants, useCreateVariant, useDeleteVariant, type ProductVariant } from "@/hooks/useProductVariants";

const VARIANT_TYPES = [
  { value: "color", label: "Cor", icon: Palette },
  { value: "size", label: "Tamanho", icon: Ruler },
  { value: "model", label: "Modelo", icon: Box },
];

interface Props {
  productId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProductVariantsManager({ productId, open, onOpenChange }: Props) {
  const { data: variants, isLoading } = useProductVariants(productId);
  const createVariant = useCreateVariant();
  const deleteVariant = useDeleteVariant();

  const [variantType, setVariantType] = useState("color");
  const [variantValue, setVariantValue] = useState("");
  const [stock, setStock] = useState("0");
  const [priceMod, setPriceMod] = useState("0");
  const [sku, setSku] = useState("");

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!variantValue.trim()) return;
    createVariant.mutate(
      {
        product_id: productId,
        variant_type: variantType,
        variant_value: variantValue.trim(),
        stock: parseInt(stock) || 0,
        price_modifier: parseFloat(priceMod) || 0,
        sku: sku.trim() || null,
      },
      { onSuccess: () => { setVariantValue(""); setStock("0"); setPriceMod("0"); setSku(""); } }
    );
  };

  const typeIcon = (type: string) => {
    const t = VARIANT_TYPES.find((v) => v.value === type);
    return t ? <t.icon className="h-3.5 w-3.5" /> : null;
  };

  const formatPrice = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Variantes do Produto</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleAdd} className="flex flex-wrap gap-2 items-end">
          <div className="space-y-1">
            <Label className="text-xs">Tipo</Label>
            <Select value={variantType} onValueChange={setVariantType}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VARIANT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 flex-1 min-w-[120px]">
            <Label className="text-xs">Valor</Label>
            <Input value={variantValue} onChange={(e) => setVariantValue(e.target.value)} placeholder="Ex: Azul, P, Premium" maxLength={100} />
          </div>
          <div className="space-y-1 w-20">
            <Label className="text-xs">Estoque</Label>
            <Input type="number" min="0" value={stock} onChange={(e) => setStock(e.target.value)} />
          </div>
          <div className="space-y-1 w-24">
            <Label className="text-xs">+/- Preço</Label>
            <Input type="number" step="0.01" value={priceMod} onChange={(e) => setPriceMod(e.target.value)} placeholder="0.00" />
          </div>
          <div className="space-y-1 w-24">
            <Label className="text-xs">SKU</Label>
            <Input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="Opcional" maxLength={50} />
          </div>
          <Button type="submit" size="sm" disabled={createVariant.isPending}>
            <Plus className="h-4 w-4 mr-1" /> Adicionar
          </Button>
        </form>

        {variants && variants.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Estoque</TableHead>
                <TableHead>Modificador</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {variants.map((v) => (
                <TableRow key={v.id}>
                  <TableCell>
                    <Badge variant="outline" className="gap-1">
                      {typeIcon(v.variant_type)}
                      {VARIANT_TYPES.find((t) => t.value === v.variant_type)?.label || v.variant_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{v.variant_value}</TableCell>
                  <TableCell>
                    <Badge variant={v.stock > 0 ? "secondary" : "destructive"}>{v.stock}</Badge>
                  </TableCell>
                  <TableCell>
                    {v.price_modifier !== 0 && (
                      <span className={v.price_modifier > 0 ? "text-green-600" : "text-red-600"}>
                        {v.price_modifier > 0 ? "+" : ""}{formatPrice(v.price_modifier)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{v.sku || "—"}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteVariant.mutate({ id: v.id, productId })}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-6">
            Nenhuma variante cadastrada. Adicione cores, tamanhos ou modelos.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
