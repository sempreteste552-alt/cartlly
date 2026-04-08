
-- Add unique constraint on session_id for upsert
ALTER TABLE public.abandoned_carts ADD CONSTRAINT abandoned_carts_session_id_key UNIQUE (session_id);

-- Allow customers to INSERT their own abandoned carts
CREATE POLICY "Customers can create abandoned carts"
ON public.abandoned_carts
FOR INSERT
TO authenticated
WITH CHECK (
  customer_id IN (
    SELECT c.id FROM public.customers c WHERE c.auth_user_id = auth.uid()
  )
);

-- Allow customers to UPDATE their own abandoned carts
CREATE POLICY "Customers can update own abandoned carts"
ON public.abandoned_carts
FOR UPDATE
TO authenticated
USING (
  customer_id IN (
    SELECT c.id FROM public.customers c WHERE c.auth_user_id = auth.uid()
  )
)
WITH CHECK (
  customer_id IN (
    SELECT c.id FROM public.customers c WHERE c.auth_user_id = auth.uid()
  )
);
