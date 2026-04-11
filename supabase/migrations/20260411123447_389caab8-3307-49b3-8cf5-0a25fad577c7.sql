-- 1. Fix: Drop overly permissive anon SELECT on saved_customer_data
DROP POLICY IF EXISTS "scd_anon_read" ON public.saved_customer_data;

-- 2. Fix: Drop overly permissive anon SELECT on stock_notify_subscriptions
DROP POLICY IF EXISTS "Anyone can check own subscription" ON public.stock_notify_subscriptions;

-- 3. Fix: Restrict referral_discounts INSERT
DROP POLICY IF EXISTS "System can insert discounts" ON public.referral_discounts;
CREATE POLICY "System can insert discounts" ON public.referral_discounts
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = auth.uid()
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );

-- 4. Fix: Restrict referrals INSERT
DROP POLICY IF EXISTS "System can insert referrals" ON public.referrals;
CREATE POLICY "System can insert referrals" ON public.referrals
  FOR INSERT TO authenticated
  WITH CHECK (
    referrer_tenant_id = auth.uid()
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );

-- 5. Fix: Remove store_settings from Realtime publication (contains gateway_secret_key)
ALTER PUBLICATION supabase_realtime DROP TABLE public.store_settings;

-- 6. Fix: Restrict stock_notify_subscriptions INSERT
DROP POLICY IF EXISTS "Anyone can subscribe for stock alerts" ON public.stock_notify_subscriptions;
CREATE POLICY "Anyone can subscribe for stock alerts" ON public.stock_notify_subscriptions
  FOR INSERT TO public
  WITH CHECK (
    email IS NOT NULL AND length(trim(email)) > 5
  );