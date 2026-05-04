import { useState, useEffect, useRef } from "react";
import { useOrders } from "@/hooks/useOrders";
import { ArrowRight, Package, Truck, BellRing, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";

export function AdminPendingOrdersAlert() {
  const { slug } = useParams();
  const { data: orders } = useOrders();
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);
  const lastAlertTime = useRef<number>(0);

  useEffect(() => {
    if (orders) {
      const pending = orders.filter((o) => o.status === "processando");
      setPendingOrders(pending);
    }
  }, [orders]);

  useEffect(() => {
    if (pendingOrders.length === 0) return;

    const checkAndNotify = () => {
      const now = Date.now();
      if (now - lastAlertTime.current >= 5 * 60 * 1000) {
        lastAlertTime.current = now;

        toast.warning("🔔 Pedidos Pendentes de Envio", {
          description: `Você tem ${pendingOrders.length} ${pendingOrders.length === 1 ? "pedido pago aguardando" : "pedidos pagos aguardando"} ser entregue ou enviado!`,
          duration: 15000,
          action: {
            label: "Ver Pedidos",
            onClick: () => (window.location.href = `/painel/${slug}/pedidos`),
          },
        });

        try {
          const audio = new Audio("https://cdn.pixabay.com/audio/2022/03/15/audio_78333887.mp3");
          audio.volume = 0.5;
          audio.play().catch(() => {});
        } catch (e) {}
      }
    };

    const interval = setInterval(checkAndNotify, 30000);
    return () => clearInterval(interval);
  }, [pendingOrders]);

  if (pendingOrders.length === 0) return null;

  // Calculate oldest pending
  const oldest = pendingOrders.reduce((acc, o) => {
    const t = new Date(o.created_at).getTime();
    return t < acc ? t : acc;
  }, Date.now());
  const ageMins = Math.floor((Date.now() - oldest) / 60000);
  const ageLabel =
    ageMins < 60 ? `${ageMins}min` : ageMins < 1440 ? `${Math.floor(ageMins / 60)}h` : `${Math.floor(ageMins / 1440)}d`;

  return (
    <div className="px-4 pt-4 animate-in fade-in slide-in-from-top-4 duration-700">
      <div className="relative overflow-hidden rounded-2xl border-2 border-orange-500/40 bg-gradient-to-br from-orange-500/15 via-orange-500/5 to-amber-500/10 shadow-[0_0_30px_-8px_rgba(249,115,22,0.5)]">
        {/* Animated glow */}
        <div className="pointer-events-none absolute -top-20 -right-20 h-48 w-48 rounded-full bg-orange-500/30 blur-3xl animate-pulse" />
        <div className="relative flex flex-col sm:flex-row sm:items-center gap-4 p-4">
          {/* Icon */}
          <div className="relative shrink-0">
            <div className="absolute inset-0 rounded-2xl bg-orange-500/40 blur-md animate-pulse" />
            <div className="relative h-14 w-14 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-lg">
              <BellRing className="h-7 w-7 text-white animate-[wiggle_1s_ease-in-out_infinite]" />
              <span className="absolute -top-1.5 -right-1.5 h-6 min-w-6 px-1.5 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center border-2 border-background shadow">
                {pendingOrders.length}
              </span>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-extrabold text-base sm:text-lg text-orange-900 dark:text-orange-100 tracking-tight">
                {pendingOrders.length === 1 ? "1 pedido pago aguardando envio" : `${pendingOrders.length} pedidos pagos aguardando envio`}
              </h3>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/15 text-orange-800 dark:text-orange-200 px-2 py-0.5 font-semibold">
                <Clock className="h-3 w-3" /> Mais antigo: {ageLabel}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 text-amber-800 dark:text-amber-200 px-2 py-0.5 font-semibold">
                🔔 Lembrete a cada 5min
              </span>
            </div>
            <p className="text-xs text-orange-800/80 dark:text-orange-200/80 mt-1.5">
              Marque como <strong>"Enviado"</strong> assim que despachar para o cliente.
            </p>
          </div>

          {/* Action */}
          <Button
            asChild
            size="lg"
            className="bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white font-bold shadow-lg hover:scale-[1.03] transition-all shrink-0"
          >
            <Link to={`/painel/${slug}/pedidos`} className="flex items-center gap-2">
              <Truck className="h-4 w-4" />
              Ver pedidos
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
      <style>{`@keyframes wiggle { 0%, 100% { transform: rotate(-8deg); } 50% { transform: rotate(8deg); } }`}</style>
    </div>
  );
}
