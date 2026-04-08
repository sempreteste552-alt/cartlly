DROP POLICY IF EXISTS "Anon can create orders for valid stores" ON public.orders;
DROP POLICY IF EXISTS "Auth can create orders for valid stores" ON public.orders;
DROP FUNCTION IF EXISTS public.store_exists(uuid);

CREATE POLICY "Anon can create orders for valid owners"
ON public.orders
FOR INSERT
TO anon
WITH CHECK (
  user_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = orders.user_id
  )
);

CREATE POLICY "Auth can create orders for valid owners"
ON public.orders
FOR INSERT
TO authenticated
WITH CHECK (
  user_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = orders.user_id
  )
);