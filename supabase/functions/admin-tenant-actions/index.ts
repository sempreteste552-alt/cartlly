import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller is super_admin
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Check if caller is super_admin
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "super_admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
    }

    const body = await req.json();
    const { action, targetUserId, targetEmail } = body;

    if (!action) {
      return new Response(JSON.stringify({ error: "Missing action" }), { status: 400, headers: corsHeaders });
    }

    switch (action) {
      case "resend_verification": {
        if (!targetEmail) {
          return new Response(JSON.stringify({ error: "Missing targetEmail" }), { status: 400, headers: corsHeaders });
        }
        // Use admin API to resend verification
        const { error } = await adminClient.auth.resend({
          type: "signup",
          email: targetEmail,
        });
        if (error) throw error;
        return new Response(JSON.stringify({ success: true, message: "Verification email resent" }), { headers: corsHeaders });
      }

      case "send_password_reset": {
        if (!targetEmail) {
          return new Response(JSON.stringify({ error: "Missing targetEmail" }), { status: 400, headers: corsHeaders });
        }
        // Use origin from request headers, fallback to known app URL
        const origin = req.headers.get("origin") || body.origin || "https://cartlly.lovable.app";
        const { error } = await adminClient.auth.resetPasswordForEmail(targetEmail, {
          redirectTo: `${origin}/reset-password`,
        });
        if (error) throw error;
        return new Response(JSON.stringify({ success: true, message: "Password reset email sent" }), { headers: corsHeaders });
      }

      case "manual_activate": {
        if (!targetUserId) {
          return new Response(JSON.stringify({ error: "Missing targetUserId" }), { status: 400, headers: corsHeaders });
        }
        // Update profile status to active
        const { error: profileError } = await adminClient
          .from("profiles")
          .update({ status: "active" })
          .eq("user_id", targetUserId);
        if (profileError) throw profileError;

        // Confirm email in auth if not confirmed
        const { error: authError } = await adminClient.auth.admin.updateUserById(targetUserId, {
          email_confirm: true,
        });
        if (authError) console.error("Auth confirm error:", authError);

        return new Response(JSON.stringify({ success: true, message: "Account manually activated" }), { headers: corsHeaders });
      }

      case "deactivate": {
        if (!targetUserId) {
          return new Response(JSON.stringify({ error: "Missing targetUserId" }), { status: 400, headers: corsHeaders });
        }
        const { error } = await adminClient
          .from("profiles")
          .update({ status: "blocked" })
          .eq("user_id", targetUserId);
        if (error) throw error;
        return new Response(JSON.stringify({ success: true, message: "Account deactivated" }), { headers: corsHeaders });
      }

      case "get_user_info": {
        if (!targetUserId) {
          return new Response(JSON.stringify({ error: "Missing targetUserId" }), { status: 400, headers: corsHeaders });
        }
        const { data: userData, error } = await adminClient.auth.admin.getUserById(targetUserId);
        if (error) throw error;
        return new Response(JSON.stringify({
          email: userData.user?.email,
          email_confirmed: !!userData.user?.email_confirmed_at,
          confirmed_at: userData.user?.email_confirmed_at,
          created_at: userData.user?.created_at,
          last_sign_in: userData.user?.last_sign_in_at,
        }), { headers: corsHeaders });
      }

      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: corsHeaders });
    }
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});
