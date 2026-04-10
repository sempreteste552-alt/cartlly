-- Enable pg_cron if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the process-ai-tasks function to run every minute
-- Note: Replace with actual project ID or use service role secret if needed
-- For Supabase Edge Functions, we typically use net_http
SELECT cron.schedule(
    'process-ai-tasks-every-minute',
    '* * * * *',
    $$
    SELECT
      net.http_post(
        url := 'https://dxdpdwwwhhwbbcybyshd.supabase.co/functions/v1/process-ai-tasks',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1)
        ),
        body := '{}'
      ) as request_id;
    $$
);
