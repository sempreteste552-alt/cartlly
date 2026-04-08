
-- 1. automation_rules: regras de automação por tenant
CREATE TABLE public.automation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL, -- tenant owner
  name text NOT NULL,
  trigger_type text NOT NULL DEFAULT 'abandoned_cart',
  -- trigger_type: abandoned_cart, wishlist_promo, wishlist_restock, wishlist_low_stock, good_morning, good_afternoon, good_evening, inactive_customer, post_purchase, restock, custom
  channel text NOT NULL DEFAULT 'push',
  -- channel: push, in_app, email, whatsapp, sms
  wait_minutes integer NOT NULL DEFAULT 20,
  message_template text,
  ai_generated boolean NOT NULL DEFAULT false,
  ai_tone text DEFAULT 'friendly',
  -- ai_tone: friendly, commercial, urgent, premium, aggressive_moderate
  target_segment text DEFAULT 'all',
  cta_text text,
  cta_link text,
  allowed_hours_start integer DEFAULT 8,
  allowed_hours_end integer DEFAULT 22,
  max_sends_per_day integer DEFAULT 3,
  cooldown_minutes integer DEFAULT 60,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage own automation rules" ON public.automation_rules FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Super admins can view all automation rules" ON public.automation_rules FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER update_automation_rules_updated_at BEFORE UPDATE ON public.automation_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. automation_executions: log de execuções
CREATE TABLE public.automation_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid REFERENCES public.automation_rules(id) ON DELETE SET NULL,
  user_id uuid NOT NULL, -- tenant owner
  customer_id uuid, -- references customers.id
  channel text NOT NULL DEFAULT 'push',
  trigger_type text NOT NULL,
  message_text text,
  ai_generated boolean NOT NULL DEFAULT false,
  sent_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  converted_at timestamptz,
  related_product_id uuid,
  related_order_id uuid,
  revenue_attributed numeric DEFAULT 0,
  status text NOT NULL DEFAULT 'sent',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.automation_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage own executions" ON public.automation_executions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Super admins can view all executions" ON public.automation_executions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE INDEX idx_automation_executions_user ON public.automation_executions(user_id);
CREATE INDEX idx_automation_executions_customer ON public.automation_executions(customer_id);
CREATE INDEX idx_automation_executions_rule ON public.automation_executions(rule_id);

-- 3. abandoned_carts: carrinhos abandonados
CREATE TABLE public.abandoned_carts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL, -- tenant owner (store)
  customer_id uuid, -- references customers.id
  session_id text, -- for anonymous users
  items jsonb NOT NULL DEFAULT '[]',
  total numeric NOT NULL DEFAULT 0,
  recovered boolean NOT NULL DEFAULT false,
  recovered_order_id uuid,
  reminder_sent_count integer NOT NULL DEFAULT 0,
  last_reminder_at timestamptz,
  abandoned_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.abandoned_carts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage own abandoned carts" ON public.abandoned_carts FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Customers can view own abandoned carts" ON public.abandoned_carts FOR SELECT TO authenticated
  USING (customer_id IN (SELECT id FROM public.customers WHERE auth_user_id = auth.uid()));
CREATE POLICY "Super admins can view all abandoned carts" ON public.abandoned_carts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE INDEX idx_abandoned_carts_user ON public.abandoned_carts(user_id);
CREATE INDEX idx_abandoned_carts_customer ON public.abandoned_carts(customer_id);

CREATE TRIGGER update_abandoned_carts_updated_at BEFORE UPDATE ON public.abandoned_carts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. customer_behavior_events: eventos de comportamento
CREATE TABLE public.customer_behavior_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL, -- tenant owner
  customer_id uuid, -- references customers.id
  session_id text,
  event_type text NOT NULL,
  -- event_type: page_view, product_view, add_to_cart, remove_from_cart, search, wishlist_add, wishlist_remove, checkout_start, purchase, login, signup
  product_id uuid,
  category_id uuid,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_behavior_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage own behavior events" ON public.customer_behavior_events FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Anon can insert behavior events" ON public.customer_behavior_events FOR INSERT TO anon
  WITH CHECK (true);
CREATE POLICY "Super admins can view all behavior events" ON public.customer_behavior_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE INDEX idx_behavior_events_user ON public.customer_behavior_events(user_id);
CREATE INDEX idx_behavior_events_customer ON public.customer_behavior_events(customer_id);
CREATE INDEX idx_behavior_events_type ON public.customer_behavior_events(event_type);
CREATE INDEX idx_behavior_events_product ON public.customer_behavior_events(product_id);

-- 5. recommendation_logs: log de recomendações
CREATE TABLE public.recommendation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL, -- tenant owner
  customer_id uuid,
  algorithm text NOT NULL DEFAULT 'history_based',
  -- algorithm: history_based, similar_products, collaborative, trending, category_based, complementary
  recommended_product_ids uuid[] NOT NULL DEFAULT '{}',
  source_product_id uuid,
  clicked_product_id uuid,
  converted boolean NOT NULL DEFAULT false,
  converted_order_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.recommendation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage own recommendation logs" ON public.recommendation_logs FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Super admins can view all recommendation logs" ON public.recommendation_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE INDEX idx_recommendation_logs_user ON public.recommendation_logs(user_id);
CREATE INDEX idx_recommendation_logs_customer ON public.recommendation_logs(customer_id);

-- 6. ai_message_templates: templates de IA
CREATE TABLE public.ai_message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL, -- tenant owner
  trigger_type text NOT NULL,
  channel text NOT NULL DEFAULT 'push',
  tone text NOT NULL DEFAULT 'friendly',
  template_text text NOT NULL,
  variables text[] DEFAULT '{}',
  -- variables: product_name, product_image, product_price, customer_name, store_name, coupon_code, cart_total
  is_default boolean NOT NULL DEFAULT false,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_message_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage own message templates" ON public.ai_message_templates FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Super admins can view all message templates" ON public.ai_message_templates FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER update_ai_message_templates_updated_at BEFORE UPDATE ON public.ai_message_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. communication_preferences: preferências de comunicação do cliente
CREATE TABLE public.communication_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL, -- references customers.id
  store_user_id uuid NOT NULL, -- tenant
  push_enabled boolean NOT NULL DEFAULT true,
  email_enabled boolean NOT NULL DEFAULT true,
  whatsapp_enabled boolean NOT NULL DEFAULT false,
  sms_enabled boolean NOT NULL DEFAULT false,
  in_app_enabled boolean NOT NULL DEFAULT true,
  quiet_hours_start integer DEFAULT 22,
  quiet_hours_end integer DEFAULT 8,
  opted_out_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(customer_id, store_user_id)
);

ALTER TABLE public.communication_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can manage own preferences" ON public.communication_preferences FOR ALL TO authenticated
  USING (customer_id IN (SELECT id FROM public.customers WHERE auth_user_id = auth.uid()))
  WITH CHECK (customer_id IN (SELECT id FROM public.customers WHERE auth_user_id = auth.uid()));
CREATE POLICY "Store owners can view customer preferences" ON public.communication_preferences FOR SELECT TO authenticated
  USING (store_user_id = auth.uid());
CREATE POLICY "Super admins can view all preferences" ON public.communication_preferences FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER update_communication_preferences_updated_at BEFORE UPDATE ON public.communication_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 8. customer_segments: segmentos de clientes
CREATE TABLE public.customer_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL, -- tenant owner
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  filter_rules jsonb NOT NULL DEFAULT '{}',
  -- filter_rules examples: {"min_orders": 5, "min_total": 500, "inactive_days": 30, "category_ids": [...]}
  auto_update boolean NOT NULL DEFAULT true,
  customer_count integer NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, slug)
);

ALTER TABLE public.customer_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage own segments" ON public.customer_segments FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Super admins can view all segments" ON public.customer_segments FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER update_customer_segments_updated_at BEFORE UPDATE ON public.customer_segments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 9. message_delivery_logs: log detalhado de entrega
CREATE TABLE public.message_delivery_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL, -- tenant owner
  execution_id uuid REFERENCES public.automation_executions(id) ON DELETE SET NULL,
  customer_id uuid,
  channel text NOT NULL,
  provider text, -- push_web, email_resend, whatsapp_api, etc.
  external_id text, -- ID do provider externo
  status text NOT NULL DEFAULT 'pending',
  -- status: pending, sent, delivered, opened, clicked, bounced, failed
  error_details text,
  sent_at timestamptz,
  delivered_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.message_delivery_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage own delivery logs" ON public.message_delivery_logs FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Super admins can view all delivery logs" ON public.message_delivery_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE INDEX idx_delivery_logs_user ON public.message_delivery_logs(user_id);
CREATE INDEX idx_delivery_logs_execution ON public.message_delivery_logs(execution_id);
CREATE INDEX idx_delivery_logs_customer ON public.message_delivery_logs(customer_id);

-- Insert default segments for new tenants (helper function)
CREATE OR REPLACE FUNCTION public.create_default_segments(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.customer_segments (user_id, name, slug, description, filter_rules) VALUES
    (_user_id, 'Carrinho Abandonado', 'abandoned_cart', 'Clientes com carrinho abandonado', '{"has_abandoned_cart": true}'),
    (_user_id, 'Wishlist Ativa', 'active_wishlist', 'Clientes com itens na lista de desejos', '{"has_wishlist": true}'),
    (_user_id, 'Clientes VIP', 'vip', 'Clientes com mais de 5 compras ou ticket acima de R$500', '{"min_orders": 5, "min_total": 500}'),
    (_user_id, 'Clientes Recorrentes', 'recurring', 'Clientes com 3+ compras', '{"min_orders": 3}'),
    (_user_id, 'Clientes Inativos', 'inactive', 'Sem compra há 30+ dias', '{"inactive_days": 30}'),
    (_user_id, 'Novos Clientes', 'new', 'Cadastrados nos últimos 7 dias', '{"registered_days": 7}')
  ON CONFLICT (user_id, slug) DO NOTHING;
END;
$$;
