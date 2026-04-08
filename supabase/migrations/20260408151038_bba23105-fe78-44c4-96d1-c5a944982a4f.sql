DROP POLICY IF EXISTS "Anon can create orders for public stores" ON public.orders;
DROP POLICY IF EXISTS "Auth can create orders for public stores" ON public.orders;
DROP FUNCTION IF EXISTS public.store_accepts_orders(uuid);

CREATE POLICY "Anon can create orders with tenant id"
ON public.orders
FOR INSERT
TO anon
WITH CHECK (user_id IS NOT NULL);

CREATE POLICY "Auth can create orders with tenant id"
ON public.orders
FOR INSERT
TO authenticated
WITH CHECK (user_id IS NOT NULL);