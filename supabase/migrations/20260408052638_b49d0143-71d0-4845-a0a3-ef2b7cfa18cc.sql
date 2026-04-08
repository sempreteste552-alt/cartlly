CREATE OR REPLACE FUNCTION public.get_best_selling_products(_store_user_id uuid, _limit int DEFAULT 10)
RETURNS TABLE(product_id uuid, total_sold bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT oi.product_id, SUM(oi.quantity)::bigint AS total_sold
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  WHERE o.user_id = _store_user_id
    AND oi.product_id IS NOT NULL
    AND o.status NOT IN ('cancelado')
  GROUP BY oi.product_id
  ORDER BY total_sold DESC
  LIMIT _limit;
$$;