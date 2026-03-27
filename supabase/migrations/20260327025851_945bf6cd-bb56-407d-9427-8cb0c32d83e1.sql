
ALTER TABLE public.store_settings
ADD COLUMN welcome_coupon_enabled boolean NOT NULL DEFAULT false,
ADD COLUMN welcome_coupon_discount_type text NOT NULL DEFAULT 'percentage',
ADD COLUMN welcome_coupon_discount_value numeric NOT NULL DEFAULT 10,
ADD COLUMN welcome_coupon_min_order numeric NULL DEFAULT NULL,
ADD COLUMN welcome_coupon_expires_days integer NOT NULL DEFAULT 30;
