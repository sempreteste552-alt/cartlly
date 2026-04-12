ALTER TABLE public.store_domains 
ADD COLUMN IF NOT EXISTS detected_provider TEXT,
ADD COLUMN IF NOT EXISTS cloudflare_zone_id TEXT,
ADD COLUMN IF NOT EXISTS cloudflare_api_token TEXT;

-- Update RLS policies to ensure security
-- (Assuming they already exist and are correct for store_id)
