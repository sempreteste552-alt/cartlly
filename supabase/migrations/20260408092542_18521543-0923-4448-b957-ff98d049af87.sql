
-- Fix: allow customer_email on review insert for both anon and auth
DROP POLICY IF EXISTS "Anon can create reviews" ON public.product_reviews;
DROP POLICY IF EXISTS "Auth can create reviews" ON public.product_reviews;

CREATE POLICY "Anyone can create reviews"
ON public.product_reviews
FOR INSERT
TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM products WHERE products.id = product_reviews.product_id AND products.published = true
  )
);

-- Trigger: after new review, call edge function to send AI push
CREATE OR REPLACE FUNCTION public.trigger_push_on_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  product_owner_id uuid;
BEGIN
  -- Get the store owner from the product
  SELECT user_id INTO product_owner_id FROM public.products WHERE id = NEW.product_id LIMIT 1;

  IF product_owner_id IS NOT NULL THEN
    -- Schedule a delayed push via pg_net (the edge function handles the AI message)
    PERFORM net.http_post(
      url := 'https://dxdpdwwwhhwbbcybyshd.supabase.co/functions/v1/recover-abandoned-carts',
      body := jsonb_build_object(
        'trigger_type', 'review_thankyou',
        'store_user_id', product_owner_id,
        'review_id', NEW.id,
        'product_id', NEW.product_id,
        'customer_name', NEW.customer_name,
        'rating', NEW.rating,
        'comment', COALESCE(NEW.comment, '')
      ),
      headers := '{"Content-Type": "application/json"}'::jsonb
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_new_review_push
  AFTER INSERT ON public.product_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_push_on_review();
