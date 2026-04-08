DROP POLICY IF EXISTS "Anon can create orders with store id" ON public.orders;
DROP POLICY IF EXISTS "Auth can create orders with store id" ON public.orders;
DROP FUNCTION IF EXISTS public.store_accepts_orders(uuid);

CREATE OR REPLACE FUNCTION public.store_accepts_orders(_store_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = _store_user_id
      AND p.status IN ('active', 'approved', 'pending')
  );
$$;

CREATE POLICY "Anon can create orders for public stores"
ON public.orders
FOR INSERT
TO anon
WITH CHECK (
  user_id IS NOT NULL
  AND public.store_accepts_orders(user_id)
);

CREATE POLICY "Auth can create orders for public stores"
ON public.orders
FOR INSERT
TO authenticated
WITH CHECK (
  user_id IS NOT NULL
  AND public.store_accepts_orders(user_id)
);