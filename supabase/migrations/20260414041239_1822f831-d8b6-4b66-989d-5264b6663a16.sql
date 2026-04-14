CREATE OR REPLACE FUNCTION public.handle_referral_completion()
RETURNS TRIGGER AS $$
DECLARE
    v_loyalty_config RECORD;
    v_referral RECORD;
    v_customer RECORD;
BEGIN
    -- Only proceed if status is confirming/confirmed/delivered
    IF NEW.status NOT IN ('confirmado', 'enviado', 'entregue') THEN
        RETURN NEW;
    END IF;

    -- Find the customer record for this order
    SELECT * INTO v_customer 
    FROM public.customers 
    WHERE email = NEW.customer_email AND store_user_id = NEW.user_id
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN NEW;
    END IF;

    -- Find any pending referral where this customer was the referred party
    SELECT * INTO v_referral 
    FROM public.customer_referrals 
    WHERE referred_id = v_customer.id AND status = 'pending' AND store_user_id = NEW.user_id
    LIMIT 1;

    IF FOUND THEN
        -- Get loyalty config
        SELECT * INTO v_loyalty_config 
        FROM public.loyalty_config 
        WHERE store_user_id = NEW.user_id
        LIMIT 1;

        -- Update referral status
        UPDATE public.customer_referrals 
        SET status = 'completed', 
            completed_at = now(),
            order_id = NEW.id
        WHERE id = v_referral.id;

        -- If loyalty program is enabled and reward type is points, add points to the referrer
        IF v_loyalty_config.referral_enabled AND v_loyalty_config.referral_reward_type = 'points' THEN
            -- Update or insert loyalty points for the referrer
            INSERT INTO public.loyalty_points (customer_id, store_user_id, points_balance, lifetime_points)
            VALUES (v_referral.referrer_id, v_referral.store_user_id, v_loyalty_config.referral_reward_points, v_loyalty_config.referral_reward_points)
            ON CONFLICT (customer_id, store_user_id) DO UPDATE SET 
                points_balance = loyalty_points.points_balance + EXCLUDED.points_balance,
                lifetime_points = loyalty_points.lifetime_points + EXCLUDED.lifetime_points,
                updated_at = now();

            -- Log transaction
            INSERT INTO public.loyalty_transactions (customer_id, store_user_id, type, amount, description)
            VALUES (v_referral.referrer_id, v_referral.store_user_id, 'earn', v_loyalty_config.referral_reward_points, 'Recompensa por indicação');
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop if exists and create trigger
DROP TRIGGER IF EXISTS tr_order_referral_completion ON public.orders;
CREATE TRIGGER tr_order_referral_completion
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.handle_referral_completion();