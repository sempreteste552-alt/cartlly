-- Add diagnostic columns to store_domains
ALTER TABLE public.store_domains 
ADD COLUMN IF NOT EXISTS dns_validation_details JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS ssl_validation_details JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS conflicting_records JSONB DEFAULT '[]'::jsonb;

-- Ensure verification_token is generated if null
UPDATE public.store_domains 
SET verification_token = encode(gen_random_bytes(16), 'hex')
WHERE verification_token IS NULL;

-- Function to generate token on insert
CREATE OR REPLACE FUNCTION public.ensure_store_domain_token()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.verification_token IS NULL THEN
    NEW.verification_token := encode(gen_random_bytes(16), 'hex');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for token
DROP TRIGGER IF EXISTS tr_ensure_store_domain_token ON public.store_domains;
CREATE TRIGGER tr_ensure_store_domain_token
BEFORE INSERT ON public.store_domains
FOR EACH ROW
EXECUTE FUNCTION public.ensure_store_domain_token();
