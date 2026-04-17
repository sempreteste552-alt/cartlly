ALTER TABLE public.store_settings 
ADD COLUMN accepted_payment_methods text[] DEFAULT ARRAY['visa', 'mastercard', 'elo', 'amex', 'hipercard', 'pix', 'boleto'];

-- Update existing stores to have default flags
UPDATE public.store_settings 
SET accepted_payment_methods = ARRAY['visa', 'mastercard', 'elo', 'amex', 'hipercard', 'pix', 'boleto']
WHERE accepted_payment_methods IS NULL;
