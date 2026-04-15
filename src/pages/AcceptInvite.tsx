import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function AcceptInvite() {
  const [searchParams] = useSearchParams();
  const inviteId = searchParams.get("id");
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error" | "not_logged_in">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [storeSlug, setStoreSlug] = useState("");

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setStatus("not_logged_in");
      return;
    }

    if (!inviteId) {
      setStatus("error");
      setErrorMsg("ID do convite inválido.");
      return;
    }

    const processInvite = async () => {
      try {
        // 1. Get invitation details
        const { data: invite, error: inviteError } = await supabase
          .from("store_invitations")
          .select("*")
          .eq("id", inviteId)
          .maybeSingle();

        if (inviteError) throw inviteError;
        if (!invite) throw new Error("Convite não encontrado.");
        if (invite.accepted_at) throw new Error("Este convite já foi utilizado.");

        // Check if the email matches (optional, but good for security)
        if (invite.email.toLowerCase() !== user.email?.toLowerCase()) {
           // We could allow different emails if we want, but usually it should match
           // throw new Error("Este convite foi enviado para outro e-mail.");
        }

        // 2. Add to store_collaborators
        const { error: collabError } = await supabase
          .from("store_collaborators")
          .insert({
            store_owner_id: invite.store_owner_id,
            collaborator_id: user.id,
            role: invite.role
          });

        if (collabError) {
          // Check if already a collaborator
          if (collabError.code === "23505") {
            // Already a collaborator, just proceed to mark invite as accepted
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
          .eq("user_id", invite.store_owner_id)
          .maybeSingle();

        if (store?.store_slug) {
          setStoreSlug(store.store_slug);
          setStatus("success");
          toast.success("Convite aceito com sucesso!");
          // Wait a bit and redirect
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
  }, [user, inviteId, authLoading, navigate]);

  if (status === "loading" || authLoading) {
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
          <h1 className="text-2xl font-bold mb-4">Você recebeu um convite!</h1>
          <p className="text-muted-foreground mb-8">
            Para aceitar o convite e acessar o painel administrativo, você precisa estar conectado.
          </p>
          <Button 
            className="w-full" 
            onClick={() => navigate(`/login?redirect=/accept-invite?id=${inviteId}`)}
          >
            Fazer Login
          </Button>
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
          Redirecionando para o painel de <strong>{storeSlug}</strong>...
        </p>
      </div>
    </div>
  );
}
