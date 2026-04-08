-- Add image_urls to product_reviews
ALTER TABLE public.product_reviews
  ADD COLUMN IF NOT EXISTS image_urls text[] NOT NULL DEFAULT '{}';

-- Recreate the public view to include image_urls
DROP VIEW IF EXISTS public.product_reviews_public;
CREATE VIEW public.product_reviews_public
  WITH (security_invoker = true)
AS
SELECT
  id,
  product_id,
  customer_name,
  rating,
  comment,
  image_urls,
  created_at
FROM public.product_reviews;

-- Grant access to the view
GRANT SELECT ON public.product_reviews_public TO anon, authenticated;