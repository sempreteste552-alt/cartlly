-- 1. Referral Codes table
CREATE TABLE public.referral_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  code TEXT NOT NULL UNIQUE,
  clicks INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants can view their own referral codes"
  ON public.referral_codes FOR SELECT TO authenticated
  USING (auth.uid() = tenant_id);

CREATE POLICY "Super admins can view all referral codes"
  ON public.referral_codes FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Tenants can insert their own referral code"
  ON public.referral_codes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = tenant_id);

CREATE TRIGGER update_referral_codes_updated_at
  BEFORE UPDATE ON public.referral_codes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Referrals table
CREATE TABLE public.referrals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_tenant_id UUID NOT NULL,
  referred_user_id UUID,
  referred_email TEXT,
  referred_plan_id UUID REFERENCES public.tenant_plans(id),
  referral_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'clicked' CHECK (status IN ('clicked','registered','subscribed','payment_approved','active','cancelled','expired')),
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending','approved','refused','refunded')),
  discount_amount NUMERIC NOT NULL DEFAULT 0,
  discount_applied BOOLEAN NOT NULL DEFAULT false,
  subscription_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  CONSTRAINT no_self_referral CHECK (referrer_tenant_id IS DISTINCT FROM referred_user_id)
);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants can view their own referrals"
  ON public.referrals FOR SELECT TO authenticated
  USING (auth.uid() = referrer_tenant_id);

CREATE POLICY "Super admins can view all referrals"
  ON public.referrals FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "System can insert referrals"
  ON public.referrals FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Super admins can update referrals"
  ON public.referrals FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER update_referrals_updated_at
  BEFORE UPDATE ON public.referrals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_referrals_referrer ON public.referrals(referrer_tenant_id);
CREATE INDEX idx_referrals_referred_user ON public.referrals(referred_user_id);
CREATE INDEX idx_referrals_code ON public.referrals(referral_code);

-- 3. Referral Discounts table
CREATE TABLE public.referral_discounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  referral_id UUID NOT NULL REFERENCES public.referrals(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL DEFAULT 0,
  billing_cycle TEXT,
  applied BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.referral_discounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants can view their own discounts"
  ON public.referral_discounts FOR SELECT TO authenticated
  USING (auth.uid() = tenant_id);

CREATE POLICY "Super admins can view all discounts"
  ON public.referral_discounts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "System can insert discounts"
  ON public.referral_discounts FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE INDEX idx_referral_discounts_tenant ON public.referral_discounts(tenant_id);

-- 4. Auto-generate referral code for new tenants
CREATE OR REPLACE FUNCTION public.auto_create_referral_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code TEXT;
BEGIN
  -- Generate a short unique code
  v_code := upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  
  INSERT INTO public.referral_codes (tenant_id, code)
  VALUES (NEW.user_id, v_code)
  ON CONFLICT DO NOTHING;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_auto_referral_code
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  WHEN (NEW.status IN ('active', 'pending'))
  EXECUTE FUNCTION public.auto_create_referral_code();

-- 5. Function to increment click count (public-safe)
CREATE OR REPLACE FUNCTION public.increment_referral_click(_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.referral_codes SET clicks = clicks + 1 WHERE code = _code;
  IF FOUND THEN
    -- Create a clicked referral entry
    INSERT INTO public.referrals (referrer_tenant_id, referral_code, status)
    SELECT tenant_id, _code, 'clicked'
    FROM public.referral_codes WHERE code = _code;
    RETURN true;
  END IF;
  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_referral_click(text) TO anon, authenticated;

-- 6. Function to process referral approval (called when payment is confirmed)
CREATE OR REPLACE FUNCTION public.process_referral_approval(_referred_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referral RECORD;
  v_discount_amount NUMERIC;
  v_plan_id UUID;
  v_sub_id UUID;
BEGIN
  -- Get configurable discount amount (default R$10)
  SELECT COALESCE((value->>'value')::numeric, 10) INTO v_discount_amount
  FROM public.platform_settings WHERE key = 'referral_discount_amount';
  
  IF v_discount_amount IS NULL THEN v_discount_amount := 10; END IF;

  -- Find the referral for this user
  SELECT * INTO v_referral
  FROM public.referrals
  WHERE referred_user_id = _referred_user_id
    AND status IN ('registered', 'subscribed')
    AND discount_applied = false
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF v_referral IS NULL THEN RETURN; END IF;

  -- Get the referred user's active subscription
  SELECT id, plan_id INTO v_sub_id, v_plan_id
  FROM public.tenant_subscriptions
  WHERE user_id = _referred_user_id
    AND status = 'active'
  ORDER BY updated_at DESC
  LIMIT 1;
  
  IF v_sub_id IS NULL THEN RETURN; END IF;

  -- Verify the plan is paid (not free)
  IF NOT EXISTS (
    SELECT 1 FROM public.tenant_plans
    WHERE id = v_plan_id AND price > 0
  ) THEN RETURN; END IF;

  -- Update the referral
  UPDATE public.referrals
  SET status = 'payment_approved',
      payment_status = 'approved',
      discount_amount = v_discount_amount,
      discount_applied = true,
      referred_plan_id = v_plan_id,
      subscription_id = v_sub_id,
      approved_at = now()
  WHERE id = v_referral.id;

  -- Create the discount entry
  INSERT INTO public.referral_discounts (tenant_id, referral_id, amount, billing_cycle, applied)
  VALUES (v_referral.referrer_tenant_id, v_referral.id, v_discount_amount, to_char(now(), 'YYYY-MM'), false);

  -- Notify the referrer
  INSERT INTO public.admin_notifications (sender_user_id, target_user_id, title, message, type)
  VALUES (
    v_referral.referrer_tenant_id,
    v_referral.referrer_tenant_id,
    '🎉 Indicação aprovada!',
    'Um indicado seu assinou e pagou! Você ganhou R$ ' || v_discount_amount || ' de desconto na próxima mensalidade.',
    'referral_approved'
  );
END;
$$;

-- 7. Insert default referral discount amount setting
INSERT INTO public.platform_settings (key, value)
VALUES ('referral_discount_amount', '{"value": 10}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 8. Re-add the policy for authenticated users to read platform_settings (was removed earlier)
CREATE POLICY "Authenticated can read platform settings"
ON public.platform_settings
FOR SELECT
TO authenticated
USING (true);