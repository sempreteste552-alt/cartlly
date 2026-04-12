-- Function to notify admin on support message
CREATE OR REPLACE FUNCTION public.notify_admin_on_support_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_tenant_id UUID;
  v_customer_id UUID;
  v_session_id TEXT;
  v_customer_name TEXT;
  v_title TEXT;
BEGIN
  -- Only trigger for customer messages
  IF NEW.sender_type = 'customer' THEN
    -- Get conversation details
    SELECT tenant_id, customer_id, session_id 
    INTO v_tenant_id, v_customer_id, v_session_id
    FROM public.support_conversations
    WHERE id = NEW.conversation_id;

    -- Get customer name if available
    IF v_customer_id IS NOT NULL THEN
      SELECT name INTO v_customer_name FROM public.customers WHERE id = v_customer_id;
    END IF;

    -- Prepare title
    IF v_customer_name IS NOT NULL AND v_customer_name != '' THEN
      v_title := v_customer_name;
    ELSE
      v_title := 'Visitante ' || SUBSTRING(v_session_id, 1, 4);
    END IF;

    -- Insert into admin_notifications
    -- This table already has a trigger (on_admin_notification_push) that sends push notifications to the admin
    INSERT INTO public.admin_notifications (
      target_user_id,
      title,
      message,
      type,
      read,
      sender_user_id
    ) VALUES (
      v_tenant_id,
      v_title,
      NEW.body,
      'info',
      false,
      NEW.sender_id -- This might be null for guest customers
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger for support messages
DROP TRIGGER IF EXISTS trigger_notify_admin_on_support_message ON public.support_messages;
CREATE TRIGGER trigger_notify_admin_on_support_message
AFTER INSERT ON public.support_messages
FOR EACH ROW
EXECUTE FUNCTION public.notify_admin_on_support_message();
