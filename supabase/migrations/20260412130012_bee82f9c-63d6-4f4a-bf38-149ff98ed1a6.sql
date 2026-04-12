
-- Create a safe view excluding gateway_secret_key
CREATE OR REPLACE VIEW public.store_settings_safe AS
SELECT 
  id, user_id, store_name, logo_url, primary_color, secondary_color, accent_color,
  payment_pix, payment_boleto, payment_credit_card, payment_debit_card,
  custom_domain, created_at, updated_at, payment_gateway, gateway_public_key,
  gateway_environment, store_address, store_phone, store_whatsapp, google_maps_url,
  store_description, facebook_url, instagram_url, tiktok_url, twitter_url, youtube_url,
  sell_via_whatsapp, store_open, store_location, store_slug, admin_primary_color,
  admin_accent_color, shipping_base_cost, shipping_per_km, shipping_free_above,
  shipping_flat_rate, shipping_enabled, low_stock_threshold, store_cep,
  marquee_enabled, marquee_text, marquee_speed, marquee_bg_color, marquee_text_color,
  logo_size, button_color, button_text_color, header_bg_color, footer_bg_color,
  footer_text_color, max_installments, store_blocked, admin_blocked,
  welcome_coupon_enabled, welcome_coupon_discount_type, welcome_coupon_discount_value,
  welcome_coupon_min_order, welcome_coupon_expires_days, domain_status, domain_last_check,
  page_bg_color, header_text_color, banner_mobile_format, favicon_url, is_verified,
  ai_name, ai_avatar_url, domain_verify_details, ai_chat_tone, store_category,
  ai_last_analysis_at, promo_banner_enabled, promo_banner_text, promo_banner_link, language
FROM public.store_settings;

GRANT SELECT ON public.store_settings_safe TO authenticated;
