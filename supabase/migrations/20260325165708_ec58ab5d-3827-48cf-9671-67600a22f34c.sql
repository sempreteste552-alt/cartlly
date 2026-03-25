
-- Product variants table
CREATE TABLE public.product_variants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_type TEXT NOT NULL DEFAULT 'color',
  variant_value TEXT NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0,
  price_modifier NUMERIC NOT NULL DEFAULT 0,
  sku TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

-- Product owners can manage variants
CREATE POLICY "Product owners can manage variants"
ON public.product_variants
FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM public.products WHERE products.id = product_variants.product_id AND products.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.products WHERE products.id = product_variants.product_id AND products.user_id = auth.uid()));

-- Anyone can view variants of published products
CREATE POLICY "Anyone can view variants"
ON public.product_variants
FOR SELECT
TO anon
USING (true);

-- Shipping zones table for configurable rates
CREATE TABLE public.shipping_zones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  zone_name TEXT NOT NULL,
  cep_start TEXT NOT NULL,
  cep_end TEXT NOT NULL,
  price NUMERIC NOT NULL DEFAULT 0,
  estimated_days TEXT NOT NULL DEFAULT '5-10 dias úteis',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.shipping_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their shipping zones"
ON public.shipping_zones
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Anyone can view shipping zones"
ON public.shipping_zones
FOR SELECT
TO anon
USING (active = true);

-- Low stock alert threshold on store_settings
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER NOT NULL DEFAULT 5;
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS store_cep TEXT;
