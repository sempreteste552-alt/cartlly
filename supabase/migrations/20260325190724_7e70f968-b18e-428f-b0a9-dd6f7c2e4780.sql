
-- Wishlist table for customers to save favorite products
CREATE TABLE public.customer_wishlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  product_id uuid NOT NULL,
  store_user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (customer_id, product_id)
);

ALTER TABLE public.customer_wishlist ENABLE ROW LEVEL SECURITY;

-- Customers can manage their own wishlist
CREATE POLICY "Customers can view own wishlist" ON public.customer_wishlist
  FOR SELECT TO authenticated
  USING (customer_id IN (SELECT id FROM public.customers WHERE auth_user_id = auth.uid()));

CREATE POLICY "Customers can add to wishlist" ON public.customer_wishlist
  FOR INSERT TO authenticated
  WITH CHECK (customer_id IN (SELECT id FROM public.customers WHERE auth_user_id = auth.uid()));

CREATE POLICY "Customers can remove from wishlist" ON public.customer_wishlist
  FOR DELETE TO authenticated
  USING (customer_id IN (SELECT id FROM public.customers WHERE auth_user_id = auth.uid()));

-- Store owners can view their store's wishlist data
CREATE POLICY "Store owners can view wishlist" ON public.customer_wishlist
  FOR SELECT TO authenticated
  USING (store_user_id = auth.uid());
