CREATE OR REPLACE FUNCTION public.trigger_welcome_push_new_customer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  IF NEW.auth_user_id IS NOT NULL THEN
    PERFORM net.http_post(
      url := 'https://dxdpdwwwhhwbbcybyshd.supabase.co/functions/v1/recover-abandoned-carts',
      body := jsonb_build_object(
        'trigger_type', 'new_customer',
        'store_user_id', NEW.store_user_id
      ),
      headers := '{"Content-Type": "application/json"}'::jsonb
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_new_customer_welcome_push
  AFTER INSERT ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_welcome_push_new_customer();