DROP POLICY IF EXISTS "Users can create their own orders" ON public.orders;

CREATE POLICY "Authenticated users can create orders"
ON public.orders
FOR INSERT
TO authenticated
WITH CHECK (true);