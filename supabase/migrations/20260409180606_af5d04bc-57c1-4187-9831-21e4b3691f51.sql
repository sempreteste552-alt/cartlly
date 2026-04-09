
-- ==========================================================
-- 1. Hash OTP codes with pgcrypto
-- ==========================================================
-- Enable pgcrypto if not already enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Add a hashed_code column
ALTER TABLE public.otp_codes ADD COLUMN IF NOT EXISTS hashed_code text;

-- Hash existing plaintext codes
UPDATE public.otp_codes SET hashed_code = extensions.crypt(code, extensions.gen_salt('bf', 8)) WHERE hashed_code IS NULL AND code IS NOT NULL;

-- ==========================================================
-- 2. Enable RLS on realtime.messages if it exists
-- ==========================================================
-- Note: realtime.messages is a Supabase-managed schema, we cannot modify it directly.
-- Instead, we'll ensure our realtime publications only expose what's needed.
-- This is handled at the application level via channel naming conventions.
