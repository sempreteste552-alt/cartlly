
-- OTP codes table
CREATE TABLE public.otp_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  code text NOT NULL,
  purpose text NOT NULL DEFAULT 'login',
  method text NOT NULL DEFAULT 'email',
  destination text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  expires_at timestamp with time zone NOT NULL,
  used_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage OTP codes" ON public.otp_codes
  FOR ALL TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Device sessions table
CREATE TABLE public.device_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  device_fingerprint text NOT NULL,
  ip_address text,
  user_agent text,
  browser text,
  os text,
  trusted boolean NOT NULL DEFAULT false,
  verified_at timestamp with time zone,
  last_seen_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.device_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own device sessions" ON public.device_sessions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own device sessions" ON public.device_sessions
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage device sessions" ON public.device_sessions
  FOR ALL TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Security settings table (super admin configurable)
CREATE TABLE public.security_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  otp_email_enabled boolean NOT NULL DEFAULT true,
  otp_sms_enabled boolean NOT NULL DEFAULT false,
  otp_whatsapp_enabled boolean NOT NULL DEFAULT false,
  otp_default_method text NOT NULL DEFAULT 'email',
  otp_code_length integer NOT NULL DEFAULT 6,
  otp_expiration_minutes integer NOT NULL DEFAULT 5,
  otp_max_attempts integer NOT NULL DEFAULT 5,
  require_otp_new_device boolean NOT NULL DEFAULT true,
  require_otp_new_ip boolean NOT NULL DEFAULT true,
  lockout_duration_minutes integer NOT NULL DEFAULT 30,
  max_failed_logins integer NOT NULL DEFAULT 5,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.security_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read security settings" ON public.security_settings
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Super admins can manage security settings" ON public.security_settings
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'))
  WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- Insert default security settings
INSERT INTO public.security_settings (otp_email_enabled, otp_default_method) VALUES (true, 'email');

-- Login attempts tracking table
CREATE TABLE public.login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  ip_address text,
  success boolean NOT NULL DEFAULT false,
  locked_until timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage login attempts" ON public.login_attempts
  FOR ALL TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Super admins can view login attempts" ON public.login_attempts
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'super_admin'));

-- Index for performance
CREATE INDEX idx_otp_codes_user_purpose ON public.otp_codes (user_id, purpose, expires_at);
CREATE INDEX idx_device_sessions_user ON public.device_sessions (user_id, device_fingerprint);
CREATE INDEX idx_login_attempts_email ON public.login_attempts (email, created_at);
