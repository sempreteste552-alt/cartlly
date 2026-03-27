
-- Enable pg_net extension for HTTP calls from triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Trigger function: send push notification when admin_notifications are inserted
CREATE OR REPLACE FUNCTION public.trigger_push_on_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  push_url text;
  service_key text;
BEGIN
  -- Only send push if there's a target user
  IF NEW.target_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Build the push function URL
  push_url := current_setting('app.settings.supabase_url', true);
  IF push_url IS NULL OR push_url = '' THEN
    push_url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1);
  END IF;

  -- If we still don't have the URL, try to construct it
  IF push_url IS NULL OR push_url = '' THEN
    RETURN NEW; -- Can't send push without URL
  END IF;

  service_key := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1);
  IF service_key IS NULL OR service_key = '' THEN
    RETURN NEW;
  END IF;

  -- Call the internal push function asynchronously via pg_net
  PERFORM extensions.http_post(
    url := push_url || '/functions/v1/send-push-internal',
    body := jsonb_build_object(
      'target_user_id', NEW.target_user_id,
      'title', NEW.title,
      'body', NEW.message,
      'url', '/admin'
    )::text,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    )::jsonb
  );

  RETURN NEW;
END;
$$;

-- Create trigger on admin_notifications
DROP TRIGGER IF EXISTS on_notification_send_push ON public.admin_notifications;
CREATE TRIGGER on_notification_send_push
  AFTER INSERT ON public.admin_notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_push_on_notification();
