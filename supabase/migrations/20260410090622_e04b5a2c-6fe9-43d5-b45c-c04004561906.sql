-- Function to get dashboard metrics efficiently
CREATE OR REPLACE FUNCTION public.get_dashboard_stats(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_total_products INTEGER;
    v_total_orders INTEGER;
    v_month_orders INTEGER;
    v_month_revenue NUMERIC;
    v_total_revenue NUMERIC;
    v_unique_customers INTEGER;
    v_low_stock_count INTEGER;
    v_out_of_stock_count INTEGER;
    v_result JSONB;
BEGIN
    -- Product counts
    SELECT COUNT(*), COUNT(*) FILTER (WHERE stock <= 5 AND stock > 0), COUNT(*) FILTER (WHERE stock = 0)
    INTO v_total_products, v_low_stock_count, v_out_of_stock_count
    FROM public.products
    WHERE user_id = p_user_id;

    -- Order stats
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE created_at >= date_trunc('month', now())),
        COALESCE(SUM(total) FILTER (WHERE created_at >= date_trunc('month', now())), 0),
        COALESCE(SUM(total), 0)
    INTO v_total_orders, v_month_orders, v_month_revenue, v_total_revenue
    FROM public.orders
    WHERE user_id = p_user_id AND status != 'cancelado';

    -- Customer count
    SELECT COUNT(DISTINCT (customer_email || customer_phone || customer_name))
    INTO v_unique_customers
    FROM public.orders
    WHERE user_id = p_user_id;

    v_result := jsonb_build_object(
        'total_products', v_total_products,
        'total_orders', v_total_orders,
        'month_orders', v_month_orders,
        'month_revenue', v_month_revenue,
        'total_revenue', v_total_revenue,
        'unique_customers', v_unique_customers,
        'low_stock', v_low_stock_count,
        'out_of_stock', v_out_of_stock_count
    );

    RETURN v_result;
END;
$function$;

-- Function to get AI work summary
CREATE OR REPLACE FUNCTION public.get_ai_work_summary(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_recent_chats INTEGER;
    v_pending_tasks INTEGER;
    v_completed_tasks INTEGER;
    v_recent_insights INTEGER;
    v_result JSONB;
BEGIN
    -- Recent chat interactions (last 7 days)
    SELECT COUNT(*) INTO v_recent_chats
    FROM public.admin_ai_chats
    WHERE user_id = p_user_id AND created_at >= NOW() - INTERVAL '7 days';

    -- AI tasks status
    SELECT 
        COUNT(*) FILTER (WHERE status = 'pending'),
        COUNT(*) FILTER (WHERE status = 'completed')
    INTO v_pending_tasks, v_completed_tasks
    FROM public.ai_scheduled_tasks
    WHERE user_id = p_user_id AND created_at >= NOW() - INTERVAL '7 days';

    -- Recent CEO insights sent
    SELECT COUNT(*) INTO v_recent_insights
    FROM public.admin_notifications
    WHERE target_user_id = p_user_id 
      AND type = 'ceo_insight'
      AND created_at >= NOW() - INTERVAL '7 days';

    v_result := jsonb_build_object(
        'recent_chats', v_recent_chats,
        'pending_tasks', v_pending_tasks,
        'completed_tasks', v_completed_tasks,
        'recent_insights', v_recent_insights,
        'period', 'últimos 7 dias'
    );

    RETURN v_result;
END;
$function$;
