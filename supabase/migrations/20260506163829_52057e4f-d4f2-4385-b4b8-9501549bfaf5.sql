
INSERT INTO public.store_domains (store_id, hostname, is_primary, status, dns_status, txt_status, ssl_status, is_published, last_verified_at, ssl_issued_at)
VALUES
  ('63d6d981-9fdd-4fdf-aaaa-636d971ce4bf', 'strets.store', true, 'active', 'verified', 'verified', 'active', true, now(), now()),
  ('63d6d981-9fdd-4fdf-aaaa-636d971ce4bf', 'www.strets.store', false, 'active', 'verified', 'verified', 'active', true, now(), now())
ON CONFLICT (hostname) DO UPDATE SET store_id = EXCLUDED.store_id, status = EXCLUDED.status, ssl_status = EXCLUDED.ssl_status, is_published = true, last_verified_at = now();
