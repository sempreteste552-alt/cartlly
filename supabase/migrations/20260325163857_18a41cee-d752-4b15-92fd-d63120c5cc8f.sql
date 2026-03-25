
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS gateway_secret_key text DEFAULT NULL;

CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  gateway text NOT NULL,
  gateway_payment_id text,
  method text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  amount numeric NOT NULL DEFAULT 0,
  pix_qr_code text,
  pix_qr_code_base64 text,
  pix_expiration timestamp with time zone,
  boleto_url text,
  boleto_barcode text,
  boleto_expiration timestamp with time zone,
  card_last_four text,
  card_brand text,
  raw_response jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store owners can view payments" ON public.payments
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Anyone can create payments" ON public.payments
  FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "Auth can create payments" ON public.payments
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Store owners can update payments" ON public.payments
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Anyone can create status history" ON public.order_status_history
  FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "Anyone can update coupon usage" ON public.coupons
  FOR UPDATE TO anon
  USING (active = true);
