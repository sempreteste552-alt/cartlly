import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bell } from "lucide-react";

export default function SuperAdminNotificacoes() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Notificações</h1>
        <p className="text-muted-foreground">Enviar mensagens e gerenciar notificações push</p>
      </div>

      <Card className="border-border">
        <CardContent className="flex flex-col items-center justify-center p-12">
          <Bell className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">Em desenvolvimento</h3>
          <p className="text-sm text-muted-foreground text-center mt-2 max-w-md">
            O sistema de notificações push com APNs (iOS) e FCM (Android) será implementado em breve.
            Incluirá envio de mensagens diretas, pop-ups e histórico.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
