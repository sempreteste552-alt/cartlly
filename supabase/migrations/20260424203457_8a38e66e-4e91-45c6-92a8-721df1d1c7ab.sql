-- Add session_id to push_subscriptions
ALTER TABLE public.push_subscriptions ADD COLUMN session_id TEXT;
CREATE INDEX idx_push_subs_session_id ON public.push_subscriptions(session_id);

-- Update RLS for push_subscriptions to allow anonymous upserts by session_id
CREATE POLICY "Allow anonymous upsert by session_id" 
ON public.push_subscriptions 
FOR ALL 
USING (true) 
WITH CHECK (true);
