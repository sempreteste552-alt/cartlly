ALTER TABLE public.store_domains 
ADD COLUMN IF NOT EXISTS txt_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS dns_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS last_ssl_error TEXT,
ADD COLUMN IF NOT EXISTS ssl_issued_at TIMESTAMP WITH TIME ZONE;

-- Add a comment for better documentation
COMMENT ON COLUMN public.store_domains.txt_status IS 'Status of TXT verification: pending, verified, failed';
COMMENT ON COLUMN public.store_domains.dns_status IS 'Status of DNS configuration (A/CNAME): pending, propagated, failed';
COMMENT ON COLUMN public.store_domains.status IS 'Overall status: pending_dns, pending_verification, pending_ssl, active, failed';

-- Create a trigger function to keep store_settings.custom_domain in sync with the primary store_domain
CREATE OR REPLACE FUNCTION public.sync_primary_domain_to_settings()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_primary = true AND (OLD.is_primary IS NULL OR OLD.is_primary = false OR NEW.hostname <> OLD.hostname OR NEW.status <> OLD.status) THEN
    UPDATE public.store_settings
    SET 
      custom_domain = CASE WHEN NEW.status = 'active' THEN NEW.hostname ELSE custom_domain END,
      domain_status = CASE WHEN NEW.status = 'active' THEN 'verified' ELSE 'pending' END,
      domain_verify_details = jsonb_build_object(
        'dnsComplete', NEW.dns_status = 'propagated',
        'txtRecord', NEW.txt_status = 'verified',
        'sslReady', NEW.ssl_status = 'active',
        'status', NEW.status,
        'checkedAt', now()
      )
    WHERE id = NEW.store_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS tr_sync_primary_domain ON public.store_domains;
CREATE TRIGGER tr_sync_primary_domain
AFTER INSERT OR UPDATE ON public.store_domains
FOR EACH ROW
EXECUTE FUNCTION public.sync_primary_domain_to_settings();
