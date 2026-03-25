-- Fix: coupons - authenticated users should only see their own coupons, not all
DROP POLICY IF EXISTS "Authenticated can view coupons" ON public.coupons;
CREATE POLICY "Authenticated can view own coupons"
  ON public.coupons FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Ensure super admin can also view all coupons for management
CREATE POLICY "Super admins can view all coupons"
  ON public.coupons FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));