import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Brain, Sparkles, AlertTriangle, ArrowRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate, useParams } from "react-router-dom";

const STORAGE_KEY = "ai_training_alert_dismissed";

export function AITrainingAlert() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(localStorage.getItem(STORAGE_KEY) === "1");
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setDismissed(true);
  };

  if (dismissed) return null;

  return (
    <Card className="border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20 shadow-sm border-l-4 relative">
      <button
        onClick={handleDismiss}
        aria-label="Dispensar aviso"
        className="absolute top-2 right-2 p-1 rounded-md text-amber-700/60 hover:text-amber-900 hover:bg-amber-100 dark:text-amber-300/60 dark:hover:text-amber-100 dark:hover:bg-amber-900/40 transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
      <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4 pr-8">
        <div className="flex items-start gap-3">
          <div className="bg-amber-100 dark:bg-amber-900/40 p-2 rounded-full">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-amber-900 dark:text-amber-100 flex items-center gap-2">
              Importância do Treinamento da IA
              <Sparkles className="h-3 w-3 text-primary animate-pulse" />
            </h3>
            <p className="text-xs text-amber-800/80 dark:text-amber-200/70 leading-relaxed max-w-2xl">
              Para que a IA possa vender por você com eficiência, ela precisa conhecer sua marca, seus produtos e seu tom de voz.
              <strong> Sem o treinamento adequado, as respostas e automações serão genéricas.</strong>
              Dedique 2 minutos para configurar o Cérebro da sua loja.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => navigate(`/painel/${slug}/cerebro`)}
            className="bg-amber-600 hover:bg-amber-700 text-white border-0 gap-2 whitespace-nowrap"
          >
            <Brain className="h-4 w-4" />
            Treinar Cérebro agora
            <ArrowRight className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDismiss}
            className="text-amber-800/80 hover:text-amber-900 hover:bg-amber-100 dark:text-amber-200/70 dark:hover:text-amber-100 dark:hover:bg-amber-900/40"
          >
            Entendi
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
