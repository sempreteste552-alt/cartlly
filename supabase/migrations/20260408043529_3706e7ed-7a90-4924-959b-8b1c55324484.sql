
-- =============================================
-- 1. STORE_SETTINGS: Fix exposed gateway keys
-- =============================================

-- Drop the dangerous anon SELECT policy on base table
DROP POLICY IF EXISTS "Anon can view store settings via view" ON public.store_settings;

-- Recreate base table policy: deny direct anon SELECT
-- (authenticated users already have their own policies)

-- Recreate view WITHOUT gateway keys
DROP VIEW IF EXISTS public.store_settings_public;

CREATE VIEW public.store_settings_public AS
SELECT 
  id, user_id, store_name, logo_url, primary_color, secondary_color, accent_color,
  custom_domain, store_address, store_phone, store_whatsapp, google_maps_url,
  store_description, facebook_url, instagram_url, tiktok_url, twitter_url, youtube_url,
  store_location, store_slug, store_cep, admin_primary_color, admin_accent_color,
  store_open, sell_via_whatsapp, updated_at, created_at, domain_status, domain_last_check,
  shipping_enabled, shipping_base_cost, shipping_per_km, shipping_flat_rate, shipping_free_above,
  payment_gateway, gateway_environment,
  payment_pix, payment_credit_card, payment_debit_card, payment_boleto, max_installments,
  logo_size, marquee_enabled, marquee_speed, marquee_text, marquee_bg_color, marquee_text_color,
  button_color, button_text_color, header_bg_color, footer_bg_color, footer_text_color,
  low_stock_threshold, store_blocked, admin_blocked,
  welcome_coupon_enabled, welcome_coupon_discount_type, welcome_coupon_discount_value,
  welcome_coupon_expires_days, welcome_coupon_min_order,
  page_bg_color, header_text_color
FROM public.store_settings;

-- Grant SELECT on view to anon and authenticated
GRANT SELECT ON public.store_settings_public TO anon;
GRANT SELECT ON public.store_settings_public TO authenticated;

-- =============================================
-- 2. ORDERS: Restrict anon INSERT
-- =============================================

DROP POLICY IF EXISTS "Anon can create orders" ON public.orders;

CREATE POLICY "Anon can create orders for existing stores"
ON public.orders FOR INSERT TO anon
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.store_settings ss WHERE ss.user_id = orders.user_id
  )
);

-- =============================================
-- 3. PAYMENTS: Add ownership check on INSERT
-- =============================================

DROP POLICY IF EXISTS "Auth can create payments" ON public.payments;

CREATE POLICY "Auth can create payments for accessible orders"
ON public.payments FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = payments.order_id
      AND o.user_id = payments.user_id
  )
);

-- =============================================
-- 4. PRODUCT_REVIEWS: Protect customer emails
-- =============================================

DROP POLICY IF EXISTS "Authenticated can view reviews" ON public.product_reviews;

-- Store owners can see all reviews for their products (including emails)
CREATE POLICY "Store owners can view their product reviews"
ON public.product_reviews FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_reviews.product_id AND p.user_id = auth.uid()
  )
);

-- Everyone else uses the public view (no email column) - grant to anon too
GRANT SELECT ON public.product_reviews_public TO anon;
GRANT SELECT ON public.product_reviews_public TO authenticated;

-- =============================================
-- 5. STORE_MARKETING_CONFIG: Hide coupon codes from anon
-- =============================================

DROP POLICY IF EXISTS "Anon can view marketing config" ON public.store_marketing_config;

-- Create a public view without coupon code
CREATE OR REPLACE VIEW public.store_marketing_config_public AS
SELECT 
  id, user_id,
  announcement_bar_enabled, announcement_bar_text, announcement_bar_bg_color,
  announcement_bar_text_color, announcement_bar_link,
  popup_coupon_enabled, popup_coupon_title, popup_coupon_description,
  popup_coupon_image_url, popup_coupon_delay_seconds,
  countdown_enabled, countdown_end_date, countdown_text,
  countdown_bg_color, countdown_text_color,
  free_shipping_bar_enabled, free_shipping_threshold, free_shipping_bar_color,
  trust_badges_enabled, trust_badges,
  created_at, updated_at
FROM public.store_marketing_config;

GRANT SELECT ON public.store_marketing_config_public TO anon;
GRANT SELECT ON public.store_marketing_config_public TO authenticated;

-- =============================================
-- 6. SECURITY_SETTINGS: Restrict to super_admin
-- =============================================

DROP POLICY IF EXISTS "Anyone can read security settings" ON public.security_settings;

CREATE POLICY "Only super admins can read security settings"
ON public.security_settings FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));
