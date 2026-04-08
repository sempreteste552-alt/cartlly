-- Drop the existing overly simple auth insert policy
DROP POLICY IF EXISTS "Auth can create orders" ON public.orders;

-- Create a better policy that allows any authenticated user to insert orders for existing stores
CREATE POLICY "Auth can create orders for existing stores"
ON public.orders
FOR INSERT
TO authenticated
WITH CHECK (
  user_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.store_settings ss WHERE ss.user_id = orders.user_id
  )
);