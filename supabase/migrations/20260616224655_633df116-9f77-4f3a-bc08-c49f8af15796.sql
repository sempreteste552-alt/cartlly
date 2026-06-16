
-- Add world cup mode toggle accessible to storefront (anon)
INSERT INTO public.platform_settings (key, value)
VALUES ('world_cup_mode_enabled', '{"value": false}'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE VIEW public.platform_banner_config_public
WITH (security_invoker=off) AS
SELECT key, value
FROM public.platform_settings
WHERE key IN ('promo_banner_enabled', 'promo_banner_text', 'promo_banner_link', 'world_cup_mode_enabled');

GRANT SELECT ON public.platform_banner_config_public TO anon, authenticated;
