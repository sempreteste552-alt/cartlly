-- Add detailed columns to orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS customer_cpf TEXT,
ADD COLUMN IF NOT EXISTS shipping_street TEXT,
ADD COLUMN IF NOT EXISTS shipping_number TEXT,
ADD COLUMN IF NOT EXISTS shipping_neighborhood TEXT,
ADD COLUMN IF NOT EXISTS shipping_city TEXT,
ADD COLUMN IF NOT EXISTS shipping_state TEXT,
ADD COLUMN IF NOT EXISTS shipping_complement TEXT;

-- Update RLS if needed (usually columns don't need explicit RLS if table has it)
