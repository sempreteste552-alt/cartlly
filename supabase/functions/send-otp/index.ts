import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function generateOTP(length: number): string {
  const digits = "0123456789";
  let otp = "";
  for (let i = 0; i < length; i++) {
    otp += digits[Math.floor(Math.random() * 10)];
  }
  return otp;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const { email, purpose, method = "email" } = body;

    if (!email || !purpose) {
      return new Response(
        JSON.stringify({ error: "Email e purpose são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get security settings
    const { data: settings } = await supabase
      .from("security_settings")
      .select("*")
      .limit(1)
      .single();

    const codeLength = settings?.otp_code_length || 6;
    const expirationMinutes = settings?.otp_expiration_minutes || 5;
    const maxAttempts = settings?.otp_max_attempts || 5;

    // Check if method is enabled
    if (method === "email" && !settings?.otp_email_enabled) {
      return new Response(
        JSON.stringify({ error: "Verificação por email está desativada" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (method === "sms" && !settings?.otp_sms_enabled) {
      return new Response(
        JSON.stringify({ error: "Verificação por SMS está desativada" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Rate limit: max 3 OTPs per email per 10 minutes
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { count: recentCount } = await supabase
      .from("otp_codes")
      .select("*", { count: "exact", head: true })
      .eq("destination", email)
      .eq("purpose", purpose)
      .gte("created_at", tenMinutesAgo);

    if ((recentCount || 0) >= 3) {
      return new Response(
        JSON.stringify({ error: "Muitas tentativas. Tente novamente em alguns minutos." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find user by email
    const { data: userData } = await supabase.auth.admin.listUsers();
    const user = userData?.users?.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );

    // For password recovery, don't reveal if user exists
    const userId = user?.id || "00000000-0000-0000-0000-000000000000";

    // Generate OTP
    const code = generateOTP(codeLength);
    const expiresAt = new Date(
      Date.now() + expirationMinutes * 60 * 1000
    ).toISOString();

    // Save OTP to database
    await supabase.from("otp_codes").insert({
      user_id: userId,
      code,
      purpose,
      method,
      destination: email,
      max_attempts: maxAttempts,
      expires_at: expiresAt,
    });

    // Send OTP via email using the email queue
    if (method === "email") {
      const purposeLabels: Record<string, string> = {
        login: "Login",
        register: "Cadastro",
        password_recovery: "Recuperação de Senha",
        password_change: "Troca de Senha",
        new_device: "Novo Dispositivo",
        sensitive_action: "Ação Sensível",
      };

      const purposeLabel = purposeLabels[purpose] || purpose;

      // Try to enqueue to email queue, fallback to direct
      try {
        await supabase.rpc("enqueue_email", {
          queue_name: "transactional_emails",
          payload: {
            to: email,
            subject: `Código de Verificação - ${purposeLabel}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
                <div style="text-align: center; margin-bottom: 24px;">
                  <h1 style="color: #1a1a1a; font-size: 24px; margin: 0;">Código de Verificação</h1>
                  <p style="color: #666; font-size: 14px; margin-top: 8px;">${purposeLabel}</p>
                </div>
                <div style="background: #f5f5f5; border-radius: 12px; padding: 32px; text-align: center; margin: 24px 0;">
                  <p style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #1a1a1a; margin: 0;">${code}</p>
                </div>
                <p style="color: #666; font-size: 13px; text-align: center;">
                  Este código expira em <strong>${expirationMinutes} minutos</strong>.
                </p>
                <p style="color: #999; font-size: 12px; text-align: center; margin-top: 24px;">
                  Se você não solicitou este código, ignore este e-mail.
                </p>
              </div>
            `,
            template_name: "otp_verification",
          },
        });
      } catch {
        // If queue is not available, log but still return success
        console.log("Email queue not available, OTP saved to database");
      }
    }

    // For SMS/WhatsApp - placeholder (needs Twilio)
    if (method === "sms" || method === "whatsapp") {
      console.log(`[OTP] ${method} sending not configured yet. Code: ${code} to ${email}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        method,
        expiresInMinutes: expirationMinutes,
        codeLength,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in send-otp:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
