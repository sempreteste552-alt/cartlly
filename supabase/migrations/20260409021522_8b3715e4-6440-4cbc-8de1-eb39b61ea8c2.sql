-- Add cron job to check for pending orders every 20 minutes
SELECT cron.schedule(
  'notify-pending-orders-every-20-min',
  '*/20 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://dxdpdwwwhhwbbcybyshd.supabase.co/functions/v1/check-pending-orders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = 'email_queue_service_role_key'
      )
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
