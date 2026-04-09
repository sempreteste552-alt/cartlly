-- Update order_items INSERT policies to be more permissive during creation
DROP POLICY IF EXISTS "Auth can create order items" ON public.order_items;
CREATE POLICY "Auth can create order items" ON public.order_items
FOR INSERT TO authenticated
WITH CHECK (order_id IS NOT NULL);

DROP POLICY IF EXISTS "Anon can create order items" ON public.order_items;
CREATE POLICY "Anon can create order items" ON public.order_items
FOR INSERT TO anon
WITH CHECK (order_id IS NOT NULL);

-- Update order_status_history INSERT policies to be more permissive during creation
DROP POLICY IF EXISTS "Auth can create initial order status history" ON public.order_status_history;
CREATE POLICY "Auth can create initial order status history" ON public.order_status_history
FOR INSERT TO authenticated
WITH CHECK (status = 'pendente' AND order_id IS NOT NULL);

DROP POLICY IF EXISTS "Anon can create initial order status history" ON public.order_status_history;
CREATE POLICY "Anon can create initial order status history" ON public.order_status_history
FOR INSERT TO anon
WITH CHECK (status = 'pendente' AND order_id IS NOT NULL);

-- Optional: Allow customers to see their own orders if they are logged in with the same email
-- This helps them view their order status/tracking if they are authenticated
CREATE POLICY "Customers can view their own orders by email" ON public.orders
FOR SELECT TO authenticated
USING (customer_email = (auth.jwt() ->> 'email'));
