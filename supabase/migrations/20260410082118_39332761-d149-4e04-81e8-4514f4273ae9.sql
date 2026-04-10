-- Function to get rich insights for a store
CREATE OR REPLACE FUNCTION public.get_store_rich_insights(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_total_sales_30d NUMERIC;
    v_order_count_30d INTEGER;
    v_top_products JSONB;
    v_bottom_products JSONB;
    v_abandoned_rate NUMERIC;
    v_failed_payments_7d INTEGER;
    v_customer_growth_30d INTEGER;
    v_result JSONB;
BEGIN
    -- 1. Total sales and order count (last 30 days)
    SELECT 
        COALESCE(SUM(total_amount), 0),
        COUNT(*)
    INTO v_total_sales_30d, v_order_count_30d
    FROM public.orders
    WHERE user_id = p_user_id 
      AND status NOT IN ('cancelled', 'refunded')
      AND created_at >= NOW() - INTERVAL '30 days';

    -- 2. Top 5 selling products (by quantity)
    SELECT jsonb_agg(t) INTO v_top_products
    FROM (
        SELECT p.name, SUM(oi.quantity) as total_sold
        FROM public.order_items oi
        JOIN public.products p ON oi.product_id = p.id
        JOIN public.orders o ON oi.order_id = o.id
        WHERE o.user_id = p_user_id
          AND o.status NOT IN ('cancelled', 'refunded')
          AND o.created_at >= NOW() - INTERVAL '30 days'
        GROUP BY p.name
        ORDER BY total_sold DESC
        LIMIT 5
    ) t;

    -- 3. Bottom 5 selling products (that have at least 1 view but 0 or low sales)
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

    -- 4. Abandoned cart rate (last 30 days)
    SELECT 
        CASE 
            WHEN (v_order_count_30d + COUNT(*)) > 0 
            THEN (COUNT(*)::NUMERIC / (v_order_count_30d + COUNT(*)) * 100) 
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
      AND status = 'failed'
      AND created_at >= NOW() - INTERVAL '7 days';

    -- 6. Customer growth (new customers in last 30 days)
    SELECT COUNT(*)
    INTO v_customer_growth_30d
    FROM public.customers
    WHERE store_user_id = p_user_id
      AND created_at >= NOW() - INTERVAL '30 days';

    -- Build JSON result
    v_result := jsonb_build_object(
        'sales_30d', v_total_sales_30d,
        'orders_30d', v_order_count_30d,
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

-- Function to check if a notification can be sent (cooldown + dedup)
CREATE OR REPLACE FUNCTION public.can_send_notification(
    p_user_id uuid,
    p_target_user_id uuid,
    p_title text,
    p_message text,
    p_cooldown_minutes integer DEFAULT 5
)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_last_sent_at timestamp with time zone;
    v_duplicate_exists boolean;
BEGIN
    -- 1. Check cooldown (any notification to this target in the last N minutes)
    SELECT MAX(created_at)
    INTO v_last_sent_at
    FROM public.admin_notifications
    WHERE target_user_id = p_target_user_id
      AND created_at >= NOW() - (p_cooldown_minutes || ' minutes')::interval;

    IF v_last_sent_at IS NOT NULL THEN
        RETURN FALSE;
    END IF;

    -- 2. Check for identical message in the last 24 hours (deduplication)
    SELECT EXISTS (
        SELECT 1 
        FROM public.admin_notifications
        WHERE target_user_id = p_target_user_id
          AND title = p_title
          AND message = p_message
          AND created_at >= NOW() - INTERVAL '24 hours'
    ) INTO v_duplicate_exists;

    IF v_duplicate_exists THEN
        RETURN FALSE;
    END IF;

    RETURN TRUE;
END;
$function$;
