-- Add platform column to push_subscriptions
ALTER TABLE public.push_subscriptions 
ADD COLUMN IF NOT EXISTS platform text NOT NULL DEFAULT 'web';

-- Create push_logs table for audit
CREATE TABLE IF NOT EXISTS public.push_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  subscription_id uuid REFERENCES public.push_subscriptions(id) ON DELETE SET NULL,
  event_type text NOT NULL DEFAULT 'general',
  title text NOT NULL,
  body text,
  payload jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'sent',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.push_logs ENABLE ROW LEVEL SECURITY;

-- RLS: users can view their own logs, super admins can view all
CREATE POLICY "Users can view own push logs"
ON public.push_logs FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Super admins can view all push logs"
ON public.push_logs FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Allow service role inserts (edge functions use service role)
CREATE POLICY "Service insert push logs"
ON public.push_logs FOR INSERT TO authenticated
WITH CHECK (true);

-- Add unique constraint for upsert on push_subscriptions
CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_user_endpoint_idx 
ON public.push_subscriptions(user_id, endpoint);
