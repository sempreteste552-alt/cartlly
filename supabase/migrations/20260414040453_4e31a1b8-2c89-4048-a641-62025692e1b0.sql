-- Enhance loyalty_config with more reward types
ALTER TABLE public.loyalty_config
ADD COLUMN IF NOT EXISTS referral_reward_type TEXT DEFAULT 'points',
ADD COLUMN IF NOT EXISTS referral_reward_description TEXT;

-- Create table for customer referrals
CREATE TABLE IF NOT EXISTS public.customer_referrals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_user_id UUID NOT NULL REFERENCES auth.users(id),
  referrer_id UUID NOT NULL REFERENCES public.customers(id),
  referred_id UUID NOT NULL REFERENCES public.customers(id),
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'completed', 'cancelled'
  order_id UUID REFERENCES public.orders(id),
  reward_type TEXT NOT NULL DEFAULT 'points',
  reward_value NUMERIC,
  reward_description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(referred_id) -- One person can only be referred once
);

-- Enable RLS
ALTER TABLE public.customer_referrals ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Tenants can view their store's customer referrals"
ON public.customer_referrals
FOR SELECT
USING (auth.uid() = store_user_id);

CREATE POLICY "Tenants can update their store's customer referrals"
ON public.customer_referrals
FOR UPDATE
USING (auth.uid() = store_user_id);

CREATE POLICY "Customers can view their own referrals made"
ON public.customer_referrals
FOR SELECT
USING (
  referrer_id IN (
    SELECT id FROM public.customers WHERE auth_user_id = auth.uid()
  )
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_customer_referrals_store ON public.customer_referrals(store_user_id);
CREATE INDEX IF NOT EXISTS idx_customer_referrals_referrer ON public.customer_referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_customer_referrals_referred ON public.customer_referrals(referred_id);
