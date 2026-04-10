DROP VIEW IF EXISTS public.platform_banner_config_public;
DROP VIEW IF EXISTS public.storefront_banner_status;

DROP POLICY IF EXISTS "Authenticated users can read platform settings" ON public.platform_settings;

CREATE OR REPLACE FUNCTION public.get_platform_banner_config_public()
RETURNS TABLE(key text, value jsonb)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ps.key, ps.value::jsonb
  FROM public.platform_settings ps
  WHERE ps.key IN ('promo_banner_enabled', 'promo_banner_text', 'promo_banner_link');
$$;

CREATE OR REPLACE FUNCTION public.get_storefront_banner_status(_user_id uuid)
RETURNS TABLE(user_id uuid, promo_banner_enabled boolean, is_premium boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
  FROM public.store_settings ss
  WHERE ss.user_id = _user_id
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_platform_banner_config_public() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_storefront_banner_status(uuid) TO anon, authenticated;