CREATE OR REPLACE VIEW public.storefront_banner_status
WITH (security_invoker=on) AS
SELECT
  ss.user_id,
  ss.promo_banner_enabled,
  COALESCE(UPPER(tp.name) IN ('PREMIUM', 'ELITE'), false) AS is_premium
FROM public.store_settings ss
LEFT JOIN LATERAL (
  SELECT ts.plan_id
  FROM public.tenant_subscriptions ts
  WHERE ts.user_id = ss.user_id
    AND ts.status IN ('active', 'trial')
  ORDER BY ts.updated_at DESC
  LIMIT 1
) latest_sub ON true
LEFT JOIN public.tenant_plans tp ON tp.id = latest_sub.plan_id;

GRANT SELECT ON public.storefront_banner_status TO anon, authenticated;