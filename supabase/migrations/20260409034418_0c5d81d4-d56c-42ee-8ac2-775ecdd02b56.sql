-- Table to store customer push tokens (Expo/FCM/etc)
CREATE TABLE public.customer_push_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    platform TEXT, -- 'ios', 'android', 'web'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Table for customer notification history
CREATE TABLE public.customer_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    read BOOLEAN DEFAULT false,
    data JSONB, -- For extra data like order_id
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.customer_push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_notifications ENABLE ROW LEVEL SECURITY;

-- Policies for push tokens
CREATE POLICY "Customers can manage their own push tokens"
ON public.customer_push_tokens
FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.customers WHERE id = customer_push_tokens.customer_id AND auth_user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.customers WHERE id = customer_push_tokens.customer_id AND auth_user_id = auth.uid()));

-- Policies for notifications
CREATE POLICY "Customers can view their own notifications"
ON public.customer_notifications
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.customers WHERE id = customer_notifications.customer_id AND auth_user_id = auth.uid()));

CREATE POLICY "Customers can update their own notifications"
ON public.customer_notifications
FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.customers WHERE id = customer_notifications.customer_id AND auth_user_id = auth.uid()));

-- Function to handle order status changes and create notifications
CREATE OR REPLACE FUNCTION public.handle_order_status_notification()
RETURNS TRIGGER AS $$
DECLARE
    v_customer_id UUID;
    v_store_name TEXT;
    v_message TEXT;
BEGIN
    -- Only proceed if status has changed
    IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
        -- Find the customer associated with this order's email or phone
        -- This is a bit tricky if the customer didn't create an account,
        -- but if they did, we should notify them.
        SELECT id INTO v_customer_id FROM public.customers WHERE email = NEW.customer_email LIMIT 1;

        IF v_customer_id IS NOT NULL THEN
            -- Get store name
            SELECT store_name INTO v_store_name FROM public.store_settings WHERE user_id = NEW.user_id;
            
            -- Prepare message based on status
            v_message := CASE NEW.status
                WHEN 'pendente' THEN 'Seu pedido ' || NEW.id || ' está pendente.'
                WHEN 'processando' THEN 'Seu pedido ' || NEW.id || ' está sendo processado.'
                WHEN 'enviado' THEN 'Seu pedido ' || NEW.id || ' foi enviado!'
                WHEN 'entregue' THEN 'Seu pedido ' || NEW.id || ' foi entregue!'
                WHEN 'cancelado' THEN 'Seu pedido ' || NEW.id || ' foi cancelado.'
                ELSE 'O status do seu pedido ' || NEW.id || ' foi alterado para ' || NEW.status
            END;

            -- Insert into notifications table
            INSERT INTO public.customer_notifications (customer_id, title, message, data)
            VALUES (v_customer_id, v_store_name, v_message, jsonb_build_object('order_id', NEW.id, 'status', NEW.status));
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for order status notifications
CREATE TRIGGER trigger_order_status_notification
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.handle_order_status_notification();

-- Ensure realtime is enabled for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.customer_notifications;