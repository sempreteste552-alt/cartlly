
-- Drop existing trigger if any
DROP TRIGGER IF EXISTS on_admin_notification_push ON public.admin_notifications;

-- Update function to handle broadcast (target_user_id IS NULL) by sending to all push subscribers
CREATE OR REPLACE FUNCTION public.trigger_push_on_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  push_url text;
  is_super boolean;
  sub_record record;
BEGIN
  -- If target_user_id is set, send push to that specific user
  IF NEW.target_user_id IS NOT NULL THEN
    SELECT EXISTS(
      SELECT 1 FROM public.user_roles 
      WHERE user_id = NEW.target_user_id AND role = 'super_admin'
    ) INTO is_super;

    IF is_super THEN
      push_url := '/superadmin/notificacoes';
    ELSE
      push_url := '/admin';
    END IF;

    PERFORM net.http_post(
      url := 'https://dxdpdwwwhhwbbcybyshd.supabase.co/functions/v1/send-push-internal',
      body := jsonb_build_object(
        'target_user_id', NEW.target_user_id,
        'title', NEW.title,
        'body', NEW.message,
        'url', push_url
      ),
      headers := '{"Content-Type": "application/json"}'::jsonb
    );
  END IF;

  RETURN NEW;
END;
$function$;

-- Attach trigger to admin_notifications table on INSERT
CREATE TRIGGER on_admin_notification_push
  AFTER INSERT ON public.admin_notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_push_on_notification();
