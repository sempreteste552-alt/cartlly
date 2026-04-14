-- Add is_prize to products if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'is_prize') THEN
        ALTER TABLE public.products ADD COLUMN is_prize BOOLEAN DEFAULT false;
    END IF;
END $$;

-- Create customer_prizes table
CREATE TABLE IF NOT EXISTS public.customer_prizes (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'released', -- 'released', 'claimed', 'delivered'
    released_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    delivered_at TIMESTAMP WITH TIME ZONE,
    store_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.customer_prizes ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Customers can view their own prizes"
    ON public.customer_prizes
    FOR SELECT
    USING (auth.uid() IN (SELECT auth_user_id FROM public.customers WHERE id = customer_id));

CREATE POLICY "Admins can manage prizes for their store"
    ON public.customer_prizes
    FOR ALL
    USING (auth.uid() = store_user_id);

-- Trigger for updated_at
CREATE TRIGGER update_customer_prizes_updated_at
    BEFORE UPDATE ON public.customer_prizes
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
