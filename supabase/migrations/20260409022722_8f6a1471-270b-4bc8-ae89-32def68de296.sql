-- Add views column to products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS views INTEGER NOT NULL DEFAULT 0;

-- Function to increment product views
CREATE OR REPLACE FUNCTION public.increment_product_views(product_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.products
  SET views = views + 1
  WHERE id = product_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
