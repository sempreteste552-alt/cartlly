
-- ================================================================
-- 1. STORE THEME CONFIG
-- ================================================================
CREATE TABLE public.store_theme_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  favicon_url TEXT,
  font_heading TEXT NOT NULL DEFAULT 'Inter',
  font_body TEXT NOT NULL DEFAULT 'Inter',
  card_border_radius INTEGER NOT NULL DEFAULT 8,
  card_shadow TEXT NOT NULL DEFAULT 'sm',
  layout_width TEXT NOT NULL DEFAULT 'contained',
  product_grid_columns INTEGER NOT NULL DEFAULT 4,
  product_grid_columns_mobile INTEGER NOT NULL DEFAULT 2,
  product_grid_gap INTEGER NOT NULL DEFAULT 16,
  header_style TEXT NOT NULL DEFAULT 'standard',
  footer_style TEXT NOT NULL DEFAULT 'standard',
  custom_css TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.store_theme_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own theme config" ON public.store_theme_config FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own theme config" ON public.store_theme_config FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own theme config" ON public.store_theme_config FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Super admins can manage all theme config" ON public.store_theme_config FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin')) WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Anon can view theme config" ON public.store_theme_config FOR SELECT TO anon USING (true);

CREATE TRIGGER update_store_theme_config_updated_at BEFORE UPDATE ON public.store_theme_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ================================================================
-- 2. STORE HOME SECTIONS
-- ================================================================
CREATE TABLE public.store_home_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  section_type TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  title TEXT,
  subtitle TEXT,
  description TEXT,
  image_url TEXT,
  video_url TEXT,
  button_text TEXT,
  button_link TEXT,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  desktop_visible BOOLEAN NOT NULL DEFAULT true,
  mobile_visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.store_home_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own home sections" ON public.store_home_sections FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own home sections" ON public.store_home_sections FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own home sections" ON public.store_home_sections FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own home sections" ON public.store_home_sections FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Super admins can manage all home sections" ON public.store_home_sections FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin')) WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Anon can view enabled home sections" ON public.store_home_sections FOR SELECT TO anon USING (enabled = true);

CREATE INDEX idx_store_home_sections_user_order ON public.store_home_sections (user_id, sort_order);

CREATE TRIGGER update_store_home_sections_updated_at BEFORE UPDATE ON public.store_home_sections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ================================================================
-- 3. STORE MARKETING CONFIG
-- ================================================================
CREATE TABLE public.store_marketing_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  announcement_bar_enabled BOOLEAN NOT NULL DEFAULT false,
  announcement_bar_text TEXT,
  announcement_bar_bg_color TEXT NOT NULL DEFAULT '#000000',
  announcement_bar_text_color TEXT NOT NULL DEFAULT '#ffffff',
  announcement_bar_link TEXT,
  popup_coupon_enabled BOOLEAN NOT NULL DEFAULT false,
  popup_coupon_code TEXT,
  popup_coupon_title TEXT,
  popup_coupon_description TEXT,
  popup_coupon_image_url TEXT,
  popup_coupon_delay_seconds INTEGER NOT NULL DEFAULT 5,
  countdown_enabled BOOLEAN NOT NULL DEFAULT false,
  countdown_end_date TIMESTAMPTZ,
  countdown_text TEXT,
  countdown_bg_color TEXT NOT NULL DEFAULT '#dc2626',
  countdown_text_color TEXT NOT NULL DEFAULT '#ffffff',
  free_shipping_bar_enabled BOOLEAN NOT NULL DEFAULT false,
  free_shipping_threshold NUMERIC NOT NULL DEFAULT 0,
  free_shipping_bar_color TEXT NOT NULL DEFAULT '#16a34a',
  trust_badges_enabled BOOLEAN NOT NULL DEFAULT false,
  trust_badges JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.store_marketing_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own marketing config" ON public.store_marketing_config FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own marketing config" ON public.store_marketing_config FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own marketing config" ON public.store_marketing_config FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Super admins can manage all marketing config" ON public.store_marketing_config FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin')) WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Anon can view marketing config" ON public.store_marketing_config FOR SELECT TO anon USING (true);

CREATE TRIGGER update_store_marketing_config_updated_at BEFORE UPDATE ON public.store_marketing_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ================================================================
-- 4. STORE PRODUCT PAGE CONFIG
-- ================================================================
CREATE TABLE public.store_product_page_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  enable_video_gallery BOOLEAN NOT NULL DEFAULT false,
  enable_image_zoom BOOLEAN NOT NULL DEFAULT true,
  enable_sticky_add_to_cart BOOLEAN NOT NULL DEFAULT false,
  enable_reviews BOOLEAN NOT NULL DEFAULT true,
  enable_faq BOOLEAN NOT NULL DEFAULT false,
  enable_size_guide BOOLEAN NOT NULL DEFAULT false,
  size_guide_content TEXT,
  enable_related_products BOOLEAN NOT NULL DEFAULT true,
  enable_buy_together BOOLEAN NOT NULL DEFAULT false,
  enable_recently_viewed BOOLEAN NOT NULL DEFAULT false,
  enable_category_best_sellers BOOLEAN NOT NULL DEFAULT false,
  enable_stock_urgency BOOLEAN NOT NULL DEFAULT false,
  stock_urgency_threshold INTEGER NOT NULL DEFAULT 5,
  enable_delivery_estimation BOOLEAN NOT NULL DEFAULT false,
  delivery_estimation_text TEXT NOT NULL DEFAULT '3-7 dias úteis',
  enable_trust_badges BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.store_product_page_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own product page config" ON public.store_product_page_config FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own product page config" ON public.store_product_page_config FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own product page config" ON public.store_product_page_config FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Super admins can manage all product page config" ON public.store_product_page_config FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin')) WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Anon can view product page config" ON public.store_product_page_config FOR SELECT TO anon USING (true);

CREATE TRIGGER update_store_product_page_config_updated_at BEFORE UPDATE ON public.store_product_page_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
