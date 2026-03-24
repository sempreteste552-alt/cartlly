import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings } from "lucide-react";

export default function Configuracoes() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Configurações</h1>
        <p className="text-muted-foreground">Ajuste as configurações da sua loja</p>
      </div>

      <Card className="border-border">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Settings className="h-12 w-12 text-muted-foreground/40" />
          <h3 className="mt-4 text-lg font-medium text-foreground">Em breve</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            As configurações da loja serão implementadas em breve
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
