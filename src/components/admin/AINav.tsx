import { Link, useLocation, useParams } from "react-router-dom";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList,
  BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";
import { Sparkles, Activity, Settings2, Brain, Home } from "lucide-react";

export function AINav({ current }: { current: "dashboard" | "usage" | "features" }) {
  const { slug } = useParams();
  const base = slug ? `/painel/${slug}` : "/admin";
  const tabs = [
    { id: "dashboard", label: "Dashboard", to: `${base}/ai`, icon: Sparkles },
    { id: "usage", label: "Consumo", to: `${base}/ai/usage`, icon: Activity },
    { id: "features", label: "Recursos", to: `${base}/ai/features`, icon: Settings2 },
    { id: "brain", label: "Cérebro", to: `${base}/cerebro`, icon: Brain },
  ] as const;

  const labels: Record<string, string> = {
    dashboard: "Central de IA",
    usage: "Consumo",
    features: "Recursos",
  };

  return (
    <div className="space-y-3">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild><Link to={base} className="flex items-center gap-1"><Home className="h-3 w-3" />Painel</Link></BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            {current === "dashboard"
              ? <BreadcrumbPage>Central de IA</BreadcrumbPage>
              : <BreadcrumbLink asChild><Link to={`${base}/ai`}>Central de IA</Link></BreadcrumbLink>}
          </BreadcrumbItem>
          {current !== "dashboard" && (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem><BreadcrumbPage>{labels[current]}</BreadcrumbPage></BreadcrumbItem>
            </>
          )}
        </BreadcrumbList>
      </Breadcrumb>

      <nav className="flex gap-1 overflow-x-auto rounded-lg border bg-muted/30 p-1">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = t.id === current;
          return (
            <Link
              key={t.id}
              to={t.to}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors",
                active
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/50"
              )}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
