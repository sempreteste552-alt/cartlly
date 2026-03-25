
ALTER TABLE public.store_settings 
ADD COLUMN IF NOT EXISTS button_color text NOT NULL DEFAULT '#000000',
ADD COLUMN IF NOT EXISTS button_text_color text NOT NULL DEFAULT '#ffffff',
ADD COLUMN IF NOT EXISTS header_bg_color text NOT NULL DEFAULT '#ffffff',
ADD COLUMN IF NOT EXISTS footer_bg_color text NOT NULL DEFAULT '#000000',
ADD COLUMN IF NOT EXISTS footer_text_color text NOT NULL DEFAULT '#ffffff';
