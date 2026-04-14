import { useState, useEffect, useRef } from "react";
import { useOrders } from "@/hooks/useOrders";
import { AlertCircle, ArrowRight, Package, Truck, BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";

export function AdminPendingOrdersAlert() {
  const { slug } = useParams();
  const { data: orders } = useOrders();
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);
  const lastAlertTime = useRef<number>(0);

  useEffect(() => {
    if (orders) {
      // Status 'processando' means paid and waiting for shipping/delivery
      const pending = orders.filter((o) => o.status === "processando");
      setPendingOrders(pending);
    }
  }, [orders]);

  // Alert every 5 minutes if there are pending orders
  useEffect(() => {
    if (pendingOrders.length === 0) return;

    const checkAndNotify = () => {
      const now = Date.now();
      // Only notify if 5 minutes have passed since last manual or auto alert
      if (now - lastAlertTime.current >= 5 * 60 * 1000) {
        lastAlertTime.current = now;
        
        toast.warning("🔔 Pedidos Pendentes de Envio", {
          description: `Você tem ${pendingOrders.length} ${pendingOrders.length === 1 ? 'pedido pago aguardando' : 'pedidos pagos aguardando'} ser entregue ou enviado!`,
          duration: 15000, // Show for 15 seconds
          action: {
            label: "Ver Pedidos",
            onClick: () => window.location.href = `/painel/${slug}/pedidos`
          }
        });
        
        // Notification sound
        try {
          const audio = new Audio("https://cdn.pixabay.com/audio/2022/03/15/audio_78333887.mp3");
          audio.volume = 0.5;
          audio.play().catch(() => {
            console.log("Audio alert blocked - waiting for interaction");
          });
        } catch (e) {}
      }
    };

    // Initial check (don't alert immediately on mount if it's the first time, 
    // unless we want to be very aggressive)
    const interval = setInterval(checkAndNotify, 30000); // Check every 30 seconds if it's time to notify

    return () => clearInterval(interval);
  }, [pendingOrders]);

  if (pendingOrders.length === 0) return null;

  return (
    <div className="px-4 pt-4 animate-in fade-in slide-in-from-top-4 duration-700">
      <Alert variant="destructive" className="border-orange-500 bg-orange-50 dark:bg-orange-950/20 text-orange-900 dark:text-orange-100 shadow-xl border-2 ring-2 ring-orange-500/20">
        <div className="flex items-start gap-4 w-full">
          <div className="bg-orange-500 p-2 rounded-full animate-pulse mt-1">
            <BellRing className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <AlertTitle className="font-black text-lg flex items-center gap-2 mb-1">
                <Package className="h-5 w-5" />
                ATENÇÃO: {pendingOrders.length} {pendingOrders.length === 1 ? 'Pedido Pago' : 'Pedidos Pagos'}
              </AlertTitle>
              <AlertDescription className="text-orange-800 dark:text-orange-200 font-semibold leading-relaxed">
                Existem pedidos aprovados aguardando entrega ou envio para outra cidade. 
                <span className="block text-xs mt-1 opacity-80 italic">Lembrete sonoro ativo a cada 5 minutos até marcar como "Enviado".</span>
              </AlertDescription>
            </div>
            <div className="flex flex-col gap-2 min-w-[140px]">
              <Button 
                asChild 
                variant="default" 
                size="sm" 
                className="bg-orange-600 hover:bg-orange-700 text-white font-bold shadow-md hover:scale-105 transition-transform"
              >
                <Link to={`/painel/${slug}/pedidos`} className="flex items-center gap-2">
                  <Truck className="h-4 w-4" />
                  Ver Pedidos
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </Alert>
    </div>
  );
}
