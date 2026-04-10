
DROP TABLE IF EXISTS public.loyalty_transactions CASCADE;
DROP TABLE IF EXISTS public.loyalty_points CASCADE;
DROP TABLE IF EXISTS public.loyalty_config CASCADE;
DROP TABLE IF EXISTS public.saved_customer_data CASCADE;
DROP FUNCTION IF EXISTS public.award_loyalty_points(UUID, UUID, UUID, NUMERIC) CASCADE;
DROP FUNCTION IF EXISTS public.redeem_loyalty_points(UUID, UUID, INTEGER) CASCADE;

CREATE TABLE public.loyalty_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_user_id UUID NOT NULL UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  points_per_real NUMERIC NOT NULL DEFAULT 1,
  redemption_rate NUMERIC NOT NULL DEFAULT 0.01,
  min_redemption INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.loyalty_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lc_tenant_all" ON public.loyalty_config FOR ALL USING (auth.uid() = store_user_id) WITH CHECK (auth.uid() = store_user_id);
CREATE POLICY "lc_public_read" ON public.loyalty_config FOR SELECT USING (true);

CREATE TABLE public.loyalty_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL,
  store_user_id UUID NOT NULL,
  points_balance INTEGER NOT NULL DEFAULT 0,
  lifetime_points INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(customer_id, store_user_id)
);
ALTER TABLE public.loyalty_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lp_tenant_read" ON public.loyalty_points FOR SELECT USING (auth.uid() = store_user_id);
CREATE POLICY "lp_tenant_manage" ON public.loyalty_points FOR ALL USING (auth.uid() = store_user_id) WITH CHECK (auth.uid() = store_user_id);
CREATE POLICY "lp_public_read" ON public.loyalty_points FOR SELECT USING (true);

CREATE TABLE public.loyalty_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL,
  store_user_id UUID NOT NULL,
  points INTEGER NOT NULL,
  type TEXT NOT NULL DEFAULT 'earn',
  description TEXT,
  order_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.loyalty_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lt_tenant_read" ON public.loyalty_transactions FOR SELECT USING (auth.uid() = store_user_id);
CREATE POLICY "lt_tenant_insert" ON public.loyalty_transactions FOR INSERT WITH CHECK (auth.uid() = store_user_id);
CREATE POLICY "lt_public_read" ON public.loyalty_transactions FOR SELECT USING (true);

CREATE TABLE public.saved_customer_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL,
  store_user_id UUID NOT NULL,
  cpf TEXT,
  card_last_four TEXT,
  card_brand TEXT,
  default_cep TEXT,
  default_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(customer_id, store_user_id)
);
ALTER TABLE public.saved_customer_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scd_public_all" ON public.saved_customer_data FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS cost_price NUMERIC DEFAULT 0;

CREATE OR REPLACE FUNCTION public.award_loyalty_points(
  p_customer_id UUID, p_store_user_id UUID, p_order_id UUID, p_order_total NUMERIC
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_config loyalty_config%ROWTYPE; v_points INTEGER;
BEGIN
  SELECT * INTO v_config FROM loyalty_config WHERE store_user_id = p_store_user_id AND enabled = true;
  IF NOT FOUND THEN RETURN; END IF;
  v_points := FLOOR(p_order_total * v_config.points_per_real);
  IF v_points <= 0 THEN RETURN; END IF;
  INSERT INTO loyalty_points (customer_id, store_user_id, points_balance, lifetime_points)
  VALUES (p_customer_id, p_store_user_id, v_points, v_points)
  ON CONFLICT (customer_id, store_user_id)
  DO UPDATE SET points_balance = loyalty_points.points_balance + v_points, lifetime_points = loyalty_points.lifetime_points + v_points, updated_at = now();
  INSERT INTO loyalty_transactions (customer_id, store_user_id, points, type, description, order_id)
  VALUES (p_customer_id, p_store_user_id, v_points, 'earn', 'Pontos por compra', p_order_id);
END; $$;

CREATE OR REPLACE FUNCTION public.redeem_loyalty_points(
  p_customer_id UUID, p_store_user_id UUID, p_points INTEGER
) RETURNS NUMERIC LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_config loyalty_config%ROWTYPE; v_current INTEGER; v_discount NUMERIC;
BEGIN
  SELECT * INTO v_config FROM loyalty_config WHERE store_user_id = p_store_user_id AND enabled = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Programa de fidelidade não ativo'; END IF;
  IF p_points < v_config.min_redemption THEN RAISE EXCEPTION 'Mínimo de pontos: %', v_config.min_redemption; END IF;
  SELECT points_balance INTO v_current FROM loyalty_points WHERE customer_id = p_customer_id AND store_user_id = p_store_user_id;
  IF v_current IS NULL OR v_current < p_points THEN RAISE EXCEPTION 'Pontos insuficientes'; END IF;
  v_discount := p_points * v_config.redemption_rate;
  UPDATE loyalty_points SET points_balance = points_balance - p_points, updated_at = now() WHERE customer_id = p_customer_id AND store_user_id = p_store_user_id;
  INSERT INTO loyalty_transactions (customer_id, store_user_id, points, type, description) VALUES (p_customer_id, p_store_user_id, -p_points, 'redeem', 'Resgate de pontos');
  RETURN v_discount;
END; $$;
