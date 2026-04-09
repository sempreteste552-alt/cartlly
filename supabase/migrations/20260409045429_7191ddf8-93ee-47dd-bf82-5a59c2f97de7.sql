-- Enable RLS for payments
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Allow customers to view their own payments
-- A payment belongs to a customer if the associated order belongs to that customer (identified by email)
CREATE POLICY "Customers can view their own payments"
ON public.payments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.orders
    WHERE public.orders.id = public.payments.order_id
    AND public.orders.customer_email = (auth.jwt() ->> 'email'::text)
  )
);

-- Ensure orders status history table exists (already exists based on earlier tools)
-- Ensure order_status_history is also readable by customers
CREATE POLICY "Customers can view their own order status history"
ON public.order_status_history
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.orders
    WHERE public.orders.id = public.order_status_history.order_id
    AND public.orders.customer_email = (auth.jwt() ->> 'email'::text)
  )
);
