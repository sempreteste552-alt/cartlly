
-- 1. Add min_stock_alert column to products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS min_stock_alert integer NOT NULL DEFAULT 5;

-- 2. Fix get_store_rich_insights (total_amount -> total, add status filtering)
CREATE OR REPLACE FUNCTION public.get_store_rich_insights(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_total_sales_30d NUMERIC;
    v_approved_sales_30d NUMERIC;
    v_order_count_30d INTEGER;
    v_approved_count_30d INTEGER;
    v_refused_count_30d INTEGER;
    v_cancelled_count_30d INTEGER;
    v_pending_count_30d INTEGER;
    v_avg_ticket NUMERIC;
    v_top_products JSONB;
    v_bottom_products JSONB;
    v_abandoned_rate NUMERIC;
    v_failed_payments_7d INTEGER;
    v_customer_growth_30d INTEGER;
    v_result JSONB;
BEGIN
    -- 1. Total and approved sales (last 30 days)
    SELECT 
        COALESCE(SUM(total), 0),
        COUNT(*)
    INTO v_total_sales_30d, v_order_count_30d
    FROM public.orders
    WHERE user_id = p_user_id 
      AND created_at >= NOW() - INTERVAL '30 days';

    -- Approved only
    SELECT 
        COALESCE(SUM(total), 0),
        COUNT(*)
    INTO v_approved_sales_30d, v_approved_count_30d
    FROM public.orders
    WHERE user_id = p_user_id 
      AND status NOT IN ('cancelado', 'recusado', 'expirado')
      AND created_at >= NOW() - INTERVAL '30 days';

    -- Refused
    SELECT COUNT(*) INTO v_refused_count_30d
    FROM public.orders
    WHERE user_id = p_user_id AND status = 'cancelado' AND created_at >= NOW() - INTERVAL '30 days';

    -- Pending
    SELECT COUNT(*) INTO v_pending_count_30d
    FROM public.orders
    WHERE user_id = p_user_id AND status = 'pendente' AND created_at >= NOW() - INTERVAL '30 days';

    -- Average ticket (approved only)
    v_avg_ticket := CASE WHEN v_approved_count_30d > 0 THEN v_approved_sales_30d / v_approved_count_30d ELSE 0 END;

    -- 2. Top 5 selling products (by quantity, approved orders only)
    SELECT jsonb_agg(t) INTO v_top_products
    FROM (
        SELECT p.name, SUM(oi.quantity) as total_sold
        FROM public.order_items oi
        JOIN public.products p ON oi.product_id = p.id
        JOIN public.orders o ON oi.order_id = o.id
        WHERE o.user_id = p_user_id
          AND o.status NOT IN ('cancelado', 'recusado', 'expirado')
          AND o.created_at >= NOW() - INTERVAL '30 days'
        GROUP BY p.name
        ORDER BY total_sold DESC
        LIMIT 5
    ) t;

    -- 3. Bottom 5 selling products
    SELECT jsonb_agg(t) INTO v_bottom_products
    FROM (
        SELECT p.name, p.stock, 
               COALESCE(SUM(oi.quantity), 0) as total_sold,
               COUNT(DISTINCT cvs.customer_id) as total_views
        FROM public.products p
        LEFT JOIN public.order_items oi ON oi.product_id = p.id
        LEFT JOIN public.customer_view_stats cvs ON cvs.product_id = p.id
        WHERE p.user_id = p_user_id
          AND p.stock > 0
        GROUP BY p.id, p.name, p.stock
        ORDER BY total_sold ASC, total_views DESC
        LIMIT 5
    ) t;

    -- 4. Abandoned cart rate
    SELECT 
        CASE 
            WHEN (v_approved_count_30d + COUNT(*)) > 0 
            THEN (COUNT(*)::NUMERIC / (v_approved_count_30d + COUNT(*)) * 100) 
            ELSE 0 
        END
    INTO v_abandoned_rate
    FROM public.abandoned_carts
    WHERE user_id = p_user_id
      AND created_at >= NOW() - INTERVAL '30 days';

    -- 5. Failed payments (last 7 days)
    SELECT COUNT(*)
    INTO v_failed_payments_7d
    FROM public.payments
    WHERE user_id = p_user_id
      AND status IN ('failed', 'refused')
      AND created_at >= NOW() - INTERVAL '7 days';

    -- 6. Customer growth
    SELECT COUNT(*)
    INTO v_customer_growth_30d
    FROM public.customers
    WHERE store_user_id = p_user_id
      AND created_at >= NOW() - INTERVAL '30 days';

    v_result := jsonb_build_object(
        'sales_30d', v_approved_sales_30d,
        'sales_total_30d', v_total_sales_30d,
        'orders_30d', v_order_count_30d,
        'approved_orders_30d', v_approved_count_30d,
        'refused_orders_30d', v_refused_count_30d,
        'pending_orders_30d', v_pending_count_30d,
        'avg_ticket', ROUND(v_avg_ticket, 2),
        'top_products', COALESCE(v_top_products, '[]'::jsonb),
        'bottom_products', COALESCE(v_bottom_products, '[]'::jsonb),
        'abandoned_rate', ROUND(v_abandoned_rate, 2),
        'failed_payments_7d', v_failed_payments_7d,
        'new_customers_30d', v_customer_growth_30d,
        'timestamp', NOW()
    );

    RETURN v_result;
END;
$function$;

-- 3. Fix get_store_sales_stats too (total_amount -> total)
CREATE OR REPLACE FUNCTION public.get_store_sales_stats(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_total_sales NUMERIC;
    v_order_count INTEGER;
    v_avg_order_value NUMERIC;
    v_failed_payments_count INTEGER;
    v_result JSONB;
BEGIN
    SELECT 
        COALESCE(SUM(total), 0),
        COUNT(*)
    INTO v_total_sales, v_order_count
    FROM public.orders
    WHERE user_id = p_user_id 
      AND status NOT IN ('cancelado', 'recusado', 'expirado')
      AND created_at >= NOW() - INTERVAL '30 days';

    v_avg_order_value := CASE WHEN v_order_count > 0 THEN v_total_sales / v_order_count ELSE 0 END;

    SELECT COUNT(*)
    INTO v_failed_payments_count
    FROM public.payments
    WHERE user_id = p_user_id
      AND status IN ('failed', 'refused')
      AND created_at >= NOW() - INTERVAL '7 days';

    v_result := jsonb_build_object(
        'total_sales_30d', v_total_sales,
        'order_count_30d', v_order_count,
        'avg_order_value', v_avg_order_value,
        'failed_payments_7d', v_failed_payments_count,
        'last_updated', NOW()
    );

    RETURN v_result;
END;
$function$;

-- 4. Update trigger to use min_stock_alert from product
CREATE OR REPLACE FUNCTION public.trigger_push_on_low_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  -- Use the product's custom min_stock_alert threshold
  IF NEW.stock <= NEW.min_stock_alert AND OLD.stock > NEW.min_stock_alert THEN
    PERFORM net.http_post(
      url := 'https://dxdpdwwwhhwbbcybyshd.supabase.co/functions/v1/send-push-internal',
      body := jsonb_build_object(
        'target_user_id', NEW.user_id,
        'title', '⚠️ Estoque Baixo: ' || NEW.name,
        'body', 'O produto "' || NEW.name || '" está com apenas ' || NEW.stock || ' unidades restantes (mínimo: ' || NEW.min_stock_alert || ').',
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
      'O produto "' || NEW.name || '" está com apenas ' || NEW.stock || ' unidades. Limite mínimo: ' || NEW.min_stock_alert || '.',
      'low_stock'
    );
  END IF;

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
