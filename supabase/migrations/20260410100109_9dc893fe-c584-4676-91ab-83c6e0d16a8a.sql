-- Add promo_banner_enabled column to store_settings for per-tenant control
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS promo_banner_enabled boolean NOT NULL DEFAULT false;

-- Ensure promo_banner_enabled platform setting exists
INSERT INTO public.platform_settings (key, value)
VALUES ('promo_banner_enabled', '{"value": false}'::jsonb)
ON CONFLICT (key) DO NOTHING;