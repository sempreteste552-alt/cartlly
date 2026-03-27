
-- Drop the previous trigger since vault secrets may not be accessible reliably
DROP TRIGGER IF EXISTS on_notification_send_push ON public.admin_notifications;
DROP FUNCTION IF EXISTS public.trigger_push_on_notification();

-- Instead, create a simpler trigger using pg_net with hardcoded project URL
CREATE OR REPLACE FUNCTION public.trigger_push_on_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  -- Only send push if there's a target user
  IF NEW.target_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Call the internal push function via pg_net (fire-and-forget)
  PERFORM net.http_post(
    url := 'https://dxdpdwwwhhwbbcybyshd.supabase.co/functions/v1/send-push-internal',
    body := jsonb_build_object(
      'target_user_id', NEW.target_user_id,
      'title', NEW.title,
      'body', NEW.message,
      'url', '/admin'
    ),
    headers := '{"Content-Type": "application/json"}'::jsonb
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_notification_send_push
  AFTER INSERT ON public.admin_notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_push_on_notification();
