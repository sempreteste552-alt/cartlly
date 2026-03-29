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
    const { email, code, purpose, device_fingerprint, ip_address, user_agent } = body;

    if (!email || !code || !purpose) {
      return new Response(
        JSON.stringify({ error: "Email, código e purpose são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find the OTP
    const now = new Date().toISOString();
    const { data: otpRecords, error: otpError } = await supabase
      .from("otp_codes")
      .select("*")
      .eq("destination", email)
      .eq("purpose", purpose)
      .is("used_at", null)
      .gte("expires_at", now)
      .order("created_at", { ascending: false })
      .limit(1);

    if (otpError || !otpRecords || otpRecords.length === 0) {
      return new Response(
        JSON.stringify({ error: "Código expirado ou inválido. Solicite um novo." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const otpRecord = otpRecords[0];

    // Check max attempts
    if (otpRecord.attempts >= otpRecord.max_attempts) {
      return new Response(
        JSON.stringify({ error: "Número máximo de tentativas excedido. Solicite um novo código." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Increment attempts
    await supabase
      .from("otp_codes")
      .update({ attempts: otpRecord.attempts + 1 })
      .eq("id", otpRecord.id);

    // Verify code
    if (otpRecord.code !== code) {
      const remaining = otpRecord.max_attempts - otpRecord.attempts - 1;
      return new Response(
        JSON.stringify({
          error: `Código incorreto. ${remaining > 0 ? `${remaining} tentativa(s) restante(s).` : "Solicite um novo código."}`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark as used
    await supabase
      .from("otp_codes")
      .update({ used_at: now })
      .eq("id", otpRecord.id);

    // If device info provided, register trusted device
    if (device_fingerprint && otpRecord.user_id !== "00000000-0000-0000-0000-000000000000") {
      const { data: existingDevice } = await supabase
        .from("device_sessions")
        .select("id")
        .eq("user_id", otpRecord.user_id)
        .eq("device_fingerprint", device_fingerprint)
        .maybeSingle();

      if (existingDevice) {
        await supabase
          .from("device_sessions")
          .update({
            trusted: true,
            verified_at: now,
            last_seen_at: now,
            ip_address,
            user_agent,
          })
          .eq("id", existingDevice.id);
      } else {
        await supabase.from("device_sessions").insert({
          user_id: otpRecord.user_id,
          device_fingerprint,
          ip_address,
          user_agent,
          trusted: true,
          verified_at: now,
        });
      }
    }

    // For password recovery, generate a password reset link
    let resetToken = null;
    if (purpose === "password_recovery" && otpRecord.user_id !== "00000000-0000-0000-0000-000000000000") {
      // Use Supabase admin to generate a recovery link
      const { data: linkData } = await supabase.auth.admin.generateLink({
        type: "recovery",
        email,
      });
      if (linkData?.properties?.hashed_token) {
        resetToken = linkData.properties.hashed_token;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        verified: true,
        user_id: otpRecord.user_id !== "00000000-0000-0000-0000-000000000000" ? otpRecord.user_id : null,
        reset_token: resetToken,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in verify-otp:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
