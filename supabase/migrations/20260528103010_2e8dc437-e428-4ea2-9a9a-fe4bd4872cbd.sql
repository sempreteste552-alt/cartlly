-- 1. push_subscriptions: remove anon SELECT
DROP POLICY IF EXISTS "Allow anonymous select by endpoint" ON public.push_subscriptions;

-- 2. store_domains: remove fully-public SELECT (storefront uses store_domains_public view)
DROP POLICY IF EXISTS "Public can read domains for storefront resolution" ON public.store_domains;

-- Ensure owners can still read their own rows from the base table
DROP POLICY IF EXISTS "Store owners can read their domains" ON public.store_domains;
CREATE POLICY "Store owners can read their domains"
ON public.store_domains
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.store_settings
    WHERE store_settings.id = store_domains.store_id
      AND store_settings.user_id = auth.uid()
  )
  OR has_role(auth.uid(), 'super_admin'::app_role)
);

-- 3. customer_view_stats: drop unscoped UPDATE policy (scoped policy "Users can update view stats" remains)
DROP POLICY IF EXISTS "Admins can update view stats" ON public.customer_view_stats;

-- 4. search_logs: enforce user_id = auth.uid() on insert
DROP POLICY IF EXISTS "Anyone can insert search logs" ON public.search_logs;
CREATE POLICY "Authenticated users can insert their own search logs"
ON public.search_logs
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- 5. store_settings: revoke direct SELECT access on the payment gateway secret key
REVOKE SELECT (gateway_secret_key) ON public.store_settings FROM anon, authenticated;
GRANT SELECT (gateway_secret_key) ON public.store_settings TO service_role;

-- Secure RPC for the store owner (and super admins) to load their own gateway secret
CREATE OR REPLACE FUNCTION public.get_my_gateway_secret_key()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT gateway_secret_key
  FROM public.store_settings
  WHERE user_id = auth.uid()
     OR has_role(auth.uid(), 'super_admin'::app_role)
  ORDER BY (user_id = auth.uid()) DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_my_gateway_secret_key() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_gateway_secret_key() TO authenticated, service_role;