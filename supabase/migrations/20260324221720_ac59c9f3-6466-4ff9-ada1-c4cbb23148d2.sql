
-- Orders table
CREATE TABLE public.orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT,
  customer_address TEXT,
  status TEXT NOT NULL DEFAULT 'pendente',
  total NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  whatsapp_order BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Order items table
CREATE TABLE public.order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  product_image TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Order status history
CREATE TABLE public.order_status_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Store banners
CREATE TABLE public.store_banners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  image_url TEXT NOT NULL,
  link_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add extra config fields to store_settings
ALTER TABLE public.store_settings
ADD COLUMN store_address TEXT,
ADD COLUMN store_phone TEXT,
ADD COLUMN store_whatsapp TEXT,
ADD COLUMN google_maps_url TEXT,
ADD COLUMN store_description TEXT,
ADD COLUMN facebook_url TEXT,
ADD COLUMN instagram_url TEXT,
ADD COLUMN tiktok_url TEXT,
ADD COLUMN twitter_url TEXT,
ADD COLUMN youtube_url TEXT,
ADD COLUMN sell_via_whatsapp BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN store_open BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN store_location TEXT;

-- RLS for orders
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own orders" ON public.orders FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own orders" ON public.orders FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own orders" ON public.orders FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Anyone can create orders" ON public.orders FOR INSERT TO anon WITH CHECK (true);

-- RLS for order_items
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view order items" ON public.order_items FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid())
);
CREATE POLICY "Anyone can create order items" ON public.order_items FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Auth can create order items" ON public.order_items FOR INSERT TO authenticated WITH CHECK (true);

-- RLS for order_status_history
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view status history" ON public.order_status_history FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_status_history.order_id AND orders.user_id = auth.uid())
);
CREATE POLICY "Users can create status history" ON public.order_status_history FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_status_history.order_id AND orders.user_id = auth.uid())
);

-- RLS for store_banners
ALTER TABLE public.store_banners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their banners" ON public.store_banners FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Anyone can view active banners" ON public.store_banners FOR SELECT TO anon USING (active = true);

-- Public read policies for store
CREATE POLICY "Anyone can view published products" ON public.products FOR SELECT TO anon USING (published = true);
CREATE POLICY "Anyone can view store settings" ON public.store_settings FOR SELECT TO anon USING (true);
CREATE POLICY "Anyone can view categories" ON public.categories FOR SELECT TO anon USING (true);

-- Updated at trigger for orders
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime for orders
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
