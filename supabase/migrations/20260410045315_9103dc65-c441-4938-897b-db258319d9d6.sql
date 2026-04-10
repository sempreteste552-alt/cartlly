
CREATE OR REPLACE VIEW public.store_settings_public AS
WITH latest_sub AS (
  SELECT DISTINCT ON (user_id) user_id, status, plan_id, trial_ends_at
  FROM tenant_subscriptions
  ORDER BY user_id, updated_at DESC
)
SELECT
  s.id, s.user_id, s.store_name, s.logo_url, s.favicon_url,
  s.primary_color, s.secondary_color, s.accent_color, s.custom_domain,
  s.store_address, s.store_phone, s.store_whatsapp, s.google_maps_url,
  s.store_description, s.facebook_url, s.instagram_url, s.tiktok_url,
  s.twitter_url, s.youtube_url, s.store_location, s.store_slug, s.store_cep,
  s.admin_primary_color, s.admin_accent_color, s.store_open, s.sell_via_whatsapp,
  s.updated_at, s.created_at, s.domain_status, s.domain_last_check,
  s.shipping_enabled, s.shipping_base_cost, s.shipping_per_km, s.shipping_flat_rate,
  s.shipping_free_above, s.payment_gateway, s.gateway_public_key, s.gateway_environment,
  s.payment_pix, s.payment_credit_card, s.payment_debit_card, s.payment_boleto,
  s.max_installments, s.logo_size, s.marquee_enabled, s.marquee_speed, s.marquee_text,
  s.marquee_bg_color, s.marquee_text_color, s.button_color, s.button_text_color,
  s.header_bg_color, s.footer_bg_color, s.footer_text_color, s.low_stock_threshold,
  s.store_blocked OR COALESCE(
    (sub.status = ANY (ARRAY['trial_expired','canceled','suspended','past_due']))
    OR (sub.status = 'trial' AND sub.trial_ends_at < now()), true
  ) AS store_blocked,
  s.admin_blocked,
  s.welcome_coupon_enabled, s.welcome_coupon_discount_type, s.welcome_coupon_discount_value,
  s.welcome_coupon_expires_days, s.welcome_coupon_min_order,
  s.page_bg_color, s.header_text_color, s.banner_mobile_format,
  s.is_verified AND (sub.status = 'active' OR (sub.status = 'trial' AND sub.trial_ends_at > now()))
    AND (p.name = ANY (ARRAY['PREMIUM','PRO','ELITE'])) AS is_verified,
  (sub.status = 'active' OR (sub.status = 'trial' AND sub.trial_ends_at > now()))
    AND (p.name = ANY (ARRAY['PREMIUM','PRO','ELITE'])) AS is_premium_plan,
  s.ai_name,
  s.ai_avatar_url,
  s.ai_chat_tone
FROM store_settings s
LEFT JOIN latest_sub sub ON s.user_id = sub.user_id
LEFT JOIN tenant_plans p ON sub.plan_id = p.id;
