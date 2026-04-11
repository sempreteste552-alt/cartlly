
-- Drop old view and recreate with verified flag
DROP VIEW IF EXISTS public.product_reviews_public;

CREATE VIEW public.product_reviews_public AS
SELECT 
  pr.id,
  pr.product_id,
  pr.customer_name,
  pr.rating,
  pr.comment,
  pr.image_urls,
  pr.created_at,
  CASE WHEN EXISTS (
    SELECT 1 FROM public.orders o
    JOIN public.order_items oi ON oi.order_id = o.id
    WHERE o.customer_email = pr.customer_email
    AND oi.product_id = pr.product_id
    AND o.status NOT IN ('cancelled', 'refunded')
    AND pr.customer_email IS NOT NULL
    AND pr.customer_email != ''
  ) THEN true ELSE false END AS is_verified_purchase
FROM public.product_reviews pr;
