
-- 1. Add tenant-specific feature overrides column to tenant_subscriptions
ALTER TABLE public.tenant_subscriptions ADD COLUMN IF NOT EXISTS feature_overrides jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 2. Fix RLS: Add explicit INSERT policy for super admins on tenant_subscriptions
CREATE POLICY "Super admins can insert subscriptions"
ON public.tenant_subscriptions FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- 3. Add explicit INSERT policy for users creating own subscription
CREATE POLICY "Users can create own subscription"
ON public.tenant_subscriptions FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 4. Add DELETE policy for super admins
CREATE POLICY "Super admins can delete subscriptions"
ON public.tenant_subscriptions FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));
