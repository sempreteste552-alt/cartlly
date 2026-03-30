
-- 1. Fix search_path on functions missing it
CREATE OR REPLACE FUNCTION public.delete_email(queue_name text, message_id bigint)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
 SET search_path = 'public'
AS $function$
BEGIN
  RETURN pgmq.delete(queue_name, message_id);
EXCEPTION WHEN undefined_table THEN
  RETURN FALSE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enqueue_email(queue_name text, payload jsonb)
 RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER
 SET search_path = 'public'
AS $function$
BEGIN
  RETURN pgmq.send(queue_name, payload);
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN pgmq.send(queue_name, payload);
END;
$function$;

CREATE OR REPLACE FUNCTION public.move_to_dlq(source_queue text, dlq_name text, message_id bigint, payload jsonb)
 RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER
 SET search_path = 'public'
AS $function$
DECLARE new_id BIGINT;
BEGIN
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  PERFORM pgmq.delete(source_queue, message_id);
  RETURN new_id;
EXCEPTION WHEN undefined_table THEN
  BEGIN
    PERFORM pgmq.create(dlq_name);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  BEGIN
    PERFORM pgmq.delete(source_queue, message_id);
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;
  RETURN new_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.read_email_batch(queue_name text, batch_size integer, vt integer)
 RETURNS TABLE(msg_id bigint, read_ct integer, message jsonb)
 LANGUAGE plpgsql SECURITY DEFINER
 SET search_path = 'public'
AS $function$
BEGIN
  RETURN QUERY SELECT r.msg_id, r.read_ct, r.message FROM pgmq.read(queue_name, vt, batch_size) r;
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trigger_push_on_notification()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
 SET search_path = 'public', 'extensions'
AS $function$
DECLARE
  push_url text;
  is_super boolean;
BEGIN
  IF NEW.target_user_id IS NOT NULL THEN
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
  END IF;

  RETURN NEW;
END;
$function$;

-- 2. Tighten INSERT policies with WITH CHECK (true)
-- order_items: require valid order reference
DROP POLICY IF EXISTS "Anyone can create order items" ON public.order_items;
DROP POLICY IF EXISTS "Auth can create order items" ON public.order_items;
CREATE POLICY "Anon can create order items"
  ON public.order_items FOR INSERT TO anon
  WITH CHECK (EXISTS (SELECT 1 FROM public.orders WHERE id = order_id));
CREATE POLICY "Auth can create order items"
  ON public.order_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.orders WHERE id = order_id));

-- orders: anon INSERT should set user_id to the store owner
DROP POLICY IF EXISTS "Anyone can create orders" ON public.orders;
DROP POLICY IF EXISTS "Authenticated users can create orders" ON public.orders;
CREATE POLICY "Anon can create orders"
  ON public.orders FOR INSERT TO anon
  WITH CHECK (user_id IS NOT NULL);
CREATE POLICY "Auth can create orders"
  ON public.orders FOR INSERT TO authenticated
  WITH CHECK (user_id IS NOT NULL);

-- payments: auth INSERT should match user_id to an existing order
DROP POLICY IF EXISTS "Auth can create payments" ON public.payments;
CREATE POLICY "Auth can create payments"
  ON public.payments FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.orders WHERE id = order_id));

-- product_reviews: auth INSERT should require product exists
DROP POLICY IF EXISTS "Authenticated can create reviews" ON public.product_reviews;
CREATE POLICY "Auth can create reviews"
  ON public.product_reviews FOR INSERT TO authenticated
  WITH CHECK (customer_email IS NULL AND EXISTS (SELECT 1 FROM public.products WHERE id = product_id AND published = true));
