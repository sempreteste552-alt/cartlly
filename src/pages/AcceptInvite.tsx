import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, CheckCircle2, XCircle, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function AcceptInvite() {
  const [searchParams] = useSearchParams();
  const inviteId = searchParams.get("id");
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error" | "not_logged_in" | "fetching_invite">("fetching_invite");
  const [errorMsg, setErrorMsg] = useState("");
  const [storeSlug, setStoreSlug] = useState("");
  const [inviteData, setInviteData] = useState<any>(null);

  useEffect(() => {
    const fetchInvite = async () => {
      if (!inviteId) {
        setStatus("error");
        setErrorMsg("ID do convite inválido.");
        return;
      }

      try {
        const { data: invite, error: inviteError } = await supabase
          .from("store_invitations")
          .select("*")
          .eq("id", inviteId)
          .maybeSingle();

        if (inviteError) throw inviteError;
        if (!invite) throw new Error("Convite não encontrado.");
        if (invite.accepted_at) throw new Error("Este convite já foi utilizado.");

        setInviteData(invite);
        
        if (!user && !authLoading) {
          setStatus("not_logged_in");
        } else if (user) {
          setStatus("loading");
        }
      } catch (err: any) {
        console.error("Error fetching invite:", err);
        setStatus("error");
        setErrorMsg(err.message || "Erro ao carregar convite.");
      }
    };

    fetchInvite();
  }, [inviteId, user, authLoading]);

  useEffect(() => {
    if (status !== "loading" || !user || !inviteData) return;

    const processInvite = async () => {
      try {
        // Check if the email matches (optional, but good for security)
        if (inviteData.email.toLowerCase() !== user.email?.toLowerCase()) {
           // We could allow different emails if we want, but usually it should match
           // throw new Error("Este convite foi enviado para outro e-mail.");
        }

        // 2. Add to store_collaborators
        const { error: collabError } = await supabase
          .from("store_collaborators")
          .insert({
            store_owner_id: inviteData.store_owner_id,
            collaborator_id: user.id,
            role: inviteData.role
          });

        if (collabError) {
          // Check if already a collaborator
          if (collabError.code === "23505") {
            // Already a collaborator, just proceed
          } else {
            throw collabError;
          }
        }

        // 3. Mark invite as accepted
        await supabase
          .from("store_invitations")
          .update({ accepted_at: new Date().toISOString() })
          .eq("id", inviteId);

        // 4. Get store slug to redirect
        const { data: store } = await supabase
          .from("store_settings")
          .select("store_slug")
          .eq("user_id", inviteData.store_owner_id)
          .maybeSingle();

        if (store?.store_slug) {
          setStoreSlug(store.store_slug);
          setStatus("success");
          toast.success("Convite aceito com sucesso!");
          setTimeout(() => {
            navigate(`/painel/${store.store_slug}`);
          }, 2000);
        } else {
          setStatus("success");
          navigate("/");
        }

      } catch (err: any) {
        console.error("Error accepting invite:", err);
        setStatus("error");
        setErrorMsg(err.message || "Erro ao processar o convite.");
      }
    };

    processInvite();
  }, [user, inviteId, inviteData, status, navigate]);

  if (status === "fetching_invite" || (status === "loading" && !storeSlug)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Processando seu convite...</p>
      </div>
    );
  }

  if (status === "not_logged_in") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center">
        <div className="bg-card p-8 rounded-2xl shadow-xl max-w-md w-full border border-border">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mx-auto mb-6">
            <UserPlus className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold mb-4">Você foi convidado!</h1>
          <p className="text-muted-foreground mb-6">
            Você recebeu um convite para colaborar em uma loja na Cartlly.
          </p>
          <div className="bg-muted/50 rounded-lg p-4 mb-8 text-left">
            <p className="text-sm font-medium text-foreground mb-1">Convite enviado para:</p>
            <p className="text-sm text-muted-foreground truncate">{inviteData?.email}</p>
          </div>
          
          <div className="space-y-3">
            <Button 
              className="w-full h-11" 
              onClick={() => navigate(`/login?type=invite&id=${inviteId}&email=${inviteData?.email || ""}&redirect=/accept-invite?id=${inviteId}`)}
            >
              Aceitar Convite
            </Button>
            <p className="text-xs text-muted-foreground">
              Ao clicar em aceitar, você poderá entrar em sua conta ou criar uma nova.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center">
        <div className="bg-card p-8 rounded-2xl shadow-xl max-w-md w-full border border-destructive/20">
          <XCircle className="h-16 w-16 text-destructive mb-4 mx-auto" />
          <h1 className="text-2xl font-bold mb-2 text-destructive">Ops!</h1>
          <p className="text-muted-foreground mb-8">{errorMsg}</p>
          <Button variant="outline" className="w-full" onClick={() => navigate("/")}>
            Voltar para o Início
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center">
      <div className="bg-card p-8 rounded-2xl shadow-xl max-w-md w-full border border-green-500/20">
        <CheckCircle2 className="h-16 w-16 text-green-500 mb-4 mx-auto" />
        <h1 className="text-2xl font-bold mb-2 text-green-500">Convite Aceito!</h1>
        <p className="text-muted-foreground mb-4">
          Agora você é um colaborador oficial.
        </p>
        <p className="text-sm text-muted-foreground">
          Redirecionando para o painel administrativo...
        </p>
      </div>
    </div>
  );
}
