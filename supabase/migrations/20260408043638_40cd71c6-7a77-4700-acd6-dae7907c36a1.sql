
DROP VIEW IF EXISTS public.store_marketing_config_public;

CREATE VIEW public.store_marketing_config_public AS
SELECT 
  id, user_id,
  announcement_bar_enabled, announcement_bar_text, announcement_bar_bg_color,
  announcement_bar_text_color, announcement_bar_link,
  popup_coupon_enabled, popup_coupon_code, popup_coupon_title, popup_coupon_description,
  popup_coupon_image_url, popup_coupon_delay_seconds,
  countdown_enabled, countdown_end_date, countdown_text,
  countdown_bg_color, countdown_text_color,
  free_shipping_bar_enabled, free_shipping_threshold, free_shipping_bar_color,
  trust_badges_enabled, trust_badges,
  created_at, updated_at
FROM public.store_marketing_config;

GRANT SELECT ON public.store_marketing_config_public TO anon;
GRANT SELECT ON public.store_marketing_config_public TO authenticated;
