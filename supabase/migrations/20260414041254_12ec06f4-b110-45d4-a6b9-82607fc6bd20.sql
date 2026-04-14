CREATE OR REPLACE FUNCTION public.handle_referral_registration()
RETURNS TRIGGER AS $$
DECLARE
    v_loyalty_config RECORD;
BEGIN
    -- Get loyalty config for the store
    SELECT * INTO v_loyalty_config 
    FROM public.loyalty_config 
    WHERE store_user_id = NEW.store_user_id
    LIMIT 1;

    -- If config says reward on registration, and referral is pending (newly created)
    IF v_loyalty_config.referral_enabled AND v_loyalty_config.referral_reward_condition = 'registration' THEN
        -- Mark as completed immediately
        NEW.status := 'completed';
        NEW.completed_at := now();

        -- Grant points if reward type is points
        IF v_loyalty_config.referral_reward_type = 'points' THEN
            -- Update or insert loyalty points for the referrer
            INSERT INTO public.loyalty_points (customer_id, store_user_id, points_balance, lifetime_points)
            VALUES (NEW.referrer_id, NEW.store_user_id, v_loyalty_config.referral_reward_points, v_loyalty_config.referral_reward_points)
            ON CONFLICT (customer_id, store_user_id) DO UPDATE SET 
                points_balance = loyalty_points.points_balance + EXCLUDED.points_balance,
                lifetime_points = loyalty_points.lifetime_points + EXCLUDED.lifetime_points,
                updated_at = now();

            -- Log transaction
            INSERT INTO public.loyalty_transactions (customer_id, store_user_id, type, amount, description)
            VALUES (NEW.referrer_id, NEW.store_user_id, 'earn', v_loyalty_config.referral_reward_points, 'Recompensa por indicação (cadastro)');
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on customer_referrals
DROP TRIGGER IF EXISTS tr_referral_registration ON public.customer_referrals;
CREATE TRIGGER tr_referral_registration
BEFORE INSERT ON public.customer_referrals
FOR EACH ROW
EXECUTE FUNCTION public.handle_referral_registration();