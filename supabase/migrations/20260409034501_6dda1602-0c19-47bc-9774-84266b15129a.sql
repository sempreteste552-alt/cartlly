-- Fix security warning for function search_path
ALTER FUNCTION public.handle_order_status_notification() SET search_path = public;

-- Update the function to be more robust
CREATE OR REPLACE FUNCTION public.handle_order_status_notification()
RETURNS TRIGGER AS $$
DECLARE
    v_customer_id UUID;
    v_store_name TEXT;
    v_message TEXT;
    v_title TEXT;
BEGIN
    -- Only proceed if status has changed
    IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
        -- Find the customer associated with this order's email or phone
        SELECT id INTO v_customer_id FROM public.customers WHERE email = NEW.customer_email LIMIT 1;

        IF v_customer_id IS NOT NULL THEN
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

            -- Insert into notifications table
            INSERT INTO public.customer_notifications (customer_id, title, message, data)
            VALUES (v_customer_id, v_title, v_message, jsonb_build_object(
                'order_id', NEW.id,
                'status', NEW.status,
                'store_name', v_store_name
            ));
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create an Edge Function trigger for push notifications
-- Note: This requires the function 'send-push-notification' to exist
-- We use a trigger on customer_notifications so it handles any notification
CREATE OR REPLACE FUNCTION public.notify_push_notification()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM
    net.http_post(
      url := (SELECT value FROM public.platform_settings WHERE key = 'edge_function_url' LIMIT 1) || '/send-push-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT value FROM public.platform_settings WHERE key = 'service_role_key' LIMIT 1)
      ),
      body := jsonb_build_object('notification_id', NEW.id)
    );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: net.http_post requires pg_net extension which might not be available.
-- Alternative: Use Supabase Webhooks which are more reliable.
-- I will set up the trigger but the user can also enable Webhooks in the dashboard.
-- Actually, a better way is to just let the Edge Function handle it via a direct trigger if possible, 
-- or use the "Webhooks" feature in the dashboard.
-- For now, I'll stick to the database triggers for notification creation.
