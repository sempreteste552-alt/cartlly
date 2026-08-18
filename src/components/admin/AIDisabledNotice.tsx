import { Link, useParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Lock, LifeBuoy, Mail } from "lucide-react";
import { useAIPlatformStatus } from "@/hooks/useAIPlatformStatus";

/**
 * Mostrado quando os recursos de IA estão desligados globalmente
 * (o suporte precisa liberar e cadastrar as chaves de API).
 */
export function AIDisabledNotice({ featureName }: { featureName?: string }) {
  const { slug } = useParams();
  const { status } = useAIPlatformStatus();
  const base = slug ? `/painel/${slug}` : "/admin";

  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
        <div className="relative">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
            <Sparkles className="h-8 w-8 text-muted-foreground" />
          </div>
          <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-background border">
            <Lock className="h-3.5 w-3.5 text-muted-foreground" />
          </span>
        </div>

        <div className="space-y-2 max-w-md">
          <div className="flex items-center justify-center gap-2">
            <h3 className="text-lg font-semibold">
              {featureName ? `${featureName} indisponível` : "Inteligência Artificial desativada"}
            </h3>
            <Badge variant="outline">OFF</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{status.message}</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <Button asChild>
            <Link to={`${base}/suporte`}>
              <LifeBuoy className="h-4 w-4 mr-2" />
              Falar com o suporte
            </Link>
          </Button>
          {status.support_contact && (
            <Button variant="outline" asChild>
              <a href={`mailto:${status.support_contact}`}>
                <Mail className="h-4 w-4 mr-2" />
                {status.support_contact}
              </a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default AIDisabledNotice;
