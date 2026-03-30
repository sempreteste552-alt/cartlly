
-- 1. Remove the overly permissive anon SELECT on store_settings (gateway_secret_key exposed)
DROP POLICY IF EXISTS "Anon can view store settings public fields" ON public.store_settings;

-- 2. Tighten orders anon SELECT to require tracking_token
DROP POLICY IF EXISTS "Anon can view single order by id" ON public.orders;
CREATE POLICY "Anon can view order by tracking token"
  ON public.orders FOR SELECT TO anon
  USING (tracking_token IS NOT NULL AND tracking_token = current_setting('request.header.x-tracking-token', true));

-- 3. Tighten order_items anon SELECT to join on orders tracking
DROP POLICY IF EXISTS "Anon can view order items by order id" ON public.order_items;

-- 4. Tighten order_status_history anon SELECT and remove anon INSERT
DROP POLICY IF EXISTS "Anon can view order status history" ON public.order_status_history;
DROP POLICY IF EXISTS "Anyone can create status history" ON public.order_status_history;

-- 5. Remove tenant_subscriptions user UPDATE policy (privilege escalation)
DROP POLICY IF EXISTS "Users can update own subscription" ON public.tenant_subscriptions;
DROP POLICY IF EXISTS "Tenants can update own subscription" ON public.tenant_subscriptions;
-- Find and drop any UPDATE policy for authenticated on tenant_subscriptions
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies 
    WHERE tablename = 'tenant_subscriptions' 
      AND schemaname = 'public'
      AND cmd = 'UPDATE'
      AND roles @> ARRAY['authenticated']::name[]
      AND NOT (qual LIKE '%super_admin%' OR with_check LIKE '%super_admin%')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.tenant_subscriptions', pol.policyname);
  END LOOP;
END;
$$;

-- 6. Restrict coupons anon SELECT - remove cross-tenant exposure
DROP POLICY IF EXISTS "Anyone can view active coupons" ON public.coupons;

-- 7. Fix product_reviews - create view without customer_email for public access
CREATE OR REPLACE VIEW public.product_reviews_public AS
  SELECT id, product_id, rating, comment, customer_name, created_at
  FROM public.product_reviews;

-- 8. Fix push_logs INSERT policy
DROP POLICY IF EXISTS "Service insert push logs" ON public.push_logs;
CREATE POLICY "Users can insert own push logs"
  ON public.push_logs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 9. Fix storage policies for product-images bucket - enforce path ownership
DROP POLICY IF EXISTS "Authenticated users can upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete product images" ON storage.objects;

CREATE POLICY "Users can upload own product images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can update own product images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'product-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own product images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'product-images' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Fix storage policies for store-assets bucket
DROP POLICY IF EXISTS "Authenticated users can upload store assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update store assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete store assets" ON storage.objects;

CREATE POLICY "Users can upload own store assets"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'store-assets' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can update own store assets"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'store-assets' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own store assets"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'store-assets' AND (storage.foldername(name))[1] = auth.uid()::text);
