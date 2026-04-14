CREATE OR REPLACE FUNCTION public.handle_referral_reward()
RETURNS TRIGGER AS $$
DECLARE
  v_referral RECORD;
  v_config RECORD;
  v_customer_id UUID;
BEGIN
  -- If order is completed/delivered
  IF (NEW.status IN ('entregue', 'concluido') AND (OLD.status IS NULL OR OLD.status NOT IN ('entregue', 'concluido'))) THEN
    
    -- Find customer ID from email and store
    SELECT id INTO v_customer_id FROM public.customers WHERE email = NEW.customer_email AND store_user_id = NEW.user_id LIMIT 1;

    IF v_customer_id IS NOT NULL THEN
      -- Check if this customer was referred and referral is still pending
      SELECT * INTO v_referral FROM public.customer_referrals 
      WHERE referred_id = v_customer_id
      AND status = 'pending'
      LIMIT 1;

      IF v_referral.id IS NOT NULL THEN
        -- Get store loyalty config
        SELECT * INTO v_config FROM public.loyalty_config WHERE store_user_id = NEW.user_id;

        IF v_config.referral_enabled THEN
          -- Mark referral as completed
          UPDATE public.customer_referrals 
          SET status = 'completed', 
              order_id = NEW.id, 
              reward_type = v_config.referral_reward_type,
              reward_value = CASE WHEN v_config.referral_reward_type = 'points' THEN v_config.referral_reward_points ELSE NULL END,
              reward_description = v_config.referral_reward_description,
              completed_at = now()
          WHERE id = v_referral.id;

          -- If reward is points, award them to the referrer
          IF v_config.referral_reward_type = 'points' AND v_config.referral_reward_points > 0 THEN
            -- Check if loyalty_points record exists for referrer
            INSERT INTO public.loyalty_points (store_user_id, customer_id, points_balance, lifetime_points)
            VALUES (NEW.user_id, v_referral.referrer_id, v_config.referral_reward_points, v_config.referral_reward_points)
            ON CONFLICT (store_user_id, customer_id) DO UPDATE SET
              points_balance = loyalty_points.points_balance + EXCLUDED.points_balance,
              lifetime_points = loyalty_points.lifetime_points + EXCLUDED.lifetime_points,
              updated_at = now();

            -- Log transaction
            INSERT INTO public.loyalty_transactions (store_user_id, customer_id, type, points, description)
            VALUES (NEW.user_id, v_referral.referrer_id, 'earn', v_config.referral_reward_points, 'Bônus por indicação de amigo');
          END IF;

          -- Send notification to admin
          INSERT INTO public.admin_notifications (sender_user_id, target_user_id, title, message, type)
          VALUES (NEW.user_id, NEW.user_id, '🎊 Recompensa por Indicação', 'Um cliente ganhou uma recompensa por indicar um amigo!', 'referral_reward');
        END IF;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_handle_referral_reward ON public.orders;
CREATE TRIGGER trigger_handle_referral_reward
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.handle_referral_reward();
