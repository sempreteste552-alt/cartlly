import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, Play, Info, HelpCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface FeatureTutorialCardProps {
  id: string;
  title: string;
  description: string;
  steps?: string[];
  videoUrl?: string;
  className?: string;
}

export function FeatureTutorialCard({ 
  id, 
  title, 
  description, 
  steps, 
  videoUrl,
  className 
}: FeatureTutorialCardProps) {
  const [dismissed, setDismissed] = useState(false);
  const storageKey = `tutorial_dismissed_${id}`;

  useEffect(() => {
    if (localStorage.getItem(storageKey)) {
      setDismissed(true);
    }
  }, [storageKey]);

  const handleDismiss = () => {
    localStorage.setItem(storageKey, "true");
    setDismissed(true);
  };

  if (dismissed) return null;

  return (
    <Card className={cn(
      "relative overflow-hidden border-primary/20 bg-gradient-to-r from-primary/[0.03] to-transparent mb-6",
      className
    )}>
      <button 
        onClick={handleDismiss} 
        className="absolute top-2 right-2 p-1 rounded-full hover:bg-muted/50 text-muted-foreground transition-colors z-10"
        title="Ocultar tutorial"
      >
        <X className="h-4 w-4" />
      </button>

      <CardContent className="p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <HelpCircle className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-foreground">{title}</h3>
            </div>
            
            <p className="text-sm text-muted-foreground leading-relaxed">
              {description}
            </p>

            {steps && steps.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {steps.map((step, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                    <span>{step}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {videoUrl && (
            <div className="sm:w-48 shrink-0">
              <div className="aspect-video sm:aspect-square rounded-lg bg-muted border border-border flex flex-col items-center justify-center gap-2 group cursor-pointer hover:border-primary/30 transition-all overflow-hidden relative">
                <div className="absolute inset-0 bg-primary/5 group-hover:bg-primary/10 transition-colors" />
                <Play className="h-8 w-8 text-primary fill-primary/20" />
                <span className="text-[10px] font-medium text-muted-foreground group-hover:text-primary transition-colors">Ver Tutorial</span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
