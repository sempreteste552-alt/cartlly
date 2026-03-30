
-- 1. Drop broad storage policies (keeping only the path-restricted ones)
DROP POLICY IF EXISTS "Users can delete store assets" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own product images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update store assets" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own product images" ON storage.objects;

-- 2. Restrict anon SELECT on product_reviews (remove direct table access, use view instead)
DROP POLICY IF EXISTS "Anyone can view reviews" ON public.product_reviews;
DROP POLICY IF EXISTS "Anyone can create reviews" ON public.product_reviews;

-- Re-create anon INSERT with basic validation (no anon SELECT on raw table)
CREATE POLICY "Anon can create reviews"
  ON public.product_reviews FOR INSERT TO anon
  WITH CHECK (customer_email IS NULL);

-- 3. Recreate product_reviews_public view as SECURITY INVOKER
DROP VIEW IF EXISTS public.product_reviews_public;
CREATE VIEW public.product_reviews_public
  WITH (security_invoker = true) AS
  SELECT id, product_id, rating, comment, customer_name, created_at
  FROM public.product_reviews;

-- Grant anon SELECT on the view
GRANT SELECT ON public.product_reviews_public TO anon;
GRANT SELECT ON public.product_reviews_public TO authenticated;

-- 4. Recreate store_settings_public view as SECURITY INVOKER
DROP VIEW IF EXISTS public.store_settings_public;
CREATE VIEW public.store_settings_public
  WITH (security_invoker = true) AS
  SELECT id, user_id, store_name, logo_url, primary_color, secondary_color, accent_color,
    custom_domain, store_address, store_phone, store_whatsapp, google_maps_url,
    store_description, facebook_url, instagram_url, tiktok_url, twitter_url, youtube_url,
    store_location, store_slug, store_cep, admin_primary_color, admin_accent_color,
    store_open, sell_via_whatsapp, updated_at, created_at, domain_status, domain_last_check,
    shipping_enabled, shipping_base_cost, shipping_per_km, shipping_flat_rate, shipping_free_above,
    payment_gateway, gateway_public_key, gateway_environment,
    payment_pix, payment_credit_card, payment_debit_card, payment_boleto,
    max_installments, logo_size, marquee_enabled, marquee_speed, marquee_text,
    marquee_bg_color, marquee_text_color, button_color, button_text_color,
    header_bg_color, footer_bg_color, footer_text_color, low_stock_threshold,
    store_blocked, welcome_coupon_enabled, welcome_coupon_discount_type,
    welcome_coupon_discount_value, welcome_coupon_expires_days, welcome_coupon_min_order
  FROM public.store_settings;

-- Need anon SELECT on store_settings for the view to work (SECURITY INVOKER)
CREATE POLICY "Anon can view store settings via view"
  ON public.store_settings FOR SELECT TO anon
  USING (true);

GRANT SELECT ON public.store_settings_public TO anon;
GRANT SELECT ON public.store_settings_public TO authenticated;

-- 5. Tighten admin_notifications: NULL target only visible to super_admins
DROP POLICY IF EXISTS "Users can view own notifications" ON public.admin_notifications;
DROP POLICY IF EXISTS "Users can mark own notifications read" ON public.admin_notifications;

CREATE POLICY "Users can view targeted notifications"
  ON public.admin_notifications FOR SELECT TO authenticated
  USING (target_user_id = auth.uid());

CREATE POLICY "Users can view broadcast notifications"
  ON public.admin_notifications FOR SELECT TO authenticated
  USING (target_user_id IS NULL AND has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Users can mark targeted notifications read"
  ON public.admin_notifications FOR UPDATE TO authenticated
  USING (target_user_id = auth.uid())
  WITH CHECK (target_user_id = auth.uid());

-- 6. Remove anon INSERT on payments (payments should go through edge function)
DROP POLICY IF EXISTS "Anyone can create payments" ON public.payments;
