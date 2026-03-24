import { Card, CardContent } from "@/components/ui/card";
import { ShoppingCart } from "lucide-react";

export default function Pedidos() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Pedidos</h1>
        <p className="text-muted-foreground">Acompanhe e gerencie os pedidos da loja</p>
      </div>

      <Card className="border-border">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <ShoppingCart className="h-12 w-12 text-muted-foreground/40" />
          <h3 className="mt-4 text-lg font-medium text-foreground">Nenhum pedido</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Os pedidos aparecerão aqui quando clientes comprarem
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
