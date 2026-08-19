import { useNavigate, useParams } from "react-router-dom";
import { PlanGate } from "@/components/PlanGate";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Instagram, Facebook } from "lucide-react";
import { useSocialSuggestions, type SocialSuggestion } from "@/hooks/useSocialIntegrations";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Aguardando revisão",
  REVIEWING: "Em revisão",
  APPROVED: "Aprovado",
  IMPORTED: "Importado",
  REJECTED: "Ignorado",
};

export default function SocialHistory() {
  return (
    <PlanGate feature="social_product_import">
      <HistoryInner />
    </PlanGate>
  );
}

function HistoryInner() {
  const { slug } = useParams();
  const base = slug ? `/painel/${slug}` : "/admin";
  const navigate = useNavigate();
  const { data: all = [], isLoading } = useSocialSuggestions();

  const groups: Record<string, SocialSuggestion[]> = {
    todos: all,
    pendentes: all.filter((s) => s.status === "PENDING"),
    importados: all.filter((s) => s.status === "IMPORTED"),
    ignorados: all.filter((s) => s.status === "REJECTED"),
  };

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" onClick={() => navigate(`${base}/social`)}>
        <ArrowLeft className="h-4 w-4 mr-1.5" /> Voltar
      </Button>
      <h1 className="text-2xl font-bold">Histórico de importações</h1>

      <Tabs defaultValue="todos">
        <TabsList className="flex-wrap h-auto">
          {Object.keys(groups).map((k) => (
            <TabsTrigger key={k} value={k} className="capitalize">{k} ({groups[k].length})</TabsTrigger>
          ))}
        </TabsList>
        {Object.entries(groups).map(([k, items]) => (
          <TabsContent key={k} value={k} className="space-y-3 mt-4">
            {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
            {!isLoading && items.length === 0 && (
              <p className="text-sm text-muted-foreground">Nada por aqui ainda.</p>
            )}
            {items.map((s) => {
              const provider = (s as any).social_media_posts?.provider;
              const Icon = provider === "facebook" ? Facebook : Instagram;
              return (
                <Card key={s.id} className="cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => navigate(`${base}/social/produtos/${s.id}`)}>
                  <CardContent className="p-3 flex items-center gap-3">
                    {s.image_url ? (
                      <img src={s.image_url} alt={s.suggested_name || "Produto"} loading="lazy"
                        className="h-14 w-14 rounded-md object-cover shrink-0" />
                    ) : (
                      <div className="h-14 w-14 rounded-md bg-muted grid place-items-center shrink-0">📦</div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{s.suggested_name || "Produto sem nome"}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Icon className="h-3 w-3" /> {new Date(s.created_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <Badge variant={s.status === "IMPORTED" ? "default" : "secondary"}>{STATUS_LABEL[s.status]}</Badge>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
