CREATE OR REPLACE FUNCTION public.handle_new_user_setup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

    -- Get Premium Plan ID
    SELECT id INTO v_premium_plan_id FROM public.tenant_plans WHERE name = 'PREMIUM' LIMIT 1;

    -- Insert into profiles using user_id for conflict resolution
    INSERT INTO public.profiles (user_id, display_name, status)
    VALUES (NEW.id, v_display_name, 'active')
    ON CONFLICT (user_id) DO NOTHING;

    -- Insert into store_settings if we have a slug
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
        
        IF v_referrer_id IS NOT NULL AND v_referrer_id != NEW.id THEN
            -- Check the referrer email is different (anti-fraud)
            SELECT email INTO v_referrer_email FROM auth.users WHERE id = v_referrer_id;
            
            IF v_referrer_email IS DISTINCT FROM NEW.email THEN
                -- Update any existing 'clicked' referral to 'registered', or insert new
                UPDATE public.referrals
                SET status = 'registered',
                    referred_user_id = NEW.id,
                    referred_email = NEW.email
                WHERE referral_code = v_ref_code
                  AND status = 'clicked'
                  AND referred_user_id IS NULL
                  AND id = (
                    SELECT id FROM public.referrals
                    WHERE referral_code = v_ref_code AND status = 'clicked' AND referred_user_id IS NULL
                    ORDER BY created_at DESC LIMIT 1
                  );
                
                -- If no clicked referral was updated, insert a new one
                IF NOT FOUND THEN
                    INSERT INTO public.referrals (referrer_tenant_id, referred_user_id, referred_email, referral_code, status)
                    VALUES (v_referrer_id, NEW.id, NEW.email, v_ref_code, 'registered');
                END IF;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;