-- Add missing columns to referrals
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS ip_address text;
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS user_agent text;
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS flagged boolean NOT NULL DEFAULT false;
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS flagged_reason text;
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS clicked_at timestamptz;
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS subscribed_at timestamptz;

-- Update increment_referral_click to accept IP and user_agent
CREATE OR REPLACE FUNCTION public.increment_referral_click(_code text, _ip text DEFAULT NULL, _ua text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_referrer_id UUID;
  v_suspicious BOOLEAN := false;
  v_reason TEXT;
BEGIN
  UPDATE public.referral_codes SET clicks = clicks + 1 WHERE code = _code;
  IF NOT FOUND THEN RETURN false; END IF;

  SELECT tenant_id INTO v_referrer_id FROM public.referral_codes WHERE code = _code;

  -- Anti-fraud: check if same IP generated > 5 clicks in last hour
  IF _ip IS NOT NULL THEN
    IF (SELECT COUNT(*) FROM public.referrals WHERE ip_address = _ip AND created_at > now() - interval '1 hour') > 5 THEN
      v_suspicious := true;
      v_reason := 'Múltiplos cliques do mesmo IP em curto período';
    END IF;
  END IF;

  INSERT INTO public.referrals (referrer_tenant_id, referral_code, status, ip_address, user_agent, clicked_at, flagged, flagged_reason)
  VALUES (v_referrer_id, _code, 'clicked', _ip, _ua, now(), v_suspicious, v_reason);
  
  RETURN true;
END;
$$;

-- Update handle_new_user_setup to store IP/UA and enhanced anti-fraud
CREATE OR REPLACE FUNCTION public.handle_new_user_setup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_store_name TEXT;
    v_store_slug TEXT;
    v_display_name TEXT;
    v_store_category TEXT;
    v_premium_plan_id UUID;
    v_ref_code TEXT;
    v_referrer_id UUID;
    v_referrer_email TEXT;
    v_ip TEXT;
    v_ua TEXT;
    v_flagged BOOLEAN := false;
    v_flag_reason TEXT;
    v_same_ip_count INTEGER;
BEGIN
    -- Skip profile creation for customer accounts
    IF (NEW.raw_user_meta_data->>'is_customer')::boolean = true THEN
      RETURN NEW;
    END IF;
    IF (NEW.raw_user_meta_data->>'store_customer_signup')::boolean = true THEN
      RETURN NEW;
    END IF;

    -- Extract data from metadata
    v_display_name := COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email);
    v_store_name := COALESCE(NEW.raw_user_meta_data->>'store_name', v_display_name);
    v_store_slug := NEW.raw_user_meta_data->>'store_slug';
    v_store_category := NEW.raw_user_meta_data->>'store_category';
    v_ref_code := NEW.raw_user_meta_data->>'referral_code';
    v_ip := NEW.raw_user_meta_data->>'signup_ip';
    v_ua := NEW.raw_user_meta_data->>'signup_user_agent';

    -- Get Premium Plan ID
    SELECT id INTO v_premium_plan_id FROM public.tenant_plans WHERE name = 'PREMIUM' LIMIT 1;

    -- Insert into profiles
    INSERT INTO public.profiles (user_id, display_name, status)
    VALUES (NEW.id, v_display_name, 'active')
    ON CONFLICT (user_id) DO NOTHING;

    -- Insert into store_settings
    IF v_store_slug IS NOT NULL THEN
        INSERT INTO public.store_settings (user_id, store_name, store_slug, store_category)
        VALUES (NEW.id, v_store_name, v_store_slug, v_store_category)
        ON CONFLICT (user_id) DO UPDATE 
        SET store_name = EXCLUDED.store_name, 
            store_slug = EXCLUDED.store_slug,
            store_category = COALESCE(EXCLUDED.store_category, store_settings.store_category)
        WHERE store_settings.store_slug IS NULL OR store_settings.store_slug = '';
    ELSE
        INSERT INTO public.store_settings (user_id, store_name, store_category)
        VALUES (NEW.id, v_store_name, v_store_category)
        ON CONFLICT (user_id) DO NOTHING;
    END IF;

    -- Create 7-day trial subscription
    IF v_premium_plan_id IS NOT NULL THEN
        INSERT INTO public.tenant_subscriptions (
            user_id, plan_id, status, trial_ends_at,
            current_period_start, current_period_end
        )
        VALUES (
            NEW.id, v_premium_plan_id, 'trial', 
            now() + interval '7 days', now(), now() + interval '7 days'
        )
        ON CONFLICT (user_id) DO NOTHING;
    END IF;

    -- Handle referral code
    IF v_ref_code IS NOT NULL AND v_ref_code != '' THEN
        SELECT tenant_id INTO v_referrer_id
        FROM public.referral_codes
        WHERE code = v_ref_code;
        
        IF v_referrer_id IS NOT NULL THEN
            -- Anti-fraud checks
            -- 1. Self-referral
            IF v_referrer_id = NEW.id THEN
                v_flagged := true;
                v_flag_reason := 'Autoindicação detectada';
            END IF;
            
            -- 2. Same email
            SELECT email INTO v_referrer_email FROM auth.users WHERE id = v_referrer_id;
            IF v_referrer_email IS NOT DISTINCT FROM NEW.email THEN
                v_flagged := true;
                v_flag_reason := COALESCE(v_flag_reason || '; ', '') || 'Mesmo email do indicador';
            END IF;
            
            -- 3. Same IP with multiple registrations
            IF v_ip IS NOT NULL THEN
                SELECT COUNT(*) INTO v_same_ip_count
                FROM public.referrals
                WHERE ip_address = v_ip AND status != 'clicked'
                  AND created_at > now() - interval '24 hours';
                IF v_same_ip_count >= 3 THEN
                    v_flagged := true;
                    v_flag_reason := COALESCE(v_flag_reason || '; ', '') || 'Múltiplos cadastros do mesmo IP';
                END IF;
            END IF;

            -- Skip if self-referral
            IF v_referrer_id != NEW.id AND v_referrer_email IS DISTINCT FROM NEW.email THEN
                -- Update existing clicked referral or insert new
                UPDATE public.referrals
                SET status = 'registered',
                    referred_user_id = NEW.id,
                    referred_email = NEW.email,
                    ip_address = COALESCE(v_ip, ip_address),
                    user_agent = COALESCE(v_ua, user_agent),
                    flagged = v_flagged,
                    flagged_reason = v_flag_reason
                WHERE referral_code = v_ref_code
                  AND status = 'clicked'
                  AND referred_user_id IS NULL
                  AND id = (
                    SELECT id FROM public.referrals
                    WHERE referral_code = v_ref_code AND status = 'clicked' AND referred_user_id IS NULL
                    ORDER BY created_at DESC LIMIT 1
                  );
                
                IF NOT FOUND THEN
                    INSERT INTO public.referrals (referrer_tenant_id, referred_user_id, referred_email, referral_code, status, ip_address, user_agent, flagged, flagged_reason)
                    VALUES (v_referrer_id, NEW.id, NEW.email, v_ref_code, 'registered', v_ip, v_ua, v_flagged, v_flag_reason);
                END IF;
            ELSIF v_flagged THEN
                -- Still record flagged attempts for audit
                INSERT INTO public.referrals (referrer_tenant_id, referred_user_id, referred_email, referral_code, status, ip_address, user_agent, flagged, flagged_reason)
                VALUES (v_referrer_id, NEW.id, NEW.email, v_ref_code, 'flagged', v_ip, v_ua, true, v_flag_reason);
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- Update process_referral_approval to block flagged referrals
CREATE OR REPLACE FUNCTION public.process_referral_approval(_referred_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_referral RECORD;
  v_discount_amount NUMERIC;
  v_plan_id UUID;
  v_sub_id UUID;
BEGIN
  SELECT COALESCE((value->>'value')::numeric, 10) INTO v_discount_amount
  FROM public.platform_settings WHERE key = 'referral_discount_amount';
  IF v_discount_amount IS NULL THEN v_discount_amount := 10; END IF;

  SELECT * INTO v_referral
  FROM public.referrals
  WHERE referred_user_id = _referred_user_id
    AND status IN ('registered', 'subscribed')
    AND discount_applied = false
    AND flagged = false  -- BLOCK flagged referrals
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF v_referral IS NULL THEN RETURN; END IF;

  SELECT id, plan_id INTO v_sub_id, v_plan_id
  FROM public.tenant_subscriptions
  WHERE user_id = _referred_user_id
    AND status = 'active'
  ORDER BY updated_at DESC
  LIMIT 1;
  
  IF v_sub_id IS NULL THEN RETURN; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.tenant_plans WHERE id = v_plan_id AND price > 0
  ) THEN RETURN; END IF;

  -- Check for duplicate discount
  IF EXISTS (
    SELECT 1 FROM public.referral_discounts
    WHERE referral_id = v_referral.id AND applied = true
  ) THEN RETURN; END IF;

  UPDATE public.referrals
  SET status = 'payment_approved',
      payment_status = 'approved',
      discount_amount = v_discount_amount,
      discount_applied = true,
      referred_plan_id = v_plan_id,
      subscription_id = v_sub_id,
      approved_at = now(),
      subscribed_at = COALESCE(subscribed_at, now())
  WHERE id = v_referral.id;

  INSERT INTO public.referral_discounts (tenant_id, referral_id, amount, billing_cycle, applied)
  VALUES (v_referral.referrer_tenant_id, v_referral.id, v_discount_amount, to_char(now(), 'YYYY-MM'), false);

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

-- Add RLS policy for super admin to read all referrals
CREATE POLICY "Super admins can read all referrals"
ON public.referrals FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

-- Add RLS policy for super admin to update referrals (flag/unflag)
CREATE POLICY "Super admins can update all referrals"
ON public.referrals FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

-- Super admin read all referral_codes
CREATE POLICY "Super admins can read all referral_codes"
ON public.referral_codes FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

-- Super admin read all referral_discounts
CREATE POLICY "Super admins can read all referral_discounts"
ON public.referral_discounts FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

-- Super admin can update referral_discounts
CREATE POLICY "Super admins can update referral_discounts"
ON public.referral_discounts FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));