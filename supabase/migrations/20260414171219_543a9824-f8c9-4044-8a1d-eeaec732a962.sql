-- Add INSERT policy for authenticated users (referrals are created during signup)
CREATE POLICY "Authenticated users can insert referrals"
ON public.customer_referrals
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow referred customers to also see their referral
CREATE POLICY "Referred customers can view their referral"
ON public.customer_referrals
FOR SELECT
TO authenticated
USING (referred_id IN (
  SELECT id FROM customers WHERE auth_user_id = auth.uid()
));