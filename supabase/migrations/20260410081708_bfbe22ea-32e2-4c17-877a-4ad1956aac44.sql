CREATE OR REPLACE FUNCTION public.get_store_sales_stats(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_sales NUMERIC;
    v_order_count INTEGER;
    v_avg_order_value NUMERIC;
    v_failed_payments_count INTEGER;
    v_result JSONB;
BEGIN
    -- Total sales and order count (last 30 days)
    SELECT 
        COALESCE(SUM(total_amount), 0),
        COUNT(*)
    INTO v_total_sales, v_order_count
    FROM public.orders
    WHERE user_id = p_user_id 
      AND status NOT IN ('cancelled', 'refunded')
      AND created_at >= NOW() - INTERVAL '30 days';

    -- Average order value
    v_avg_order_value := CASE WHEN v_order_count > 0 THEN v_total_sales / v_order_count ELSE 0 END;

    -- Failed payments (last 7 days)
    SELECT COUNT(*)
    INTO v_failed_payments_count
    FROM public.payments
    WHERE user_id = p_user_id
      AND status = 'failed'
      AND created_at >= NOW() - INTERVAL '7 days';

    -- Build JSON result
    v_result := jsonb_build_object(
        'total_sales_30d', v_total_sales,
        'order_count_30d', v_order_count,
        'avg_order_value', v_avg_order_value,
        'failed_payments_7d', v_failed_payments_count,
        'last_updated', NOW()
    );

    RETURN v_result;
END;
$$;
