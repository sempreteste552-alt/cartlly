
-- Tabela para OTP de mudanças sensíveis no Super Admin
CREATE TABLE IF NOT EXISTS public.super_admin_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  super_admin_id UUID NOT NULL,
  target_user_id UUID NOT NULL,
  action TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  code_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_super_admin_otps_lookup
  ON public.super_admin_otps(super_admin_id, action, expires_at);

ALTER TABLE public.super_admin_otps ENABLE ROW LEVEL SECURITY;

-- Apenas o próprio super admin enxerga seus OTPs (UI poderá listar pendentes)
CREATE POLICY "Super admins can view own OTPs"
ON public.super_admin_otps
FOR SELECT
USING (auth.uid() = super_admin_id AND public.has_role(auth.uid(), 'super_admin'));

-- Inserts e updates passam SEMPRE pela edge function (service role bypassa RLS)
-- Por isso não criamos policy de INSERT/UPDATE/DELETE (bloqueio total para clientes).
