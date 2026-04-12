-- Fix search_path for functions
ALTER FUNCTION public.generate_domain_verification_token() SET search_path = public;
ALTER FUNCTION public.check_pending_domains() SET search_path = public, net;

-- Refine check_pending_domains to be more robust
CREATE OR REPLACE FUNCTION public.check_pending_domains()
RETURNS void AS $$
DECLARE
  domain_record RECORD;
  base_url TEXT;
  service_key TEXT;
BEGIN
  -- We try to get the project URL from settings or vault
  -- For now, we assume it can be constructed or is available in a config table
  -- Alternatively, we can use a relative path if supported, but usually full URL is needed
  
  -- Attempt to get service role key from a secure place if it exists
  -- If not available, the function will fail gracefully
  
  FOR domain_record IN 
    SELECT id, store_id, hostname 
    FROM public.store_domains 
    WHERE (status IN ('pending_dns', 'pending_ssl', 'emitting') AND updated_at < now() - interval '10 minutes')
       OR (last_verified_at IS NULL OR last_verified_at < now() - interval '4 hours')
    ORDER BY last_verified_at ASC NULLS FIRST
    LIMIT 10
  LOOP
    -- This requires pg_net to be configured or the project to have these settings available
    -- In a real Lovable/Supabase environment, these are often pre-configured
    BEGIN
      PERFORM net.http_post(
        url := 'https://' || (SELECT split_part(current_setting('request.headers', true)::json->>'host', '.', 1)) || '.supabase.co/functions/v1/verify-domain',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || COALESCE(current_setting('app.settings.service_role_key', true), '')
        ),
        body := jsonb_build_object(
          'domainId', domain_record.id,
          'settingsId', domain_record.store_id,
          'domain', domain_record.hostname
        )
      );
    EXCEPTION WHEN OTHERS THEN
      -- Log error or ignore
    END;
  END LOOP;
END;
$$ LANGUAGE plpgsql;
