
-- Add reminder tracking and downgrade timestamp columns
ALTER TABLE public.tenant_subscriptions
  ADD COLUMN IF NOT EXISTS plan_reminders_sent integer[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS downgrade_applied_at timestamptz DEFAULT NULL;

-- Trigger function: auto-create 7-day PREMIUM trial for new tenants
CREATE OR REPLACE FUNCTION public.auto_create_trial_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  premium_plan_id uuid;
BEGIN
  -- Only for admin profiles (not customers)
  IF NEW.status IS NULL OR NEW.status NOT IN ('active', 'pending') THEN
    RETURN NEW;
  END IF;

  -- Check if user already has a subscription
  IF EXISTS (SELECT 1 FROM public.tenant_subscriptions WHERE user_id = NEW.user_id) THEN
    RETURN NEW;
  END IF;

  -- Get the PREMIUM plan for trial
  SELECT id INTO premium_plan_id FROM public.tenant_plans WHERE name = 'PREMIUM' AND active = true LIMIT 1;

  IF premium_plan_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.tenant_subscriptions (user_id, plan_id, status, trial_ends_at, current_period_start, current_period_end)
  VALUES (
    NEW.user_id,
    premium_plan_id,
    'trial',
    now() + interval '7 days',
    now(),
    now() + interval '7 days'
  );

  -- Notify the tenant about their trial
  INSERT INTO public.admin_notifications (sender_user_id, target_user_id, title, message, type)
  VALUES (
    NEW.user_id,
    NEW.user_id,
    '🎉 Bem-vindo! Seu Trial Premium começou',
    'Você tem 7 dias para testar todas as funcionalidades Premium gratuitamente. Aproveite!',
    'trial_started'
  );

  RETURN NEW;
END;
$$;

-- Attach trigger to profiles table (fires on new tenant signup)
DROP TRIGGER IF EXISTS on_new_profile_create_trial ON public.profiles;
CREATE TRIGGER on_new_profile_create_trial
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_trial_subscription();
