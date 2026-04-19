CREATE OR REPLACE FUNCTION public.handle_low_stock_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
    IF (TG_OP = 'INSERT' AND NEW.stock <= NEW.min_stock_alert) OR
       (TG_OP = 'UPDATE' AND NEW.stock <= NEW.min_stock_alert AND (OLD.stock > OLD.min_stock_alert OR OLD.min_stock_alert IS NULL)) THEN

        INSERT INTO public.admin_notifications (
            sender_user_id, target_user_id, title, message, type
        ) VALUES (
            NEW.user_id, NEW.user_id,
            'Estoque Baixo: ' || NEW.name,
            'O produto "' || NEW.name || '" atingiu o nível crítico de estoque (' || NEW.stock || ' unidades).',
            'low_stock'
        );

        INSERT INTO public.admin_notifications (
            sender_user_id, target_user_id, title, message, type
        )
        SELECT
            NEW.user_id, collaborator_id,
            'Estoque Baixo: ' || NEW.name,
            'O produto "' || NEW.name || '" atingiu o nível crítico de estoque (' || NEW.stock || ' unidades).',
            'low_stock'
        FROM public.store_collaborators
        WHERE store_owner_id = NEW.user_id AND role IN ('admin', 'editor');
    END IF;
    RETURN NEW;
END;
$function$;