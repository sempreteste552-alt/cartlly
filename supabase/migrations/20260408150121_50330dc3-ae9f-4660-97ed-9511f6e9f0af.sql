CREATE OR REPLACE FUNCTION public.store_exists(_store_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.store_settings
    WHERE user_id = _store_user_id
  );
$$;

DROP POLICY IF EXISTS "Anon can create orders for existing stores" ON public.orders;
DROP POLICY IF EXISTS "Auth can create orders for existing stores" ON public.orders;

CREATE POLICY "Anon can create orders for valid stores"
ON public.orders
FOR INSERT
TO anon
WITH CHECK (
  user_id IS NOT NULL
  AND public.store_exists(user_id)
);

CREATE POLICY "Auth can create orders for valid stores"
ON public.orders
FOR INSERT
TO authenticated
WITH CHECK (
  user_id IS NOT NULL
  AND public.store_exists(user_id)
);