
ALTER TABLE public.store_settings 
  ADD COLUMN IF NOT EXISTS store_slug TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS admin_primary_color TEXT NOT NULL DEFAULT '#6d28d9',
  ADD COLUMN IF NOT EXISTS admin_accent_color TEXT NOT NULL DEFAULT '#8b5cf6';
