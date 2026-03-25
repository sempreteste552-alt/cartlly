
-- Add made_to_order option to products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS made_to_order boolean NOT NULL DEFAULT false;

-- Create a trigger function to auto-unpublish products when stock reaches 0
-- and auto-republish when stock is replenished (only if not made_to_order)
CREATE OR REPLACE FUNCTION public.auto_manage_product_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If stock went to 0 and product is NOT made_to_order, unpublish it
  IF NEW.stock <= 0 AND NEW.made_to_order = false AND NEW.published = true THEN
    NEW.published := false;
  END IF;
  
  -- If stock was replenished from 0 and product was unpublished, republish it
  IF NEW.stock > 0 AND OLD.stock <= 0 AND NEW.published = false AND OLD.published = false THEN
    NEW.published := true;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_auto_manage_stock
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_manage_product_stock();
