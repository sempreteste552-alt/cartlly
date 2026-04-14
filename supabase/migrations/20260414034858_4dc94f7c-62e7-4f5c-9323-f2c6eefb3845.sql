-- Add referral_code to customers
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS referral_code TEXT;

-- Create an index for faster lookups
CREATE INDEX IF NOT EXISTS idx_customers_referral_code ON public.customers(referral_code);

-- Generate referral codes for existing customers that don't have one
UPDATE public.customers 
SET referral_code = upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8))
WHERE referral_code IS NULL;
