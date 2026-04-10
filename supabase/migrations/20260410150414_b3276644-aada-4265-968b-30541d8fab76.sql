
-- Fix saved_customer_data - remove overly permissive policy
DROP POLICY IF EXISTS "scd_public_all" ON public.saved_customer_data;
CREATE POLICY "scd_tenant_all" ON public.saved_customer_data FOR ALL USING (auth.uid() = store_user_id) WITH CHECK (auth.uid() = store_user_id);
CREATE POLICY "scd_anon_read" ON public.saved_customer_data FOR SELECT USING (true);

-- Fix loyalty_transactions - remove overly permissive insert 
DROP POLICY IF EXISTS "lt_public_read" ON public.loyalty_transactions;

-- Fix loyalty_points - tighten insert/update
DROP POLICY IF EXISTS "lp_public_read" ON public.loyalty_points;
