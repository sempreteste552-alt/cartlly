import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, LogOut } from "lucide-react";
import cartlyLogo from "@/assets/cartly-logo.png";

export default function ContaEmAnalise() {
  const { signOut } = useAuth();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border shadow-lg">
        <CardContent className="flex flex-col items-center text-center py-12 px-6 space-y-6">
          <img src={cartlyLogo} alt="Cartly" className="h-12 w-auto" />

          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-amber-500/10">
            <Clock className="h-10 w-10 text-amber-500" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Conta em Análise
            </h1>
            <p className="text-muted-foreground leading-relaxed">
              Sua conta foi criada com sucesso e está aguardando aprovação do administrador da plataforma.
            </p>
            <p className="text-sm text-muted-foreground">
              Você receberá um e-mail assim que sua conta for aprovada. Isso pode levar até 24 horas.
            </p>
          </div>

          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 w-full">
            <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">
              ⏳ Status: Aguardando aprovação
            </p>
          </div>

          <Button variant="outline" onClick={signOut} className="mt-4">
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
