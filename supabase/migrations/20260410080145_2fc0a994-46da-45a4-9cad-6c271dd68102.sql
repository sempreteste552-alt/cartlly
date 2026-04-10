CREATE OR REPLACE FUNCTION public.increment_customer_view_count(p_customer_id UUID, p_product_id UUID)
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.customer_view_stats (customer_id, product_id, view_count, last_viewed_at)
    VALUES (p_customer_id, p_product_id, 1, now())
    ON CONFLICT (customer_id, product_id)
    DO UPDATE SET 
        view_count = public.customer_view_stats.view_count + 1,
        last_viewed_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
