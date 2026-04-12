import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, Sparkles, MessageSquare, Target, Lightbulb } from "lucide-react";

export function AITrainingGuide() {
  return (
    <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-background border-primary/20 mb-4">
      <CardHeader className="py-3 px-4 pb-2">
        <CardTitle className="text-sm flex items-center gap-2 text-primary font-bold">
          <Sparkles className="h-4 w-4" /> Como treinar sua IA
        </CardTitle>
        <CardDescription className="text-[11px] text-foreground/80">
          Siga estas dicas para que sua IA se adapte perfeitamente ao seu negócio.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="flex gap-2 items-start">
            <div className="bg-primary/20 p-1.5 rounded-lg shrink-0">
              <Target className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="space-y-0.5">
              <h4 className="text-[11px] font-semibold">Defina seu Nicho</h4>
              <p className="text-[10px] text-muted-foreground leading-tight">
                Escolher o nicho certo ajuda a IA a entender o vocabulário e as dores do seu cliente.
              </p>
            </div>
          </div>

          <div className="flex gap-2 items-start">
            <div className="bg-primary/20 p-1.5 rounded-lg shrink-0">
              <MessageSquare className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="space-y-0.5">
              <h4 className="text-[11px] font-semibold">Personalidade</h4>
              <p className="text-[10px] text-muted-foreground leading-tight">
                Defina se ela deve ser amigável, formal ou focada em vendas agressivas.
              </p>
            </div>
          </div>

          <div className="flex gap-2 items-start">
            <div className="bg-primary/20 p-1.5 rounded-lg shrink-0">
              <Brain className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="space-y-0.5">
              <h4 className="text-[11px] font-semibold">Instruções Customizadas</h4>
              <p className="text-[10px] text-muted-foreground leading-tight">
                Dê ordens claras: "Sempre use emojis", "Nunca ofereça frete grátis", etc.
              </p>
            </div>
          </div>

          <div className="flex gap-2 items-start">
            <div className="bg-primary/20 p-1.5 rounded-lg shrink-0">
              <Lightbulb className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="space-y-0.5">
              <h4 className="text-[11px] font-semibold">Alimente a Memória</h4>
              <p className="text-[10px] text-muted-foreground leading-tight">
                Use a aba "Memória" para ensinar sobre seus produtos, história e regras específicas.
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-primary/10 p-2 rounded-md border border-primary/20">
          <p className="text-[10px] text-primary font-medium text-center">
            💡 Dica: Quanto mais detalhes você der nas Instruções, melhor a IA performará!
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
