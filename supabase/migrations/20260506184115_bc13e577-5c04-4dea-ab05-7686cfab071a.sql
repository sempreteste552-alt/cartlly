-- Update tenant_subscriptions table
ALTER TABLE public.tenant_subscriptions 
ADD COLUMN IF NOT EXISTS asaas_subscription_id TEXT,
ADD COLUMN IF NOT EXISTS billing_type TEXT,
ADD COLUMN IF NOT EXISTS next_due_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS asaas_customer_id TEXT;

-- Update profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free';

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_tenant_subscriptions_asaas_sub_id ON public.tenant_subscriptions(asaas_subscription_id);
CREATE INDEX IF NOT EXISTS idx_tenant_subscriptions_asaas_cust_id ON public.tenant_subscriptions(asaas_customer_id);

-- Ensure RLS (Row Level Security) is enabled
ALTER TABLE public.tenant_subscriptions ENABLE ROW LEVEL SECURITY;

-- Policies for tenant_subscriptions (if they don't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tenant_subscriptions' AND policyname = 'Users can view their own subscription') THEN
        CREATE POLICY "Users can view their own subscription" ON public.tenant_subscriptions
        FOR SELECT USING (auth.uid() = user_id);
    END IF;
END $$;
