
-- Allow tenants to insert/update their own AI settings (was missing)
CREATE POLICY "Tenants insert own ai settings"
ON public.tenant_ai_settings
FOR INSERT
WITH CHECK (tenant_id = auth.uid());

CREATE POLICY "Tenants update own ai settings"
ON public.tenant_ai_settings
FOR UPDATE
USING (tenant_id = auth.uid())
WITH CHECK (tenant_id = auth.uid());

-- Add configurable alert channels and thresholds per tenant
ALTER TABLE public.tenant_ai_settings
  ADD COLUMN IF NOT EXISTS alert_channels jsonb NOT NULL DEFAULT '{"in_app":true,"email":false,"push":false}'::jsonb,
  ADD COLUMN IF NOT EXISTS alert_thresholds jsonb NOT NULL DEFAULT '[50,75,90,100]'::jsonb,
  ADD COLUMN IF NOT EXISTS alert_email text;
