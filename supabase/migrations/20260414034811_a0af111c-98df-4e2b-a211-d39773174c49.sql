-- Add referral columns to loyalty_config
ALTER TABLE public.loyalty_config 
ADD COLUMN IF NOT EXISTS referral_reward_points INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS referral_enabled BOOLEAN DEFAULT false;
