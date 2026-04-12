
-- Drop overly permissive public SELECT policies
DROP POLICY IF EXISTS "Public can read domains for resolution" ON public.store_domains;
DROP POLICY IF EXISTS "Public can read store domains for resolution" ON public.store_domains;

-- Create a safe public view for domain resolution (no tokens exposed)
CREATE OR REPLACE VIEW public.store_domains_public AS
SELECT 
  id,
  store_id,
  hostname,
  is_primary,
  status,
  is_published
FROM public.store_domains;

GRANT SELECT ON public.store_domains_public TO anon, authenticated;
