
ALTER TABLE public.store_domains 
  ADD COLUMN IF NOT EXISTS activation_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS activated_by uuid,
  ADD COLUMN IF NOT EXISTS activated_at timestamptz;

ALTER PUBLICATION supabase_realtime ADD TABLE public.store_domains;
