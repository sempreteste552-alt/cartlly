
-- Update trigger to route super admins to /superadmin/notificacoes
CREATE OR REPLACE FUNCTION public.trigger_push_on_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  push_url text;
  is_super boolean;
BEGIN
  IF NEW.target_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check if target is super admin to set correct URL
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

  RETURN NEW;
END;
$$;
