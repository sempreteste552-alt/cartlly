ALTER TABLE public.loyalty_config 
ADD COLUMN IF NOT EXISTS referral_reward_condition TEXT DEFAULT 'purchase',
ADD COLUMN IF NOT EXISTS referral_goal INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS referral_show_pending BOOLEAN DEFAULT true;

COMMENT ON COLUMN public.loyalty_config.referral_reward_condition IS 'Condition for referral reward: registration or purchase';
COMMENT ON COLUMN public.loyalty_config.referral_goal IS 'Number of referrals needed to earn the reward';
COMMENT ON COLUMN public.loyalty_config.referral_show_pending IS 'Whether to show pending referrals in the customer panel';