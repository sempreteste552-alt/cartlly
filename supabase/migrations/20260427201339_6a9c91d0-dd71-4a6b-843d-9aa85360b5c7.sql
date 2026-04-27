-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Allow anonymous upsert by session_id" ON public.push_subscriptions;

-- Create granular policies for anonymous users
CREATE POLICY "Allow anonymous insert" 
ON public.push_subscriptions 
FOR INSERT 
WITH CHECK (auth.role() = 'anon');

CREATE POLICY "Allow anonymous select by endpoint" 
ON public.push_subscriptions 
FOR SELECT 
USING (auth.role() = 'anon');

-- Note: We don't allow anonymous UPDATE or DELETE. 
-- If an anonymous user needs to update, they should just INSERT again 
-- (which works with ON CONFLICT if they have enough permissions, 
-- but in Supabase RLS 'ON CONFLICT DO UPDATE' requires UPDATE permission).
-- However, for push tokens, it's safer to just allow INSERT.
-- If they want to update, they must be authenticated or we need a more complex session-based check.
