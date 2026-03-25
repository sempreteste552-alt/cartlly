import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { userId, action } = await req.json();

    if (!userId || !action) {
      return new Response(JSON.stringify({ error: "userId and action required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user email
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const email = userData.user.email;
    const displayName = userData.user.user_metadata?.display_name || email;

    if (action === "approved") {
      // Send a magic link / password reset so user can access their account
      // This effectively "activates" the account by sending them a link
      const { error: resetError } = await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email: email!,
        options: {
          redirectTo: `${req.headers.get("origin") || "https://cartlly.lovable.app"}/login`,
        },
      });

      // Also create an admin notification
      await supabaseAdmin.from("admin_notifications").insert({
        sender_user_id: "system",
        target_user_id: userId,
        title: "Conta Aprovada! 🎉",
        message: `Parabéns ${displayName}! Sua conta foi aprovada. Você já pode acessar o painel administrativo e configurar sua loja.`,
        type: "info",
      });

      return new Response(JSON.stringify({ 
        success: true, 
        message: `Conta aprovada. Notificação enviada para ${email}.` 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else if (action === "rejected") {
      await supabaseAdmin.from("admin_notifications").insert({
        sender_user_id: "system",
        target_user_id: userId,
        title: "Conta Não Aprovada",
        message: `Olá ${displayName}, infelizmente sua solicitação de conta não foi aprovada neste momento. Entre em contato com o suporte para mais informações.`,
        type: "alert",
      });

      return new Response(JSON.stringify({ 
        success: true, 
        message: `Conta rejeitada. Notificação enviada para ${email}.` 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else if (action === "blocked") {
      await supabaseAdmin.from("admin_notifications").insert({
        sender_user_id: "system",
        target_user_id: userId,
        title: "Conta Suspensa",
        message: `Olá ${displayName}, sua conta foi temporariamente suspensa. Entre em contato com o suporte para mais informações.`,
        type: "alert",
      });

      return new Response(JSON.stringify({ 
        success: true, 
        message: `Conta bloqueada. Notificação enviada.` 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
