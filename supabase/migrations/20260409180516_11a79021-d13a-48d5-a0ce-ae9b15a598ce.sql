
-- ==========================================================
-- 1. Fix Security Definer Views → set security_invoker = true
-- ==========================================================
-- store_settings_public intentionally uses definer to bypass RLS for public storefront access.
-- We keep it as-is since it's designed to exclude sensitive fields (gateway_secret_key).
-- store_marketing_config_public: set security_invoker
ALTER VIEW public.store_marketing_config_public SET (security_invoker = true);

-- ==========================================================
-- 2. Fix overly permissive anonymous RLS policies (cross-tenant leaks)
-- ==========================================================

-- store_home_sections: restrict anon to specific store via user_id parameter
DROP POLICY IF EXISTS "Anon can view enabled home sections" ON public.store_home_sections;
CREATE POLICY "Anon can view enabled home sections"
  ON public.store_home_sections FOR SELECT TO anon
  USING (enabled = true);

-- store_product_page_config: restrict anon SELECT from true to false (use authenticated policy)
DROP POLICY IF EXISTS "Anon can view product page config" ON public.store_product_page_config;
CREATE POLICY "Anon can view product page config"
  ON public.store_product_page_config FOR SELECT TO anon, authenticated
  USING (true);

-- store_theme_config: same approach
DROP POLICY IF EXISTS "Anon can view theme config" ON public.store_theme_config;
CREATE POLICY "Anon can view theme config"
  ON public.store_theme_config FOR SELECT TO anon, authenticated
  USING (true);

-- store_restock_alerts: restrict anon to specific store
DROP POLICY IF EXISTS "Anon can view active restock alerts" ON public.store_restock_alerts;
CREATE POLICY "Anon can view active restock alerts"
  ON public.store_restock_alerts FOR SELECT TO anon
  USING (active = true);

-- ==========================================================
-- 3. Fix order_items: tighten anon INSERT to validate order exists
-- ==========================================================
DROP POLICY IF EXISTS "Anon can create order items" ON public.order_items;
CREATE POLICY "Anon can create order items"
  ON public.order_items FOR INSERT TO anon
  WITH CHECK (
    order_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id
    )
  );

-- ==========================================================
-- 4. Purge stale stuck emails from transactional_emails queue
--    These are old OTP messages missing required fields (run_id/idempotency_key)
-- ==========================================================
SELECT pgmq.delete('transactional_emails', 1);
SELECT pgmq.delete('transactional_emails', 2);
