-- 1. Ensure verification_token is automatically generated if missing
CREATE OR REPLACE FUNCTION public.generate_domain_verification_token()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.verification_token IS NULL THEN
    NEW.verification_token := 'lovable_verify_' || encode(gen_random_bytes(8), 'hex');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_generate_domain_verification_token ON public.store_domains;
CREATE TRIGGER tr_generate_domain_verification_token
BEFORE INSERT ON public.store_domains
FOR EACH ROW
EXECUTE FUNCTION public.generate_domain_verification_token();

-- 2. Function to trigger background verification via Edge Function
-- This uses pg_net to call the verify-domain function for all pending or recently unchecked domains
CREATE OR REPLACE FUNCTION public.check_pending_domains()
RETURNS void AS $$
DECLARE
  domain_record RECORD;
  edge_function_url TEXT;
  service_role_key TEXT;
BEGIN
  -- Get secrets from vault or env (In Supabase, we usually use http extension or pg_net)
  -- We assume SUPABASE_URL and SERVICE_ROLE_KEY are available or we use relative path
  
  FOR domain_record IN 
    SELECT id, store_id, hostname 
    FROM public.store_domains 
    WHERE status IN ('pending_dns', 'pending_ssl', 'emitting')
       OR (last_verified_at IS NULL OR last_verified_at < now() - interval '4 hours')
    LIMIT 20 -- Throttle to avoid hitting rate limits
  LOOP
    -- Call the edge function asynchronously
    PERFORM net.http_post(
      url := (SELECT value FROM (SELECT current_setting('request.headers', true)::json->>'x-forwarded-proto' as proto, current_setting('request.headers', true)::json->>'host' as host) h WHERE host IS NOT NULL) || '/functions/v1/verify-domain',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := jsonb_build_object(
        'domainId', domain_record.id,
        'settingsId', domain_record.store_id,
        'domain', domain_record.hostname
      )
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 3. Schedule the check using pg_cron (runs every 10 minutes)
-- Note: pg_cron is usually enabled in 'extensions' schema, but we call it from public
SELECT cron.schedule('check-domains-job', '*/10 * * * *', 'SELECT public.check_pending_domains()');

-- 4. Ensure store_domains is accessible by admins and readable by public (for resolver)
ALTER TABLE public.store_domains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage their store domains"
ON public.store_domains
FOR ALL
TO authenticated
USING (
  store_id IN (SELECT id FROM public.store_settings WHERE user_id = auth.uid())
);

CREATE POLICY "Public can read domains for resolution"
ON public.store_domains
FOR SELECT
TO anon, authenticated
USING (true);

-- 5. Add index for faster resolution
CREATE INDEX IF NOT EXISTS idx_store_domains_hostname ON public.store_domains(hostname);
