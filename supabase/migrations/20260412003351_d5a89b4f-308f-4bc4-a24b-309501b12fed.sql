-- Add original_price column to products table
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS original_price NUMERIC;

-- Comment on the column for clarity
COMMENT ON COLUMN public.products.original_price IS 'The price before discount, used to show comparative prices and discount badges.';
