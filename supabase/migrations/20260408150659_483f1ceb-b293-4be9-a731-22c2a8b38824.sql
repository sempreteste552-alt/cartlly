DROP POLICY IF EXISTS "Anon can create orders for valid owners" ON public.orders;
DROP POLICY IF EXISTS "Auth can create orders for valid owners" ON public.orders;
DROP POLICY IF EXISTS "Anon can create orders for existing stores" ON public.orders;
DROP POLICY IF EXISTS "Auth can create orders for existing stores" ON public.orders;
DROP POLICY IF EXISTS "Allow authenticated users to create their orders" ON public.orders;

CREATE POLICY "Anon can create orders with store id"
ON public.orders
FOR INSERT
TO anon
WITH CHECK (user_id IS NOT NULL);

CREATE POLICY "Auth can create orders with store id"
ON public.orders
FOR INSERT
TO authenticated
WITH CHECK (user_id IS NOT NULL);