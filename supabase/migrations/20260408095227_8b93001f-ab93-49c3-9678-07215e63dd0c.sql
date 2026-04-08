CREATE OR REPLACE FUNCTION public.trigger_push_on_new_coupon()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  -- Only trigger for active coupons
  IF NEW.active = true THEN
    PERFORM net.http_post(
      url := 'https://dxdpdwwwhhwbbcybyshd.supabase.co/functions/v1/recover-abandoned-carts',
      body := jsonb_build_object(
        'trigger_type', 'new_coupon',
        'store_user_id', NEW.user_id,
        'coupon_code', NEW.code,
        'discount_type', NEW.discount_type,
        'discount_value', NEW.discount_value
      ),
      headers := '{"Content-Type": "application/json"}'::jsonb
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_new_coupon_push
AFTER INSERT ON public.coupons
FOR EACH ROW
EXECUTE FUNCTION public.trigger_push_on_new_coupon();