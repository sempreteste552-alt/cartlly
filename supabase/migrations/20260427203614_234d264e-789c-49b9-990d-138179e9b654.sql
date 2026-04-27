UPDATE public.store_domains
SET status = 'active',
    ssl_status = 'active',
    dns_status = 'verified',
    txt_status = 'verified',
    is_published = true,
    last_verified_at = now(),
    activated_at = now(),
    ssl_issued_at = now()
WHERE hostname IN ('strets.store', 'www.strets.store');

UPDATE public.store_settings
SET domain_status = 'verified'
WHERE custom_domain = 'strets.store';