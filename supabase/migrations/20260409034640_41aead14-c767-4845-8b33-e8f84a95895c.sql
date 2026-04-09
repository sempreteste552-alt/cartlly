-- Drop the redundant table and triggers
DROP TRIGGER IF EXISTS trigger_notify_push_notification ON public.customer_notifications;
DROP TABLE IF EXISTS public.customer_notifications;

-- Update handle_order_status_notification to use tenant_messages
CREATE OR REPLACE FUNCTION public.handle_order_status_notification()
RETURNS TRIGGER AS $$
DECLARE
    v_auth_user_id UUID;
    v_store_name TEXT;
    v_message TEXT;
    v_title TEXT;
BEGIN
    -- Only proceed if status has changed
    IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
        -- Find the customer associated with this order
        SELECT auth_user_id INTO v_auth_user_id FROM public.customers WHERE email = NEW.customer_email LIMIT 1;

        IF v_auth_user_id IS NOT NULL THEN
            -- Get store name
            SELECT store_name INTO v_store_name FROM public.store_settings WHERE user_id = NEW.user_id;
            
            -- Prepare title and message based on status
            v_title := v_store_name || ': Pedido Atualizado';
            v_message := CASE LOWER(NEW.status)
                WHEN 'pendente' THEN 'Seu pedido #' || SUBSTRING(NEW.id::TEXT, 1, 8) || ' está pendente.'
                WHEN 'processando' THEN 'Seu pedido #' || SUBSTRING(NEW.id::TEXT, 1, 8) || ' está sendo preparado!'
                WHEN 'enviado' THEN 'Seu pedido #' || SUBSTRING(NEW.id::TEXT, 1, 8) || ' saiu para entrega!'
                WHEN 'entregue' THEN 'Seu pedido #' || SUBSTRING(NEW.id::TEXT, 1, 8) || ' foi entregue. Bom apetite!'
                WHEN 'cancelado' THEN 'Seu pedido #' || SUBSTRING(NEW.id::TEXT, 1, 8) || ' foi cancelado.'
                ELSE 'O status do seu pedido foi alterado para: ' || NEW.status
            END;

            -- Insert into tenant_messages (integrated with UI)
            INSERT INTO public.tenant_messages (
                source_tenant_id,
                target_user_id,
                target_area,
                audience_type,
                title,
                body,
                message_type,
                status,
                channel
            )
            VALUES (
                NEW.user_id,
                v_auth_user_id,
                'public_store',
                'tenant_admin_to_one_customer',
                v_title,
                v_message,
                'info',
                'sent',
                'in_app'
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to notify push via Edge Function for tenant_messages
CREATE OR REPLACE FUNCTION public.notify_tenant_message_push()
RETURNS TRIGGER AS $$
DECLARE
    v_url TEXT;
    v_key TEXT;
BEGIN
    -- Only trigger for store-to-customer messages
    IF NEW.target_area IN ('public_store', 'customer_account') AND NEW.target_user_id IS NOT NULL THEN
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
                        'target_user_id', NEW.target_user_id,
                        'title', NEW.title,
                        'body', NEW.body,
                        'url', '/', -- Generic fallback
                        'type', 'tenant_message',
                        'store_user_id', NEW.source_tenant_id
                    )
                );
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Apply trigger to tenant_messages for push notifications
DROP TRIGGER IF EXISTS trigger_notify_tenant_message_push ON public.tenant_messages;
CREATE TRIGGER trigger_notify_tenant_message_push
AFTER INSERT ON public.tenant_messages
FOR EACH ROW
EXECUTE FUNCTION public.notify_tenant_message_push();