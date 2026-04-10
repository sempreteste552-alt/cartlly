ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS routine_notes TEXT;

ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS store_category TEXT;

CREATE TABLE IF NOT EXISTS public.customer_view_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    view_count INTEGER DEFAULT 1,
    last_viewed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(customer_id, product_id)
);

-- Enable RLS for the new table
ALTER TABLE public.customer_view_stats ENABLE ROW LEVEL SECURITY;

-- Simple policies for customer_view_stats
CREATE POLICY "Admins can view all view stats" ON public.customer_view_stats
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can update view stats" ON public.customer_view_stats
    FOR UPDATE USING (auth.role() = 'authenticated');
