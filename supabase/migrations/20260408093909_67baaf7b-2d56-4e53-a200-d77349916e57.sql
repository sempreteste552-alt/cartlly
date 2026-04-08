
-- Add discount columns to automation_rules
ALTER TABLE public.automation_rules 
  ADD COLUMN IF NOT EXISTS offer_discount boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS discount_code text,
  ADD COLUMN IF NOT EXISTS discount_percentage numeric DEFAULT 0;

-- Create trigger function for new product push
CREATE OR REPLACE FUNCTION public.trigger_push_on_new_product()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://dxdpdwwwhhwbbcybyshd.supabase.co/functions/v1/recover-abandoned-carts',
    body := jsonb_build_object(
      'trigger_type', 'new_product',
      'store_user_id', NEW.user_id,
      'product_id', NEW.id,
      'product_name', NEW.name,
      'product_price', NEW.price,
      'product_image', COALESCE(NEW.image_url, '')
    ),
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
  RETURN NEW;
END;
$$;

-- Create trigger on products table for INSERT
CREATE TRIGGER trigger_new_product_push
AFTER INSERT ON public.products
FOR EACH ROW
WHEN (NEW.published = true)
EXECUTE FUNCTION public.trigger_push_on_new_product();
