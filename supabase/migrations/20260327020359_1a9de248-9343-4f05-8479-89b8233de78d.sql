ALTER TABLE public.store_settings 
ADD COLUMN IF NOT EXISTS store_blocked boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS admin_blocked boolean NOT NULL DEFAULT false;