ALTER TABLE public.store_settings
ADD COLUMN IF NOT EXISTS promo_banner_text text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS promo_banner_link text DEFAULT NULL;