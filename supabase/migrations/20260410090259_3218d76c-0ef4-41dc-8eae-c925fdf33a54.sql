-- Schedule the AI tasks processing
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    CREATE EXTENSION pg_cron;
  END IF;
END $$;

-- Add a cron job to process AI tasks every minute
-- We use the project URL directly for the Edge Function
SELECT cron.schedule(
  'process-ai-tasks',
  '* * * * *',
  format(
    'SELECT net.http_post(
      url := ''https://dxdpdwwwhhwbbcybyshd.supabase.co/functions/v1/process-ai-tasks'',
      headers := jsonb_build_object(
        ''Content-Type'', ''application/json'',
        ''Authorization'', ''Bearer %s''
      ),
      body := ''{}''
    );',
    (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key' LIMIT 1)
  )
);
