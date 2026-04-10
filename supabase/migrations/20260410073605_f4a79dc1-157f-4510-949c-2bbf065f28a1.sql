-- Add new columns to store_domains
ALTER TABLE public.store_domains 
ADD COLUMN IF NOT EXISTS verification_token TEXT UNIQUE DEFAULT 'lovable_verify_' || lower(substring(replace(gen_random_uuid()::text, '-', ''), 1, 16)),
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending_dns' CHECK (status IN ('pending_dns', 'pending_verification', 'pending_ssl', 'active', 'failed')),
ADD COLUMN IF NOT EXISTS ssl_status TEXT DEFAULT 'pending' CHECK (ssl_status IN ('pending', 'active', 'failed')),
ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMP WITH TIME ZONE;

-- Create a function to generate a unique verification token if not provided
CREATE OR REPLACE FUNCTION public.generate_domain_verification_token()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.verification_token IS NULL THEN
        NEW.verification_token := 'lovable_verify_' || lower(substring(replace(gen_random_uuid()::text, '-', ''), 1, 16));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to generate verification token on insert
DROP TRIGGER IF EXISTS tr_generate_domain_verification_token ON public.store_domains;
CREATE TRIGGER tr_generate_domain_verification_token
    BEFORE INSERT ON public.store_domains
    FOR EACH ROW
    EXECUTE FUNCTION public.generate_domain_verification_token();

-- Function to handle primary domain logic
CREATE OR REPLACE FUNCTION public.handle_store_primary_domain()
RETURNS TRIGGER AS $$
BEGIN
    -- If setting as primary, unset other primary domains for the same store
    IF NEW.is_primary = TRUE THEN
        UPDATE public.store_domains
        SET is_primary = FALSE, updated_at = now()
        WHERE store_id = NEW.store_id AND id != NEW.id AND is_primary = TRUE;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for primary domain management
DROP TRIGGER IF EXISTS tr_handle_store_primary_domain ON public.store_domains;
CREATE TRIGGER tr_handle_store_primary_domain
    BEFORE INSERT OR UPDATE OF is_primary ON public.store_domains
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_store_primary_domain();

-- Ensure hostname is always lowercase and trimmed
CREATE OR REPLACE FUNCTION public.normalize_domain_hostname()
RETURNS TRIGGER AS $$
BEGIN
    NEW.hostname := lower(trim(NEW.hostname));
    -- Basic normalization: remove protocol and trailing slashes if they were passed somehow
    NEW.hostname := regexp_replace(NEW.hostname, '^https?://', '');
    NEW.hostname := regexp_replace(NEW.hostname, '/.*$', '');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_normalize_domain_hostname ON public.store_domains;
CREATE TRIGGER tr_normalize_domain_hostname
    BEFORE INSERT OR UPDATE OF hostname ON public.store_domains
    FOR EACH ROW
    EXECUTE FUNCTION public.normalize_domain_hostname();
