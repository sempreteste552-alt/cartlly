import React from "react";
import { Lock, ShieldAlert } from "lucide-react";
import { useTenantContext } from "@/hooks/useTenantContext";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

type Role = "owner" | "admin" | "editor" | "viewer";

interface RoleGateProps {
  children: React.ReactNode;
  allowedRoles: Role[];
  fallback?: React.ReactNode;
}

export function RoleGate({ children, allowedRoles, fallback }: RoleGateProps) {
  const { role } = useTenantContext();
  const navigate = useNavigate();

  const isAllowed = allowedRoles.includes(role as Role);

  if (isAllowed) return <>{children}</>;

  if (fallback) return <>{fallback}</>;

  return (
    <div className="flex flex-col items-center justify-center p-12 text-center bg-card rounded-xl border border-border shadow-sm animate-in fade-in zoom-in duration-300">
      <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mb-6">
        <ShieldAlert className="h-8 w-8 text-destructive" />
      </div>
      <h2 className="text-xl font-bold mb-2">Acesso Restrito</h2>
      <p className="text-muted-foreground mb-8 max-w-sm">
        Seu nível de acesso atual ({role}) não permite visualizar ou gerenciar esta funcionalidade. 
        Contate o proprietário da loja se acreditar que isso é um erro.
      </p>
      <Button onClick={() => navigate(-1)} variant="outline">
        Voltar
      </Button>
    </div>
  );
}

/**
 * Utility hook to check if a user can perform an action based on their role
 */
export function useRolePermissions() {
  const { role } = useTenantContext();
  
  const isOwner = role === "owner";
  const isAdmin = role === "admin" || isOwner;
  const isEditor = role === "editor" || isAdmin;
  const isViewer = role === "viewer";

  return {
    canManageTeam: isAdmin,
    canManagePayments: isAdmin,
    canManagePlan: isAdmin,
    canViewMetrics: isAdmin,
    canManageProducts: isEditor,
    canManageOrders: isEditor,
    canManageCustomers: isEditor,
    canManageMarketing: isEditor,
    canManageSettings: isEditor,
    isViewer,
    role
  };
}
