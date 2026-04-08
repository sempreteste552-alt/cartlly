-- Add tracking columns to push_logs
ALTER TABLE public.push_logs 
ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS customer_id UUID,
ADD COLUMN IF NOT EXISTS trigger_type TEXT DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS store_user_id UUID;

-- Add index for dashboard queries
CREATE INDEX IF NOT EXISTS idx_push_logs_store_user ON public.push_logs(store_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_push_logs_trigger ON public.push_logs(trigger_type);
CREATE INDEX IF NOT EXISTS idx_push_logs_status ON public.push_logs(status);

-- Add RLS policy for push_logs if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'push_logs' AND policyname = 'Users can view own push logs') THEN
    CREATE POLICY "Users can view own push logs"
    ON public.push_logs
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id OR auth.uid() = store_user_id);
  END IF;
END $$;