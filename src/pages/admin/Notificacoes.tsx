import PushNotificationSettings from "@/components/admin/PushNotificationSettings";
import { useTranslation } from "@/i18n";

export default function Notificacoes() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">{t.sidebar.notifications}</h1>
        <p className="text-muted-foreground">
          Gerencie e envie notificações push para seus clientes.
        </p>
      </div>

      <PushNotificationSettings />
    </div>
  );
}
