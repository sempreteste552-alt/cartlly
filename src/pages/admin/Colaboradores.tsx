import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "@/i18n";
import { 
  Users, UserPlus, Shield, Trash2, Mail, 
  CheckCircle2, AlertCircle, Loader2, Copy, Check, Search 
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
import { RoleGate } from "@/components/RoleGate";

export default function Colaboradores() {
  const { user } = useAuth();
  const { t, locale } = useTranslation();
  const queryClient = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("viewer");
  const [search, setSearch] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: collaborators, isLoading: isLoadingCollabs } = useQuery({
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
            user_id,
            email
          )
        `)
        .eq("store_owner_id", user?.id);

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: invitations, isLoading: isLoadingInvites } = useQuery({
    queryKey: ["store_invitations", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_invitations")
        .select("*")
        .eq("store_owner_id", user?.id)
        .is("accepted_at", null);

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const isLoading = isLoadingCollabs || isLoadingInvites;

  const inviteMutation = useMutation({
    mutationFn: async ({ email, role }: { email: string; role: string }) => {
      if (!user?.id) throw new Error("Unauthorized");

      const normalizedEmail = email.toLowerCase().trim();
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(email);
      
      let profileData;
      if (isUUID) {
        const { data, error } = await supabase.from("profiles").select("user_id, email").eq("user_id", email).maybeSingle();
        if (error) throw error;
        profileData = data;
      } else {
        const { data, error } = await supabase.from("profiles").select("user_id, email").eq("email", normalizedEmail).maybeSingle();
        if (error) throw error;
        profileData = data;
      }
        
      if (!profileData) {
        const { data: existingInvite } = await supabase.from("store_invitations").select("id").eq("store_owner_id", user.id).eq("email", normalizedEmail).is("accepted_at", null).maybeSingle();
        if (existingInvite) throw new Error(locale === 'pt' ? "Este e-mail já possui um convite pendente." : "This email already has a pending invitation.");

        const { error: inviteError } = await supabase.from("store_invitations").insert({ store_owner_id: user.id, email: normalizedEmail, role: role });
        if (inviteError) throw inviteError;
        return { type: 'invite' };
      }

      const { data: existingCollab } = await supabase.from("store_collaborators").select("id").eq("store_owner_id", user.id).eq("collaborator_id", profileData.user_id).maybeSingle();
      if (existingCollab) throw new Error(locale === 'pt' ? "Este usuário já é um colaborador." : "This user is already a collaborator.");

      const { error: insertError } = await supabase.from("store_collaborators").insert({ store_owner_id: user.id, collaborator_id: profileData.user_id, role: role });
      if (insertError) throw insertError;
      return { type: 'collab' };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["store_collaborators"] });
      queryClient.invalidateQueries({ queryKey: ["store_invitations"] });
      const msg = result.type === 'invite' 
        ? (locale === 'pt' ? "Convite gerado! Copie o link abaixo." : "Invitation generated! Copy the link below.")
        : (locale === 'pt' ? "Colaborador adicionado!" : "Collaborator added!");
      toast.success(msg);
      setInviteEmail("");
    },
    onError: (error: any) => toast.error(error.message)
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("store_collaborators").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store_collaborators"] });
      toast.success(locale === 'pt' ? "Colaborador removido." : "Collaborator removed.");
    }
  });

  const removeInviteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("store_invitations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store_invitations"] });
      toast.success(locale === 'pt' ? "Convite cancelado." : "Invitation cancelled.");
    }
  });

  const copyInviteLink = (id: string) => {
    const link = `${window.location.origin}/accept-invite?id=${id}`;
    navigator.clipboard.writeText(link);
    setCopiedId(id);
    toast.success(locale === 'pt' ? "Link de convite copiado!" : "Invite link copied!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "admin": return <Badge variant="default" className="bg-red-500">Admin</Badge>;
      case "editor": return <Badge variant="secondary">Editor</Badge>;
      default: return <Badge variant="outline">Viewer</Badge>;
    }
  };

  return (
    <RoleGate allowedRoles={["owner", "admin"]}>
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
              {(collaborators?.length || 0) + (invitations?.length || 0)} {locale === 'pt' ? "membros no total" : "total members"}
            </CardDescription>
            <div className="relative pt-2">
              <Search className="absolute left-3 top-1/2 translate-y-0 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={locale === 'pt' ? "Buscar por nome ou e-mail..." : "Search by name or email..."}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (collaborators && collaborators.length > 0) || (invitations && invitations.length > 0) ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{locale === 'pt' ? "Usuário / E-mail" : "User / Email"}</TableHead>
                    <TableHead>{locale === 'pt' ? "Acesso" : "Access"}</TableHead>
                    <TableHead>{locale === 'pt' ? "Status" : "Status"}</TableHead>
                    <TableHead className="text-right">{locale === 'pt' ? "Ações" : "Actions"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {collaborators?.filter((c: any) => {
                    if (!search) return true;
                    const q = search.toLowerCase();
                    return (c.collaborator?.email || "").toLowerCase().includes(q) ||
                           (c.collaborator?.full_name || "").toLowerCase().includes(q);
                  }).map((collab: any) => (
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
                            <span className="text-xs text-muted-foreground">{collab.collaborator?.email || collab.collaborator?.user_id?.substring(0, 8) + "..."}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getRoleBadge(collab.role)}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100">
                          {locale === 'pt' ? "Ativo" : "Active"}
                        </Badge>
                      </TableCell>
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
                  {invitations?.filter((i: any) => !search || (i.email || "").toLowerCase().includes(search.toLowerCase())).map((invite: any) => (
                    <TableRow key={invite.id} className="opacity-70">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="flex flex-col">
                            <span className="font-medium text-muted-foreground">{invite.email}</span>
                            <span className="text-xs text-muted-foreground italic">{locale === 'pt' ? "Convite pendente" : "Pending invitation"}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getRoleBadge(invite.role)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-yellow-200 text-yellow-700 bg-yellow-50">
                          {locale === 'pt' ? "Pendente" : "Pending"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-primary hover:text-primary hover:bg-primary/10"
                          onClick={() => copyInviteLink(invite.id)}
                        >
                          {copiedId === invite.id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => removeInviteMutation.mutate(invite.id)}
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
              <p className="text-muted-foreground">{locale === 'pt' ? "Acesso total, pode gerenciar colaboradores e visualizar todos os relatórios." : "Full access, can manage collaborators and view all reports."}</p>
            </div>
            <div className="space-y-1">
              <p className="font-bold text-primary">Editor</p>
              <p className="text-muted-foreground">{locale === 'pt' ? "Pode gerenciar produtos, pedidos e configurações da loja." : "Can manage products, orders, and store settings."}</p>
            </div>
            <div className="space-y-1">
              <p className="font-bold text-primary">Viewer</p>
              <p className="text-muted-foreground">{locale === 'pt' ? "Apenas visualização de produtos, pedidos e relatórios de lucro/analytics." : "Only view products, orders, and profit/analytics reports."}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      </div>
    </RoleGate>
  );
}
