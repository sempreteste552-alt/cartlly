-- Update function to include search_path for security
CREATE OR REPLACE FUNCTION public.increment_product_views(product_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.products
  SET views = views + 1
  WHERE id = product_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
