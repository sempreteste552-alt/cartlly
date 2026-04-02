-- Recreate the view WITHOUT security_invoker so it uses the view owner (postgres)
-- which bypasses RLS. The view already excludes gateway_secret_key and other sensitive fields.
DROP VIEW IF EXISTS public.store_settings_public;

CREATE VIEW public.store_settings_public AS
SELECT
  id, user_id, store_name, logo_url, primary_color, secondary_color, accent_color,
  custom_domain, store_address, store_phone, store_whatsapp, google_maps_url,
  store_description, facebook_url, instagram_url, tiktok_url, twitter_url, youtube_url,
  store_location, store_slug, store_cep, admin_primary_color, admin_accent_color,
  store_open, sell_via_whatsapp, updated_at, created_at, domain_status, domain_last_check,
  shipping_enabled, shipping_base_cost, shipping_per_km, shipping_flat_rate, shipping_free_above,
  payment_gateway, gateway_public_key, gateway_environment,
  payment_pix, payment_credit_card, payment_debit_card, payment_boleto, max_installments,
  logo_size, marquee_enabled, marquee_speed, marquee_text, marquee_bg_color, marquee_text_color,
  button_color, button_text_color, header_bg_color, footer_bg_color, footer_text_color,
  low_stock_threshold, store_blocked,
  welcome_coupon_enabled, welcome_coupon_discount_type, welcome_coupon_discount_value,
  welcome_coupon_expires_days, welcome_coupon_min_order
FROM public.store_settings;

-- Grant access to both anon and authenticated roles
GRANT SELECT ON public.store_settings_public TO anon, authenticated;