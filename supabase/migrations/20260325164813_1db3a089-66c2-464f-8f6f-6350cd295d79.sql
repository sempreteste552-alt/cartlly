
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_status_history;

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_cost numeric NOT NULL DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_cep text DEFAULT NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_method text DEFAULT NULL;

ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS shipping_base_cost numeric NOT NULL DEFAULT 0;
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS shipping_per_km numeric NOT NULL DEFAULT 0;
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS shipping_free_above numeric DEFAULT NULL;
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS shipping_flat_rate numeric DEFAULT NULL;
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS shipping_enabled boolean NOT NULL DEFAULT false;

CREATE POLICY "Anyone can view order by id for tracking" ON public.orders
  FOR SELECT TO anon USING (true);

CREATE POLICY "Anyone can view status history for tracking" ON public.order_status_history
  FOR SELECT TO anon USING (true);

CREATE POLICY "Anyone can view order items for tracking" ON public.order_items
  FOR SELECT TO anon USING (true);
