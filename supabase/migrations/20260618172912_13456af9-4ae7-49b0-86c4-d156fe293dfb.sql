
-- 1. Gateway credentials table (service_role only)
CREATE TABLE IF NOT EXISTS public.store_gateway_credentials (
  user_id uuid PRIMARY KEY,
  gateway_secret_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.store_gateway_credentials FROM anon, authenticated;
GRANT ALL ON public.store_gateway_credentials TO service_role;
ALTER TABLE public.store_gateway_credentials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role manages gateway credentials" ON public.store_gateway_credentials;
CREATE POLICY "service_role manages gateway credentials"
ON public.store_gateway_credentials FOR ALL TO service_role
USING (true) WITH CHECK (true);

INSERT INTO public.store_gateway_credentials (user_id, gateway_secret_key)
SELECT user_id, gateway_secret_key
FROM public.store_settings
WHERE gateway_secret_key IS NOT NULL AND gateway_secret_key <> ''
ON CONFLICT (user_id) DO UPDATE SET gateway_secret_key = EXCLUDED.gateway_secret_key, updated_at = now();

ALTER TABLE public.store_settings DROP COLUMN IF EXISTS gateway_secret_key;

CREATE OR REPLACE FUNCTION public.set_my_gateway_secret_key(p_key text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  INSERT INTO public.store_gateway_credentials (user_id, gateway_secret_key, updated_at)
  VALUES (v_uid, NULLIF(p_key, ''), now())
  ON CONFLICT (user_id) DO UPDATE SET gateway_secret_key = EXCLUDED.gateway_secret_key, updated_at = now();
END;
$$;
REVOKE ALL ON FUNCTION public.set_my_gateway_secret_key(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_my_gateway_secret_key(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_gateway_secret_key()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_key text;
BEGIN
  IF v_uid IS NULL THEN RETURN NULL; END IF;
  SELECT gateway_secret_key INTO v_key FROM public.store_gateway_credentials WHERE user_id = v_uid;
  RETURN v_key;
END;
$$;
REVOKE ALL ON FUNCTION public.get_my_gateway_secret_key() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_gateway_secret_key() TO authenticated;

-- 2. Public store config tightening
DROP POLICY IF EXISTS "Anon can view product page config" ON public.store_product_page_config;
DROP POLICY IF EXISTS "Anon can view theme config" ON public.store_theme_config;
REVOKE SELECT ON public.store_product_page_config FROM anon;
REVOKE SELECT ON public.store_theme_config FROM anon;

CREATE OR REPLACE FUNCTION public.get_public_product_page_config(p_user_id uuid)
RETURNS SETOF public.store_product_page_config
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.store_product_page_config WHERE user_id = p_user_id LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_public_product_page_config(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_product_page_config(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_public_theme_config(p_user_id uuid)
RETURNS SETOF public.store_theme_config
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.store_theme_config WHERE user_id = p_user_id ORDER BY updated_at DESC LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_public_theme_config(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_theme_config(uuid) TO anon, authenticated;

-- 3. Product reviews INSERT tightening + dedupe
DELETE FROM public.product_reviews a
USING public.product_reviews b
WHERE a.product_id = b.product_id
  AND lower(a.customer_email) = lower(b.customer_email)
  AND a.created_at < b.created_at;

DROP POLICY IF EXISTS "Anyone can create reviews" ON public.product_reviews;
CREATE POLICY "Anyone can create reviews on published products"
ON public.product_reviews FOR INSERT TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_reviews.product_id AND p.published = true
  )
  AND customer_email IS NOT NULL
  AND length(customer_email) BETWEEN 5 AND 255
  AND customer_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  AND (auth.uid() IS NULL OR lower(customer_email) = lower(coalesce((auth.jwt() ->> 'email')::text, customer_email)))
);

CREATE UNIQUE INDEX IF NOT EXISTS product_reviews_unique_email_per_product
  ON public.product_reviews (product_id, lower(customer_email));
