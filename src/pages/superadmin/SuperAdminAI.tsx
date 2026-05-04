import { useState } from "react";
import { Link } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, Settings2, History, Users, Sparkles, Home } from "lucide-react";
import { AIProvidersList } from "@/components/superadmin/AIProvidersList";
import { AITenantSettings } from "@/components/superadmin/AITenantSettings";
import { AIUsageLogs } from "@/components/superadmin/AIUsageLogs";
import { AIConsumptionDashboard } from "@/components/superadmin/AIConsumptionDashboard";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList,
  BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export default function SuperAdminAI() {
  const [activeTab, setActiveTab] = useState("dashboard");

  const tabLabels: Record<string, string> = {
    dashboard: "Dashboard",
    providers: "Provedores",
    tenants: "Tenants",
    logs: "Logs de Uso",
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild><Link to="/superadmin" className="flex items-center gap-1"><Home className="h-3 w-3" />Super Admin</Link></BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem><BreadcrumbLink asChild><Link to="/superadmin/ai">Central de IA</Link></BreadcrumbLink></BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem><BreadcrumbPage>{tabLabels[activeTab]}</BreadcrumbPage></BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Sparkles className="h-7 w-7 text-primary" />
          Central de IA e Custos
        </h1>
        <p className="text-muted-foreground">
          Gerencie provedores, limites por tenant, monitore margem e detecte abusos.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4 xl:w-auto">
          <TabsTrigger value="dashboard" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </TabsTrigger>
          <TabsTrigger value="providers" className="gap-2">
            <Settings2 className="h-4 w-4" />
            <span className="hidden sm:inline">Provedores</span>
          </TabsTrigger>
          <TabsTrigger value="tenants" className="gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Tenants</span>
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-2">
            <History className="h-4 w-4" />
            <span className="hidden sm:inline">Logs de Uso</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4">
          <AIConsumptionDashboard />
        </TabsContent>

        <TabsContent value="providers" className="space-y-4">
          <AIProvidersList />
        </TabsContent>

        <TabsContent value="tenants" className="space-y-4">
          <AITenantSettings />
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <AIUsageLogs />
        </TabsContent>
      </Tabs>
    </div>
  );
}
