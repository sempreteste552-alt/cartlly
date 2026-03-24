import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Package } from "lucide-react";

export default function Produtos() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Produtos</h1>
          <p className="text-muted-foreground">Gerencie o catálogo da sua loja</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Novo Produto
        </Button>
      </div>

      <Card className="border-border">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Package className="h-12 w-12 text-muted-foreground/40" />
          <h3 className="mt-4 text-lg font-medium text-foreground">Nenhum produto</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Comece adicionando seu primeiro produto
          </p>
          <Button className="mt-4" size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Adicionar Produto
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
