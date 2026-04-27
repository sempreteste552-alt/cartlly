CREATE POLICY "Public can read domains for storefront resolution"
ON public.store_domains
FOR SELECT
TO anon, authenticated
USING (true);