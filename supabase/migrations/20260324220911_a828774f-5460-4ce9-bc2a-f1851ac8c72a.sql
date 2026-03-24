
-- Add payment gateway fields to store_settings
ALTER TABLE public.store_settings
ADD COLUMN payment_gateway TEXT DEFAULT NULL,
ADD COLUMN gateway_public_key TEXT DEFAULT NULL,
ADD COLUMN gateway_environment TEXT NOT NULL DEFAULT 'sandbox';
