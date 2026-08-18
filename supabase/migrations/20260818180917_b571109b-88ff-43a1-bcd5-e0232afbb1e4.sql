ALTER TABLE public.tenant_subscriptions
  ADD COLUMN IF NOT EXISTS trial_used boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS trial_card_last4 text,
  ADD COLUMN IF NOT EXISTS trial_card_brand text,
  ADD COLUMN IF NOT EXISTS trial_started_at timestamptz;

UPDATE public.tenant_subscriptions
  SET trial_used = true
  WHERE trial_ends_at IS NOT NULL AND trial_used = false;

INSERT INTO public.platform_settings (key, value)
  VALUES ('plan_trial_days', '{"value":"7"}'::jsonb)
  ON CONFLICT (key) DO NOTHING;