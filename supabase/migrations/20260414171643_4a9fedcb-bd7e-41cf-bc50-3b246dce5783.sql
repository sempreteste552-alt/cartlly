-- Create manual_sales table for offline/external sales
CREATE TABLE public.manual_sales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  total NUMERIC NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'dinheiro',
  status TEXT NOT NULL DEFAULT 'concluido',
  notes TEXT,
  sale_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.manual_sales ENABLE ROW LEVEL SECURITY;

-- Owner-only policies
CREATE POLICY "Users can view their own manual sales"
ON public.manual_sales FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own manual sales"
ON public.manual_sales FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own manual sales"
ON public.manual_sales FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own manual sales"
ON public.manual_sales FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- Index for performance
CREATE INDEX idx_manual_sales_user_id ON public.manual_sales(user_id);
CREATE INDEX idx_manual_sales_sale_date ON public.manual_sales(sale_date);

-- Updated_at trigger
CREATE TRIGGER update_manual_sales_updated_at
BEFORE UPDATE ON public.manual_sales
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();