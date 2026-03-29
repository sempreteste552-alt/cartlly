import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const { user_id, device_fingerprint, ip_address, user_agent } = body;

    if (!user_id || !device_fingerprint) {
      return new Response(
        JSON.stringify({ error: "user_id e device_fingerprint obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get security settings
    const { data: settings } = await supabase
      .from("security_settings")
      .select("*")
      .limit(1)
      .single();

    const requireNewDevice = settings?.require_otp_new_device ?? true;
    const requireNewIp = settings?.require_otp_new_ip ?? true;

    // Check if device is trusted
    const { data: device } = await supabase
      .from("device_sessions")
      .select("*")
      .eq("user_id", user_id)
      .eq("device_fingerprint", device_fingerprint)
      .eq("trusted", true)
      .maybeSingle();

    let requiresOtp = false;
    let reason = "";

    if (!device && requireNewDevice) {
      requiresOtp = true;
      reason = "new_device";
    } else if (device && ip_address && device.ip_address !== ip_address && requireNewIp) {
      requiresOtp = true;
      reason = "new_ip";
    }

    // Update last seen
    if (device) {
      await supabase
        .from("device_sessions")
        .update({ last_seen_at: new Date().toISOString(), ip_address, user_agent })
        .eq("id", device.id);
    } else {
      // Record the new device (untrusted)
      await supabase.from("device_sessions").insert({
        user_id,
        device_fingerprint,
        ip_address,
        user_agent,
        trusted: false,
      });
    }

    // Check login lockout
    const { data: settings2 } = await supabase
      .from("security_settings")
      .select("max_failed_logins, lockout_duration_minutes")
      .limit(1)
      .single();

    const maxFailed = settings2?.max_failed_logins || 5;
    const lockoutMinutes = settings2?.lockout_duration_minutes || 30;

    // Check recent failures for this user
    const windowStart = new Date(Date.now() - lockoutMinutes * 60 * 1000).toISOString();
    
    // Get user email for login attempts check
    const { data: userData } = await supabase.auth.admin.getUserById(user_id);
    if (userData?.user?.email) {
      const { count: failedCount } = await supabase
        .from("login_attempts")
        .select("*", { count: "exact", head: true })
        .eq("email", userData.user.email)
        .eq("success", false)
        .gte("created_at", windowStart);

      if ((failedCount || 0) >= maxFailed) {
        return new Response(
          JSON.stringify({
            requires_otp: false,
            locked: true,
            locked_until: new Date(Date.now() + lockoutMinutes * 60 * 1000).toISOString(),
            reason: "too_many_failures",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({
        requires_otp: requiresOtp,
        locked: false,
        reason,
        trusted_device: !!device?.trusted,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in check-device:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
