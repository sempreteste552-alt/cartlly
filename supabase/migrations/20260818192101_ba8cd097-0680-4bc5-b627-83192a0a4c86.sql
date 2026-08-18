-- ============ SOCIAL COMMERCE ENGINE ============

-- 1) Connections
CREATE TABLE public.social_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('instagram','facebook','tiktok','youtube','pinterest')),
  provider_account_id TEXT,
  account_name TEXT,
  account_username TEXT,
  page_id TEXT,
  status TEXT NOT NULL DEFAULT 'connected' CHECK (status IN ('connected','expiring','expired','error','disconnected')),
  token_expires_at TIMESTAMPTZ,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_error TEXT,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, provider, provider_account_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_connections TO authenticated;
GRANT ALL ON public.social_connections TO service_role;
ALTER TABLE public.social_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants manage own social connections"
ON public.social_connections FOR ALL TO authenticated
USING (auth.uid() = tenant_id OR public.has_role(auth.uid(),'super_admin'))
WITH CHECK (auth.uid() = tenant_id);

-- 2) Secrets (tokens) — NEVER readable by clients
CREATE TABLE public.social_connection_secrets (
  connection_id UUID PRIMARY KEY REFERENCES public.social_connections(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.social_connection_secrets TO service_role;
ALTER TABLE public.social_connection_secrets ENABLE ROW LEVEL SECURITY;
-- no policies for anon/authenticated: service_role only

-- 3) Tenant settings
CREATE TABLE public.tenant_social_settings (
  tenant_id UUID PRIMARY KEY,
  instagram_enabled BOOLEAN NOT NULL DEFAULT true,
  facebook_enabled BOOLEAN NOT NULL DEFAULT true,
  auto_detect_products BOOLEAN NOT NULL DEFAULT true,
  auto_generate_description BOOLEAN NOT NULL DEFAULT true,
  auto_notify BOOLEAN NOT NULL DEFAULT true,
  auto_create_draft BOOLEAN NOT NULL DEFAULT false,
  require_approval BOOLEAN NOT NULL DEFAULT true,
  auto_import_products BOOLEAN NOT NULL DEFAULT false,
  notification_channel TEXT NOT NULL DEFAULT 'panel',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_social_settings TO authenticated;
GRANT ALL ON public.tenant_social_settings TO service_role;
ALTER TABLE public.tenant_social_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenants manage own social settings"
ON public.tenant_social_settings FOR ALL TO authenticated
USING (auth.uid() = tenant_id OR public.has_role(auth.uid(),'super_admin'))
WITH CHECK (auth.uid() = tenant_id);

-- 4) Posts
CREATE TABLE public.social_media_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  connection_id UUID REFERENCES public.social_connections(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  external_post_id TEXT NOT NULL,
  post_url TEXT,
  media_url TEXT,
  caption TEXT,
  published_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  processing_status TEXT NOT NULL DEFAULT 'NEW' CHECK (processing_status IN ('NEW','PROCESSING','PROCESSED','IGNORED','ERROR')),
  detected_product BOOLEAN NOT NULL DEFAULT false,
  ai_analysis JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, provider, external_post_id)
);
GRANT SELECT, UPDATE ON public.social_media_posts TO authenticated;
GRANT ALL ON public.social_media_posts TO service_role;
ALTER TABLE public.social_media_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenants view own social posts"
ON public.social_media_posts FOR SELECT TO authenticated
USING (auth.uid() = tenant_id OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Tenants update own social posts"
ON public.social_media_posts FOR UPDATE TO authenticated
USING (auth.uid() = tenant_id) WITH CHECK (auth.uid() = tenant_id);

-- 5) Suggestions
CREATE TABLE public.social_product_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  social_post_id UUID REFERENCES public.social_media_posts(id) ON DELETE CASCADE,
  product_id UUID,
  suggested_name TEXT,
  suggested_description TEXT,
  suggested_category TEXT,
  suggested_price NUMERIC,
  suggested_brand TEXT,
  suggested_sku TEXT,
  suggested_tags TEXT[] NOT NULL DEFAULT '{}',
  image_url TEXT,
  ai_confidence NUMERIC,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','REVIEWING','APPROVED','REJECTED','IMPORTED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_product_suggestions TO authenticated;
GRANT ALL ON public.social_product_suggestions TO service_role;
ALTER TABLE public.social_product_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenants manage own suggestions"
ON public.social_product_suggestions FOR ALL TO authenticated
USING (auth.uid() = tenant_id OR public.has_role(auth.uid(),'super_admin'))
WITH CHECK (auth.uid() = tenant_id);

-- 6) Product <-> Post link
CREATE TABLE public.social_product_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  product_id UUID NOT NULL,
  social_post_id UUID REFERENCES public.social_media_posts(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  external_post_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, product_id, social_post_id)
);
GRANT SELECT, INSERT, DELETE ON public.social_product_links TO authenticated;
GRANT ALL ON public.social_product_links TO service_role;
ALTER TABLE public.social_product_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenants manage own product links"
ON public.social_product_links FOR ALL TO authenticated
USING (auth.uid() = tenant_id OR public.has_role(auth.uid(),'super_admin'))
WITH CHECK (auth.uid() = tenant_id);

-- 7) Analytics
CREATE TABLE public.social_import_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  provider TEXT NOT NULL,
  day DATE NOT NULL DEFAULT CURRENT_DATE,
  posts_detected INTEGER NOT NULL DEFAULT 0,
  products_detected INTEGER NOT NULL DEFAULT 0,
  products_imported INTEGER NOT NULL DEFAULT 0,
  products_rejected INTEGER NOT NULL DEFAULT 0,
  products_ignored INTEGER NOT NULL DEFAULT 0,
  ai_requests INTEGER NOT NULL DEFAULT 0,
  credits_consumed NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, provider, day)
);
GRANT SELECT ON public.social_import_analytics TO authenticated;
GRANT ALL ON public.social_import_analytics TO service_role;
ALTER TABLE public.social_import_analytics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenants view own social analytics"
ON public.social_import_analytics FOR SELECT TO authenticated
USING (auth.uid() = tenant_id OR public.has_role(auth.uid(),'super_admin'));

-- indexes
CREATE INDEX idx_social_posts_tenant_status ON public.social_media_posts(tenant_id, processing_status);
CREATE INDEX idx_social_suggestions_tenant_status ON public.social_product_suggestions(tenant_id, status);
CREATE INDEX idx_social_connections_tenant ON public.social_connections(tenant_id);

-- updated_at triggers
CREATE TRIGGER trg_social_connections_updated BEFORE UPDATE ON public.social_connections
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER trg_tenant_social_settings_updated BEFORE UPDATE ON public.tenant_social_settings
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER trg_social_posts_updated BEFORE UPDATE ON public.social_media_posts
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER trg_social_suggestions_updated BEFORE UPDATE ON public.social_product_suggestions
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER trg_social_analytics_updated BEFORE UPDATE ON public.social_import_analytics
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- analytics bump helper
CREATE OR REPLACE FUNCTION public.bump_social_analytics(
  p_tenant_id UUID, p_provider TEXT, p_field TEXT, p_amount NUMERIC DEFAULT 1
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.social_import_analytics (tenant_id, provider, day)
  VALUES (p_tenant_id, p_provider, CURRENT_DATE)
  ON CONFLICT (tenant_id, provider, day) DO NOTHING;

  IF p_field = 'posts_detected' THEN
    UPDATE public.social_import_analytics SET posts_detected = posts_detected + p_amount::int
      WHERE tenant_id=p_tenant_id AND provider=p_provider AND day=CURRENT_DATE;
  ELSIF p_field = 'products_detected' THEN
    UPDATE public.social_import_analytics SET products_detected = products_detected + p_amount::int
      WHERE tenant_id=p_tenant_id AND provider=p_provider AND day=CURRENT_DATE;
  ELSIF p_field = 'products_imported' THEN
    UPDATE public.social_import_analytics SET products_imported = products_imported + p_amount::int
      WHERE tenant_id=p_tenant_id AND provider=p_provider AND day=CURRENT_DATE;
  ELSIF p_field = 'products_rejected' THEN
    UPDATE public.social_import_analytics SET products_rejected = products_rejected + p_amount::int
      WHERE tenant_id=p_tenant_id AND provider=p_provider AND day=CURRENT_DATE;
  ELSIF p_field = 'products_ignored' THEN
    UPDATE public.social_import_analytics SET products_ignored = products_ignored + p_amount::int
      WHERE tenant_id=p_tenant_id AND provider=p_provider AND day=CURRENT_DATE;
  ELSIF p_field = 'ai_requests' THEN
    UPDATE public.social_import_analytics SET ai_requests = ai_requests + p_amount::int
      WHERE tenant_id=p_tenant_id AND provider=p_provider AND day=CURRENT_DATE;
  ELSIF p_field = 'credits_consumed' THEN
    UPDATE public.social_import_analytics SET credits_consumed = credits_consumed + p_amount
      WHERE tenant_id=p_tenant_id AND provider=p_provider AND day=CURRENT_DATE;
  END IF;
END;
$$;