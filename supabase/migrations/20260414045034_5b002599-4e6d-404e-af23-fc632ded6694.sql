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
                sender_user_id, -- Added this field
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
                NEW.user_id, -- Using the tenant ID as sender
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
$$ LANGUAGE plpgsql SET search_path = public;