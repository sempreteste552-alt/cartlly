CREATE POLICY "Public can read store settings"
ON public.store_settings
FOR SELECT
TO anon
USING (true);