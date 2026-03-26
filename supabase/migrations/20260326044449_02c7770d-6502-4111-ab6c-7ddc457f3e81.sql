-- Allow super admins to view all payments
CREATE POLICY "Super admins can view all payments"
ON public.payments FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));
