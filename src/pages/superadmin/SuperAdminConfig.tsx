import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings } from "lucide-react";

export default function SuperAdminConfig() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Configurações</h1>
        <p className="text-muted-foreground">Configurações globais da plataforma</p>
      </div>

      <Card className="border-border">
        <CardContent className="flex flex-col items-center justify-center p-12">
          <Settings className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">Em desenvolvimento</h3>
          <p className="text-sm text-muted-foreground text-center mt-2 max-w-md">
            Configurações de credenciais de pagamento globais (Mercado Pago / PagBank), 
            teste de conexão, configurações de email e automações.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
