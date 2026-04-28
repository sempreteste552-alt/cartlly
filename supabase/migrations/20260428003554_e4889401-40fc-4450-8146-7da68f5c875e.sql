-- Make public storefront views accessible to anonymous visitors
ALTER VIEW public.store_settings_public SET (security_invoker = false);
ALTER VIEW public.store_domains_public SET (security_invoker = false);

GRANT SELECT ON public.store_settings_public TO anon, authenticated;
GRANT SELECT ON public.store_domains_public TO anon, authenticated;