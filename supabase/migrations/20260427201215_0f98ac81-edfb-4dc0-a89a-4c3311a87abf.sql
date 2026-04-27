-- Update views to use security_invoker
ALTER VIEW public.store_settings_safe SET (security_invoker = true);
ALTER VIEW public.store_domains_public SET (security_invoker = true);
ALTER VIEW public.store_marketing_config_public SET (security_invoker = true);
ALTER VIEW public.store_settings_public SET (security_invoker = true);
ALTER VIEW public.product_reviews_public SET (security_invoker = true);
