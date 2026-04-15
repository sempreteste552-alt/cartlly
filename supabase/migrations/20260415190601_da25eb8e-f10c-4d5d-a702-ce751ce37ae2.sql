-- Allow customers to find referrers by code
DROP POLICY IF EXISTS "Anyone can find a customer by referral code" ON public.customers;
CREATE POLICY "Anyone can find a customer by referral code" 
ON public.customers 
FOR SELECT 
USING (true); -- This is needed to find the referrer record during signup

-- Allow Super Admin to view all customer referrals
DROP POLICY IF EXISTS "Super admins can view all customer referrals" ON public.customer_referrals;
CREATE POLICY "Super admins can view all customer referrals" 
ON public.customer_referrals 
FOR SELECT 
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Allow referred users to view their own referral record (platform referrals)
DROP POLICY IF EXISTS "Referred users can view their own referral" ON public.referrals;
CREATE POLICY "Referred users can view their own referral" 
ON public.referrals 
FOR SELECT 
TO authenticated
USING (auth.uid() = referred_user_id);
