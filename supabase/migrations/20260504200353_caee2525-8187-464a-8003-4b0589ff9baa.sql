-- ============================================
-- 1. EXTEND tenant_ai_balances
-- ============================================
ALTER TABLE public.tenant_ai_balances
  ADD COLUMN IF NOT EXISTS monthly_credits_granted integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monthly_credits_used integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS topup_credits integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS overage_credits integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_period_start timestamptz NOT NULL DEFAULT date_trunc('month', now()),
  ADD COLUMN IF NOT EXISTS current_period_end timestamptz NOT NULL DEFAULT (date_trunc('month', now()) + interval '1 month');

-- ============================================
-- 2. EXTEND tenant_ai_settings
-- ============================================
ALTER TABLE public.tenant_ai_settings
  ADD COLUMN IF NOT EXISTS monthly_credit_limit integer NOT NULL DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS hard_limit_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS soft_limit_alerts_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS storefront_chat_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS product_ai_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS catalog_ai_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS admin_assistant_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS push_ai_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS ceo_brain_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS coupons_ai_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS translation_ai_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS rag_memory_enabled boolean NOT NULL DEFAULT true;

-- ============================================
-- 3. EXTEND ai_usage_logs
-- ============================================
ALTER TABLE public.ai_usage_logs
  ADD COLUMN IF NOT EXISTS credits_charged integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS latency_ms integer,
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_store_user_created
  ON public.ai_usage_logs(store_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_feature
  ON public.ai_usage_logs(feature);

-- ============================================
-- 4. ai_credit_transactions
-- ============================================
CREATE TABLE IF NOT EXISTS public.ai_credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('grant','consume','refund','topup','reset','overage','adjustment')),
  amount integer NOT NULL,
  balance_after integer NOT NULL,
  reason text,
  feature text,
  related_usage_log_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_credit_tx_tenant_created
  ON public.ai_credit_transactions(tenant_id, created_at DESC);

ALTER TABLE public.ai_credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants view own credit tx"
  ON public.ai_credit_transactions FOR SELECT
  USING (tenant_id = auth.uid() OR EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin'
  ));

CREATE POLICY "Super admins manage credit tx"
  ON public.ai_credit_transactions FOR ALL
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin'));

-- ============================================
-- 5. tenant_ai_feature_limits
-- ============================================
CREATE TABLE IF NOT EXISTS public.tenant_ai_feature_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  monthly_credit_limit integer,
  monthly_request_limit integer,
  daily_request_limit integer,
  per_user_daily_limit integer,
  per_customer_daily_limit integer,
  use_cheaper_model_after_percent integer DEFAULT 90,
  block_after_limit boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, feature)
);

ALTER TABLE public.tenant_ai_feature_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants view own feature limits"
  ON public.tenant_ai_feature_limits FOR SELECT
  USING (tenant_id = auth.uid() OR EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin'
  ));

CREATE POLICY "Tenants update own feature limits"
  ON public.tenant_ai_feature_limits FOR UPDATE
  USING (tenant_id = auth.uid());

CREATE POLICY "Tenants insert own feature limits"
  ON public.tenant_ai_feature_limits FOR INSERT
  WITH CHECK (tenant_id = auth.uid());

CREATE POLICY "Super admins manage feature limits"
  ON public.tenant_ai_feature_limits FOR ALL
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin'));

CREATE TRIGGER set_updated_at_tenant_ai_feature_limits
  BEFORE UPDATE ON public.tenant_ai_feature_limits
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================
-- 6. ai_alerts
-- ============================================
CREATE TABLE IF NOT EXISTS public.ai_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alert_type text NOT NULL,
  threshold_percent integer,
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warning','critical','blocking')),
  title text NOT NULL,
  message text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_alerts_tenant_unread
  ON public.ai_alerts(tenant_id, read, created_at DESC);

ALTER TABLE public.ai_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants view own ai alerts"
  ON public.ai_alerts FOR SELECT
  USING (tenant_id = auth.uid() OR EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin'
  ));

CREATE POLICY "Tenants update own ai alerts"
  ON public.ai_alerts FOR UPDATE
  USING (tenant_id = auth.uid());

CREATE POLICY "Super admins manage ai alerts"
  ON public.ai_alerts FOR ALL
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin'));

-- ============================================
-- 7. RPC: get_tenant_ai_usage_summary
-- ============================================
CREATE OR REPLACE FUNCTION public.get_tenant_ai_usage_summary(p_tenant_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
  v_balance record;
  v_settings record;
  v_period_start timestamptz;
  v_logs_agg record;
  v_credits_used integer;
  v_credits_limit integer;
  v_topup integer;
  v_pct numeric;
  v_alert_level text;
  v_days_in_month numeric;
  v_day_of_month numeric;
  v_projected numeric;
BEGIN
  v_tenant := COALESCE(p_tenant_id, auth.uid());
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'no tenant'; END IF;

  -- Authorization: caller must be tenant or super admin
  IF v_tenant <> auth.uid() AND NOT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin'
  ) THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT * INTO v_balance FROM tenant_ai_balances WHERE tenant_id = v_tenant;
  SELECT * INTO v_settings FROM tenant_ai_settings WHERE tenant_id = v_tenant;

  v_period_start := COALESCE(v_balance.current_period_start, date_trunc('month', now()));
  v_credits_used := COALESCE(v_balance.monthly_credits_used, 0);
  v_credits_limit := COALESCE(v_settings.monthly_credit_limit, 1000);
  v_topup := COALESCE(v_balance.topup_credits, 0);

  SELECT
    COUNT(*) as total_requests,
    COALESCE(SUM(total_tokens),0) as total_tokens,
    COALESCE(SUM(estimated_cost),0) as total_cost,
    COALESCE(SUM(images_count),0) as total_images,
    COUNT(*) FILTER (WHERE status <> 'success') as errors
  INTO v_logs_agg
  FROM ai_usage_logs
  WHERE store_user_id = v_tenant AND created_at >= v_period_start;

  v_pct := CASE WHEN v_credits_limit > 0 THEN (v_credits_used::numeric / v_credits_limit) * 100 ELSE 0 END;
  v_alert_level := CASE
    WHEN v_pct >= 100 THEN 'blocking'
    WHEN v_pct >= 90 THEN 'critical'
    WHEN v_pct >= 75 THEN 'warning'
    WHEN v_pct >= 50 THEN 'info'
    ELSE 'ok'
  END;

  v_days_in_month := EXTRACT(DAY FROM (date_trunc('month', now()) + interval '1 month - 1 day'));
  v_day_of_month := GREATEST(EXTRACT(DAY FROM now()), 1);
  v_projected := CASE WHEN v_day_of_month > 0 THEN (v_credits_used::numeric / v_day_of_month) * v_days_in_month ELSE 0 END;

  RETURN jsonb_build_object(
    'tenant_id', v_tenant,
    'ai_enabled', COALESCE(v_settings.is_ai_enabled, true),
    'period_start', v_period_start,
    'monthly_credit_limit', v_credits_limit,
    'monthly_credits_used', v_credits_used,
    'topup_credits', v_topup,
    'available_credits', GREATEST(v_credits_limit - v_credits_used, 0) + v_topup,
    'overage_credits', COALESCE(v_balance.overage_credits, 0),
    'usage_percent', ROUND(v_pct, 1),
    'alert_level', v_alert_level,
    'projected_credits_eom', ROUND(v_projected, 0),
    'hard_limit_enabled', COALESCE(v_settings.hard_limit_enabled, false),
    'total_requests', v_logs_agg.total_requests,
    'total_tokens', v_logs_agg.total_tokens,
    'total_cost_usd', v_logs_agg.total_cost,
    'total_images', v_logs_agg.total_images,
    'errors', v_logs_agg.errors
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_tenant_ai_usage_summary(uuid) TO authenticated;

-- ============================================
-- 8. RPC: consume_ai_credits (called by edge functions)
-- ============================================
CREATE OR REPLACE FUNCTION public.consume_ai_credits(
  p_tenant_id uuid,
  p_credits integer,
  p_feature text,
  p_usage_log_id uuid DEFAULT NULL,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance record;
  v_settings record;
  v_remaining integer;
  v_topup integer;
  v_used integer;
  v_overage integer := 0;
  v_consumed_topup integer := 0;
  v_consumed_monthly integer := 0;
  v_pct numeric;
  v_limit integer;
  v_prev_pct numeric;
  v_threshold integer;
BEGIN
  -- Ensure rows exist
  INSERT INTO tenant_ai_balances(tenant_id) VALUES (p_tenant_id)
    ON CONFLICT (tenant_id) DO NOTHING;
  INSERT INTO tenant_ai_settings(tenant_id) VALUES (p_tenant_id)
    ON CONFLICT (tenant_id) DO NOTHING;

  SELECT * INTO v_balance FROM tenant_ai_balances WHERE tenant_id = p_tenant_id FOR UPDATE;
  SELECT * INTO v_settings FROM tenant_ai_settings WHERE tenant_id = p_tenant_id;

  v_limit := COALESCE(v_settings.monthly_credit_limit, 1000);
  v_used := COALESCE(v_balance.monthly_credits_used, 0);
  v_topup := COALESCE(v_balance.topup_credits, 0);
  v_remaining := GREATEST(v_limit - v_used, 0);

  v_prev_pct := CASE WHEN v_limit > 0 THEN (v_used::numeric / v_limit) * 100 ELSE 0 END;

  -- Consume from monthly first, then topup, then overage
  IF p_credits <= v_remaining THEN
    v_consumed_monthly := p_credits;
  ELSE
    v_consumed_monthly := v_remaining;
    DECLARE rest integer := p_credits - v_remaining; BEGIN
      IF rest <= v_topup THEN
        v_consumed_topup := rest;
      ELSE
        v_consumed_topup := v_topup;
        v_overage := rest - v_topup;
        IF COALESCE(v_settings.hard_limit_enabled, false) THEN
          RETURN jsonb_build_object(
            'allowed', false,
            'reason', 'INSUFFICIENT_AI_CREDITS',
            'available', v_remaining + v_topup,
            'requested', p_credits
          );
        END IF;
      END IF;
    END;
  END IF;

  UPDATE tenant_ai_balances SET
    monthly_credits_used = monthly_credits_used + v_consumed_monthly,
    topup_credits = topup_credits - v_consumed_topup,
    overage_credits = overage_credits + v_overage,
    updated_at = now()
  WHERE tenant_id = p_tenant_id;

  INSERT INTO ai_credit_transactions(tenant_id, type, amount, balance_after, reason, feature, related_usage_log_id)
  VALUES (
    p_tenant_id,
    CASE WHEN v_overage > 0 THEN 'overage' ELSE 'consume' END,
    -p_credits,
    GREATEST(v_limit - (v_used + v_consumed_monthly), 0) + (v_topup - v_consumed_topup),
    COALESCE(p_reason, 'AI feature usage'),
    p_feature,
    p_usage_log_id
  );

  -- Check thresholds for alerts
  v_pct := CASE WHEN v_limit > 0 THEN ((v_used + v_consumed_monthly)::numeric / v_limit) * 100 ELSE 0 END;

  IF COALESCE(v_settings.soft_limit_alerts_enabled, true) THEN
    FOR v_threshold IN SELECT unnest(ARRAY[50,75,90,100]) LOOP
      IF v_prev_pct < v_threshold AND v_pct >= v_threshold THEN
        INSERT INTO ai_alerts(tenant_id, alert_type, threshold_percent, severity, title, message)
        VALUES (
          p_tenant_id,
          'usage_threshold',
          v_threshold,
          CASE
            WHEN v_threshold >= 100 THEN 'blocking'
            WHEN v_threshold >= 90 THEN 'critical'
            WHEN v_threshold >= 75 THEN 'warning'
            ELSE 'info'
          END,
          CASE
            WHEN v_threshold >= 100 THEN 'Limite de cr\u00e9ditos de IA atingido'
            WHEN v_threshold >= 90 THEN 'Voc\u00ea atingiu 90% do limite de IA'
            WHEN v_threshold >= 75 THEN 'Voc\u00ea atingiu 75% do limite de IA'
            ELSE 'Voc\u00ea atingiu 50% do limite de IA'
          END,
          CASE
            WHEN v_threshold >= 100 THEN 'Fa\u00e7a upgrade ou ative cota extra para continuar usando IA sem excedentes.'
            WHEN v_threshold >= 90 THEN 'Apenas 10% de cr\u00e9ditos restantes este m\u00eas. Considere fazer upgrade.'
            WHEN v_threshold >= 75 THEN 'Voc\u00ea j\u00e1 usou 75% dos cr\u00e9ditos do plano.'
            ELSE 'Voc\u00ea j\u00e1 consumiu metade dos cr\u00e9ditos de IA do plano.'
          END
        );
      END IF;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'consumed_monthly', v_consumed_monthly,
    'consumed_topup', v_consumed_topup,
    'overage', v_overage,
    'usage_percent', ROUND(v_pct, 1)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.consume_ai_credits(uuid, integer, text, uuid, text) TO service_role;

-- ============================================
-- 9. RPC: grant_ai_credits (top-up / monthly reset)
-- ============================================
CREATE OR REPLACE FUNCTION public.grant_ai_credits(
  p_tenant_id uuid,
  p_amount integer,
  p_type text DEFAULT 'topup',
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance record;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  INSERT INTO tenant_ai_balances(tenant_id) VALUES (p_tenant_id)
    ON CONFLICT (tenant_id) DO NOTHING;

  IF p_type = 'reset' THEN
    UPDATE tenant_ai_balances SET
      monthly_credits_used = 0,
      overage_credits = 0,
      current_period_start = date_trunc('month', now()),
      current_period_end = date_trunc('month', now()) + interval '1 month',
      updated_at = now()
    WHERE tenant_id = p_tenant_id;
  ELSE
    UPDATE tenant_ai_balances SET
      topup_credits = topup_credits + p_amount,
      updated_at = now()
    WHERE tenant_id = p_tenant_id;
  END IF;

  SELECT * INTO v_balance FROM tenant_ai_balances WHERE tenant_id = p_tenant_id;

  INSERT INTO ai_credit_transactions(tenant_id, type, amount, balance_after, reason, created_by)
  VALUES (p_tenant_id, p_type, p_amount, COALESCE(v_balance.topup_credits,0), p_reason, auth.uid());

  RETURN jsonb_build_object('ok', true, 'topup_credits', v_balance.topup_credits);
END;
$$;

GRANT EXECUTE ON FUNCTION public.grant_ai_credits(uuid, integer, text, text) TO authenticated;