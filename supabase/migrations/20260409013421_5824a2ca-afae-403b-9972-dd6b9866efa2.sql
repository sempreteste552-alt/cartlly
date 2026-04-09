
CREATE OR REPLACE FUNCTION public.trigger_push_on_low_stock()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  -- Only fire when stock transitions to low (<=5) from a higher value
  IF NEW.stock <= 5 AND OLD.stock > 5 THEN
    PERFORM net.http_post(
      url := 'https://dxdpdwwwhhwbbcybyshd.supabase.co/functions/v1/send-push-internal',
      body := jsonb_build_object(
        'target_user_id', NEW.user_id,
        'title', '⚠️ Estoque Baixo: ' || NEW.name,
        'body', 'O produto "' || NEW.name || '" está com apenas ' || NEW.stock || ' unidades restantes.',
        'url', '/admin/produtos',
        'type', 'low_stock'
      ),
      headers := '{"Content-Type": "application/json"}'::jsonb
    );

    -- Also create an admin notification
    INSERT INTO public.admin_notifications (sender_user_id, target_user_id, title, message, type)
    VALUES (
      NEW.user_id,
      NEW.user_id,
      '⚠️ Estoque Baixo: ' || NEW.name,
      'O produto "' || NEW.name || '" está com apenas ' || NEW.stock || ' unidades. Considere reabastecer.',
      'low_stock'
    );
  END IF;

  -- Also fire when stock reaches 0
  IF NEW.stock = 0 AND OLD.stock > 0 THEN
    PERFORM net.http_post(
      url := 'https://dxdpdwwwhhwbbcybyshd.supabase.co/functions/v1/send-push-internal',
      body := jsonb_build_object(
        'target_user_id', NEW.user_id,
        'title', '🚨 Produto Esgotado: ' || NEW.name,
        'body', 'O produto "' || NEW.name || '" está sem estoque!',
        'url', '/admin/produtos',
        'type', 'out_of_stock'
      ),
      headers := '{"Content-Type": "application/json"}'::jsonb
    );

    INSERT INTO public.admin_notifications (sender_user_id, target_user_id, title, message, type)
    VALUES (
      NEW.user_id,
      NEW.user_id,
      '🚨 Produto Esgotado: ' || NEW.name,
      'O produto "' || NEW.name || '" está sem estoque! Reponha para continuar vendendo.',
      'out_of_stock'
    );
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER trigger_low_stock_push
  AFTER UPDATE OF stock ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_push_on_low_stock();
