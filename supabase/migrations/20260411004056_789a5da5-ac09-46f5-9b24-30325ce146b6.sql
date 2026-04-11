
CREATE TABLE public.stock_notify_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  store_user_id UUID NOT NULL,
  notified BOOLEAN NOT NULL DEFAULT false,
  notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_stock_notify_unique ON public.stock_notify_subscriptions (product_id, email, store_user_id) WHERE notified = false;

ALTER TABLE public.stock_notify_subscriptions ENABLE ROW LEVEL SECURITY;

-- Anyone can subscribe
CREATE POLICY "Anyone can subscribe for stock alerts"
ON public.stock_notify_subscriptions
FOR INSERT
WITH CHECK (true);

-- Store owner can view their subscriptions
CREATE POLICY "Store owner can view subscriptions"
ON public.stock_notify_subscriptions
FOR SELECT
USING (auth.uid() = store_user_id);

-- Allow anon select to check if already subscribed
CREATE POLICY "Anyone can check own subscription"
ON public.stock_notify_subscriptions
FOR SELECT
USING (true);

-- Store owner can update (mark as notified)
CREATE POLICY "Store owner can update subscriptions"
ON public.stock_notify_subscriptions
FOR UPDATE
USING (auth.uid() = store_user_id);
