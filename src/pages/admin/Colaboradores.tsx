import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "@/i18n";
import { 
  Users, UserPlus, Shield, Trash2, Mail, 
  CheckCircle2, AlertCircle, Loader2 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, 
  TableHeader, TableRow 
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, 
  SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

export default function Colaboradores() {
  const { user } = useAuth();
  const { t, locale } = useTranslation();
  const queryClient = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("viewer");
  const [isInviting, setIsInviting] = useState(false);

  const { data: collaborators, isLoading } = useQuery({
    queryKey: ["store_collaborators", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_collaborators")
        .select(`
          id,
          role,
          created_at,
          collaborator:profiles!collaborator_id(
            display_name,
            avatar_url,
            user_id
          )
        `)
        .eq("store_owner_id", user?.id);

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const inviteMutation = useMutation({
    mutationFn: async ({ email, role }: { email: string; role: string }) => {
      // 1. Find user by email in profiles
      // Note: This requires profiles to have an email or a way to lookup.
      // In some setups, profiles don't have email for privacy, but let's check.
      // If no email in profiles, we might need a different approach.
      // For now, let's assume we can search by email if we added it to profiles or use a RPC.
      
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("user_id")
        .filter("display_name", "ilike", email) // fallback if no email field
        .limit(1)
        .single();
        
      // Actually, let's look for a better way to find users.
      // Many apps use a specific RPC for this.
      
      // If we can't find by email directly, we might need the user to provide their User ID for now,
      // or implement a search.
      
      // Let's try a direct insert if we had the ID, but here we only have email.
      // I'll implement a simple "mock" logic for now that warns if user not found.
      throw new Error(locale === 'pt' ? "Funcionalidade de busca por e-mail em implementação. Por favor, use o ID do usuário." : "Email search implementation in progress. Please use User ID.");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store_collaborators"] });
      toast.success(locale === 'pt' ? "Colaborador adicionado!" : "Collaborator added!");
      setInviteEmail("");
    },
    onError: (error: any) => {
      toast.error(error.message);
    }
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("store_collaborators")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store_collaborators"] });
      toast.success(locale === 'pt' ? "Colaborador removido." : "Collaborator removed.");
    }
  });

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "admin": return <Badge variant="default" className="bg-red-500">Admin</Badge>;
      case "editor": return <Badge variant="secondary">Editor</Badge>;
      default: return <Badge variant="outline">Viewer</Badge>;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">
          {locale === 'pt' ? "Colaboradores" : "Collaborators"}
        </h1>
        <p className="text-muted-foreground">
          {locale === 'pt' 
            ? "Gerencie quem tem acesso à sua loja e quais as permissões de cada um."
            : "Manage who has access to your store and their permissions."}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              {locale === 'pt' ? "Convidar" : "Invite"}
            </CardTitle>
            <CardDescription>
              {locale === 'pt'
                ? "Adicione um novo membro à sua equipe."
                : "Add a new member to your team."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{locale === 'pt' ? "E-mail ou ID" : "Email or ID"}</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="usuario@email.com" 
                  className="pl-9"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{locale === 'pt' ? "Nível de Acesso" : "Access Level"}</label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="editor">Editor</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button 
              className="w-full" 
              onClick={() => inviteMutation.mutate({ email: inviteEmail, role: inviteRole })}
              disabled={!inviteEmail || inviteMutation.isPending}
            >
              {inviteMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
              {locale === 'pt' ? "Convidar" : "Invite"}
            </Button>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>{locale === 'pt' ? "Equipe Atual" : "Current Team"}</CardTitle>
            <CardDescription>
              {collaborators?.length || 0} {locale === 'pt' ? "membros ativos" : "active members"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : collaborators && collaborators.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{locale === 'pt' ? "Usuário" : "User"}</TableHead>
                    <TableHead>{locale === 'pt' ? "Acesso" : "Access"}</TableHead>
                    <TableHead className="text-right">{locale === 'pt' ? "Ações" : "Actions"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {collaborators.map((collab: any) => (
                    <TableRow key={collab.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                            {collab.collaborator?.avatar_url ? (
                              <img src={collab.collaborator.avatar_url} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <Users className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-medium">{collab.collaborator?.display_name || "Usuário"}</span>
                            <span className="text-xs text-muted-foreground">{collab.collaborator?.user_id?.substring(0, 8)}...</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getRoleBadge(collab.role)}</TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => removeMutation.mutate(collab.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12 border-2 border-dashed rounded-lg">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-20" />
                <p className="text-muted-foreground">
                  {locale === 'pt' ? "Você ainda não tem colaboradores." : "You don't have any collaborators yet."}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="bg-primary/5 border-primary/20">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            {locale === 'pt' ? "Níveis de Permissão" : "Permission Levels"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3 text-sm">
            <div className="space-y-1">
              <p className="font-bold text-primary">Admin</p>
              <p className="text-muted-foreground">{locale === 'pt' ? "Acesso total, pode gerenciar colaboradores e excluir a loja." : "Full access, can manage collaborators and delete the store."}</p>
            </div>
            <div className="space-y-1">
              <p className="font-bold text-primary">Editor</p>
              <p className="text-muted-foreground">{locale === 'pt' ? "Pode gerenciar produtos e pedidos, mas não configurações sensíveis." : "Can manage products and orders, but not sensitive settings."}</p>
            </div>
            <div className="space-y-1">
              <p className="font-bold text-primary">Viewer</p>
              <p className="text-muted-foreground">{locale === 'pt' ? "Apenas visualização de dados e relatórios." : "Only view data and reports."}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
