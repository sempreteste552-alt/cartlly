-- Add AI configuration columns to store_settings
ALTER TABLE public.store_settings 
ADD COLUMN IF NOT EXISTS ai_name TEXT DEFAULT 'Assistente IA',
ADD COLUMN IF NOT EXISTS ai_avatar_url TEXT;

-- Update RLS policies to ensure these columns are accessible
-- No changes needed to policies if they are already using SELECT * and UPDATE *
