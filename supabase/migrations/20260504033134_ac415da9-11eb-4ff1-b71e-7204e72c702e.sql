-- Trigger: when a tenant subscription becomes active on a paid plan,
-- run the referral approval flow for the referred user.
CREATE OR REPLACE FUNCTION public.tr_process_referral_on_subscription()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_paid BOOLEAN;
BEGIN
  IF NEW.status = 'active' THEN
    SELECT (price > 0) INTO v_paid FROM public.tenant_plans WHERE id = NEW.plan_id;
    IF COALESCE(v_paid, false) THEN
      PERFORM public.process_referral_approval(NEW.user_id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_process_referral_on_subscription ON public.tenant_subscriptions;
CREATE TRIGGER trg_process_referral_on_subscription
AFTER INSERT OR UPDATE OF status, plan_id ON public.tenant_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.tr_process_referral_on_subscription();

-- Backfill: regularize any existing referred users with active paid subscriptions
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT ts.user_id
    FROM public.tenant_subscriptions ts
    JOIN public.tenant_plans tp ON tp.id = ts.plan_id
    JOIN public.referrals rf ON rf.referred_user_id = ts.user_id
    WHERE ts.status = 'active'
      AND tp.price > 0
      AND rf.status IN ('registered', 'subscribed')
      AND rf.discount_applied = false
      AND rf.flagged = false
  LOOP
    PERFORM public.process_referral_approval(r.user_id);
  END LOOP;
END$$;