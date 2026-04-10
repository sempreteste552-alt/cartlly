DROP POLICY IF EXISTS "Public can read store settings" ON public.store_settings;
DROP POLICY IF EXISTS "Anyone can read platform settings" ON public.platform_settings;

CREATE POLICY "Authenticated users can read platform settings"
ON public.platform_settings
FOR SELECT
TO authenticated
USING (true);

CREATE OR REPLACE VIEW public.platform_banner_config_public
WITH (security_invoker=off) AS
SELECT key, value
FROM public.platform_settings
WHERE key IN ('promo_banner_enabled', 'promo_banner_text', 'promo_banner_link');

CREATE OR REPLACE VIEW public.storefront_banner_status
WITH (security_invoker=off) AS
SELECT
  ss.user_id,
  ss.promo_banner_enabled,
  COALESCE((
    SELECT UPPER(tp.name) IN ('PREMIUM', 'ELITE')
    FROM public.tenant_subscriptions ts
    LEFT JOIN public.tenant_plans tp ON tp.id = ts.plan_id
    WHERE ts.user_id = ss.user_id
      AND ts.status IN ('active', 'trial')
    ORDER BY ts.updated_at DESC
    LIMIT 1
  ), false) AS is_premium
FROM public.store_settings ss;

GRANT SELECT ON public.platform_banner_config_public TO anon, authenticated;
GRANT SELECT ON public.storefront_banner_status TO anon, authenticated;