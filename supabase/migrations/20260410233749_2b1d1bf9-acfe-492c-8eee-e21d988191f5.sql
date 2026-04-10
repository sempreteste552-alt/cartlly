
CREATE OR REPLACE FUNCTION public.trigger_push_on_low_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  effective_threshold integer;
BEGIN
  -- If min_stock_alert is 0, still alert at 1 (last unit before running out)
  effective_threshold := GREATEST(NEW.min_stock_alert, 1);

  -- Alert when stock crosses the threshold downward
  IF NEW.stock <= effective_threshold AND OLD.stock > effective_threshold THEN
    PERFORM net.http_post(
      url := 'https://dxdpdwwwhhwbbcybyshd.supabase.co/functions/v1/send-push-internal',
      body := jsonb_build_object(
        'target_user_id', NEW.user_id,
        'title', '⚠️ Estoque Baixo: ' || NEW.name,
        'body', 'O produto "' || NEW.name || '" está com apenas ' || NEW.stock || ' unidade(s) restante(s).' ||
          CASE WHEN NEW.stock = 1 THEN ' Se for vendido, o estoque acaba!' ELSE '' END,
        'url', '/admin/produtos',
        'type', 'low_stock'
      ),
      headers := '{"Content-Type": "application/json"}'::jsonb
    );

    INSERT INTO public.admin_notifications (sender_user_id, target_user_id, title, message, type)
    VALUES (
      NEW.user_id,
      NEW.user_id,
      '⚠️ Estoque Baixo: ' || NEW.name,
      'O produto "' || NEW.name || '" está com apenas ' || NEW.stock || ' unidade(s). Limite mínimo: ' || NEW.min_stock_alert || '.' ||
        CASE WHEN NEW.stock = 1 THEN ' Última unidade!' ELSE '' END,
      'low_stock'
    );
  END IF;

  -- Alert when stock reaches 0 (sold out)
  IF NEW.stock = 0 AND OLD.stock > 0 THEN
    PERFORM net.http_post(
      url := 'https://dxdpdwwwhhwbbcybyshd.supabase.co/functions/v1/send-push-internal',
      body := jsonb_build_object(
        'target_user_id', NEW.user_id,
        'title', '🚨 Produto Esgotado: ' || NEW.name,
        'body', 'O produto "' || NEW.name || '" está sem estoque! Reponha para continuar vendendo.',
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
