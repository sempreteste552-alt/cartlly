-- Fix security warnings for all newly created functions
ALTER FUNCTION public.handle_order_status_notification() SET search_path = public;

-- Update notify_push_notification to be more robust and call send-push-internal
CREATE OR REPLACE FUNCTION public.notify_push_notification()
RETURNS TRIGGER AS $$
DECLARE
    v_auth_user_id UUID;
    v_url TEXT;
    v_key TEXT;
    v_store_user_id UUID;
BEGIN
    -- Get the auth_user_id for the customer
    SELECT auth_user_id, store_user_id INTO v_auth_user_id, v_store_user_id 
    FROM public.customers WHERE id = NEW.customer_id;

    IF v_auth_user_id IS NOT NULL THEN
        -- Get Edge Function config from platform_settings
        SELECT (value->>'value') INTO v_url FROM public.platform_settings WHERE key = 'edge_function_url';
        SELECT (value->>'value') INTO v_key FROM public.platform_settings WHERE key = 'service_role_key';

        IF v_url IS NOT NULL AND v_key IS NOT NULL THEN
            PERFORM
                net.http_post(
                    url := v_url || '/send-push-internal',
                    headers := jsonb_build_object(
                        'Content-Type', 'application/json',
                        'Authorization', 'Bearer ' || v_key
                    ),
                    body := jsonb_build_object(
                        'target_user_id', v_auth_user_id,
                        'title', NEW.title,
                        'body', NEW.message,
                        'url', '/orders/' || (NEW.data->>'order_id'),
                        'type', 'order_status_update',
                        'store_user_id', v_store_user_id,
                        'data', NEW.data
                    )
                );
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Re-apply trigger to customer_notifications
DROP TRIGGER IF EXISTS trigger_notify_push_notification ON public.customer_notifications;
CREATE TRIGGER trigger_notify_push_notification
AFTER INSERT ON public.customer_notifications
FOR EACH ROW
EXECUTE FUNCTION public.notify_push_notification();

-- Ensure realtime is enabled only for customer_notifications
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'customer_notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.customer_notifications;
  END IF;
END $$;