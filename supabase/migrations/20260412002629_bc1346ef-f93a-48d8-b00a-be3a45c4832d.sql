-- Expand tenant_ai_brain_config table with more specific behavioral settings
ALTER TABLE public.tenant_ai_brain_config 
ADD COLUMN IF NOT EXISTS tone_of_voice TEXT,
ADD COLUMN IF NOT EXISTS writing_style TEXT,
ADD COLUMN IF NOT EXISTS approach_type TEXT,
ADD COLUMN IF NOT EXISTS sending_rules TEXT,
ADD COLUMN IF NOT EXISTS approved_examples TEXT,
ADD COLUMN IF NOT EXISTS prohibitions TEXT,
ADD COLUMN IF NOT EXISTS language_preferences TEXT,
ADD COLUMN IF NOT EXISTS formality_level TEXT,
ADD COLUMN IF NOT EXISTS emoji_usage TEXT,
ADD COLUMN IF NOT EXISTS persuasion_style TEXT,
ADD COLUMN IF NOT EXISTS brand_identity TEXT;

-- Update RLS policies to ensure they are still correct (they should be, as they are based on user_id)
-- Existing policy "Users can manage their own AI config" covers these new columns.
