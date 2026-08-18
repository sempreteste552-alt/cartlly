SELECT cron.unschedule('billing-enforcer-daily')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'billing-enforcer-daily');

SELECT cron.schedule(
  'billing-enforcer-daily',
  '0 12 * * *',
  $$
  SELECT net.http_post(
    url := 'https://dxdpdwwwhhwbbcybyshd.supabase.co/functions/v1/billing-enforcer',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{"source": "cron"}'::jsonb
  );
  $$
);