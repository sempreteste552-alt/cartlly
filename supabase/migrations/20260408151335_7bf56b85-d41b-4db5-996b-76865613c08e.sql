DROP POLICY IF EXISTS "Anon can create initial order status history" ON public.order_status_history;
DROP POLICY IF EXISTS "Auth can create initial order status history" ON public.order_status_history;

CREATE POLICY "Anon can create initial order status history"
ON public.order_status_history
FOR INSERT
TO anon
WITH CHECK (
  status = 'pendente'
  AND EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.id = order_status_history.order_id
  )
);

CREATE POLICY "Auth can create initial order status history"
ON public.order_status_history
FOR INSERT
TO authenticated
WITH CHECK (
  status = 'pendente'
  AND EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.id = order_status_history.order_id
  )
);