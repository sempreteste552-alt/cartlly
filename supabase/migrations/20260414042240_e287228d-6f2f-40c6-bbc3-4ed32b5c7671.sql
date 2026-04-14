-- Add is_prize to products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_prize BOOLEAN DEFAULT false;

-- Add product_id to roulette_prizes
ALTER TABLE public.roulette_prizes ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id);

-- Add delivered columns to roulette_spins
ALTER TABLE public.roulette_spins ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.roulette_spins ADD COLUMN IF NOT EXISTS delivered_by UUID REFERENCES auth.users(id);

-- Update RLS for products to hide prizes from public if not requested specifically (optional, we can filter in code)
-- However, we should ensure that is_prize products are still selectable in admin.

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_products_is_prize ON public.products(is_prize);
CREATE INDEX IF NOT EXISTS idx_roulette_prizes_product_id ON public.roulette_prizes(product_id);
