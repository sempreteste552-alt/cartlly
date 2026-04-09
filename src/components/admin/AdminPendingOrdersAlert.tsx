import { useState, useEffect } from "react";
import { useOrders } from "@/hooks/useOrders";
import { AlertCircle, ArrowRight, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Link } from "react-router-dom";
import { toast } from "sonner";

export function AdminPendingOrdersAlert() {
  const { data: orders } = useOrders();
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);

  useEffect(() => {
    if (orders) {
      // Status 'processando' usually means paid and waiting for shipping
      const pending = orders.filter((o) => o.status === "processando");
      setPendingOrders(pending);
    }
  }, [orders]);

  // Alert every 5 minutes if there are pending orders
  useEffect(() => {
    if (pendingOrders.length === 0) return;

    const interval = setInterval(() => {
      toast.warning("🔔 Pedidos Pendentes", {
        description: `Você tem ${pendingOrders.length} ${pendingOrders.length === 1 ? 'pedido aguardando' : 'pedidos aguardando'} envio!`,
        duration: 10000,
        action: {
          label: "Ver Pedidos",
          onClick: () => window.location.href = "/admin/pedidos"
        }
      });
      
      // Attempt to play a subtle notification sound if possible
      try {
        const audio = new Audio("https://cdn.pixabay.com/audio/2022/03/15/audio_78333887.mp3"); // A notification sound
        audio.play().catch(() => {
          // Ignore audio play errors (usually browser blocks un-interacted audio)
          console.log("Audio alert blocked by browser");
        });
      } catch (e) {}
      
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [pendingOrders]);

  if (pendingOrders.length === 0) return null;

  return (
    <div className="px-4 pt-4 animate-in fade-in slide-in-from-top-4 duration-500">
      <Alert variant="destructive" className="border-orange-500 bg-orange-50 dark:bg-orange-950/20 text-orange-800 dark:text-orange-200 shadow-lg border-2">
        <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between w-full gap-4">
          <div>
            <AlertTitle className="font-bold flex items-center gap-2">
              <Package className="h-4 w-4" />
              {pendingOrders.length} {pendingOrders.length === 1 ? 'Pedido Pendente' : 'Pedidos Pendentes'}
            </AlertTitle>
            <AlertDescription className="text-orange-700/80 dark:text-orange-300/80 font-medium">
              Há pedidos pagos que precisam ser enviados. Você será lembrado a cada 5 minutos até resolvê-los.
            </AlertDescription>
          </div>
          <Button 
            asChild 
            variant="outline" 
            size="sm" 
            className="bg-orange-600 hover:bg-orange-700 text-white border-none shrink-0"
          >
            <Link to="/admin/pedidos" className="flex items-center gap-2">
              Gerenciar Pedidos
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </Alert>
    </div>
  );
}
