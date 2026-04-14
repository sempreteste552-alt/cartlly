-- Add referral_code to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS referral_code TEXT;

-- Add referred_by_code to customers
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS referred_by_code TEXT;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_referral_code ON public.orders(referral_code);
CREATE INDEX IF NOT EXISTS idx_customers_referred_by_code ON public.customers(referred_by_code);

-- Backfill referred_by_code in customers from customer_referrals
UPDATE public.customers c
SET referred_by_code = (
    SELECT r.referral_code 
    FROM public.customer_referrals cr
    JOIN public.customers r ON cr.referrer_id = r.id
    WHERE cr.referred_id = c.id
    LIMIT 1
)
WHERE referred_by_code IS NULL;

-- Backfill referral_code in orders from customer_referrals (using the referred customer)
UPDATE public.orders o
SET referral_code = (
    SELECT r.referral_code 
    FROM public.customers c
    JOIN public.customer_referrals cr ON c.id = cr.referred_id
    JOIN public.customers r ON cr.referrer_id = r.id
    WHERE c.email = o.customer_email AND c.store_user_id = o.user_id
    LIMIT 1
)
WHERE referral_code IS NULL;
