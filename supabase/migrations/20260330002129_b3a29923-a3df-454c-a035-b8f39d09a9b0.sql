
-- Fix the security definer view by making it SECURITY INVOKER (safe)
DROP VIEW IF EXISTS public.store_settings_public;
CREATE VIEW public.store_settings_public
WITH (security_invoker = true)
AS
SELECT
  id, user_id, store_name, logo_url, primary_color, secondary_color, accent_color,
  custom_domain, store_address, store_phone, store_whatsapp, google_maps_url,
  store_description, facebook_url, instagram_url, twitter_url, youtube_url, tiktok_url,
  store_location, store_slug, store_open, store_blocked, store_cep,
  sell_via_whatsapp, payment_pix, payment_credit_card, payment_debit_card, payment_boleto,
  max_installments, shipping_enabled, shipping_base_cost, shipping_per_km,
  shipping_free_above, shipping_flat_rate, low_stock_threshold,
  marquee_enabled, marquee_text, marquee_speed, marquee_bg_color, marquee_text_color,
  button_color, button_text_color, header_bg_color, footer_bg_color, footer_text_color,
  logo_size, admin_primary_color, admin_accent_color,
  payment_gateway, gateway_public_key, gateway_environment,
  welcome_coupon_enabled, welcome_coupon_discount_type, welcome_coupon_discount_value,
  welcome_coupon_expires_days, welcome_coupon_min_order,
  domain_status, domain_last_check,
  created_at, updated_at
FROM public.store_settings;
