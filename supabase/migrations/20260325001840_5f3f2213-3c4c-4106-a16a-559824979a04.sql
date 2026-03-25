
CREATE TABLE public.product_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;

-- Anyone can view reviews
CREATE POLICY "Anyone can view reviews" ON public.product_reviews
  FOR SELECT TO anon USING (true);

CREATE POLICY "Authenticated can view reviews" ON public.product_reviews
  FOR SELECT TO authenticated USING (true);

-- Anyone can create reviews
CREATE POLICY "Anyone can create reviews" ON public.product_reviews
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Authenticated can create reviews" ON public.product_reviews
  FOR INSERT TO authenticated WITH CHECK (true);
