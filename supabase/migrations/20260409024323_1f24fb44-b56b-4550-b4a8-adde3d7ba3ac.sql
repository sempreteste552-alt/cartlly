-- Add 'verified_badge' to PREMIUM plan features
UPDATE public.tenant_plans
SET features = features || '{"verified_badge": true}'::jsonb
WHERE name = 'PREMIUM';

-- Drop and recreate the public view to include plan information
DROP VIEW IF EXISTS public.store_settings_public;

CREATE OR REPLACE VIEW public.store_settings_public AS
 SELECT s.id,
    s.user_id,
    s.store_name,
    s.logo_url,
    s.favicon_url,
    s.primary_color,
    s.secondary_color,
    s.accent_color,
    s.custom_domain,
    s.store_address,
    s.store_phone,
    s.store_whatsapp,
    s.google_maps_url,
    s.store_description,
    s.facebook_url,
    s.instagram_url,
    s.tiktok_url,
    s.twitter_url,
    s.youtube_url,
    s.store_location,
    s.store_slug,
    s.store_cep,
    s.admin_primary_color,
    s.admin_accent_color,
    s.store_open,
    s.sell_via_whatsapp,
    s.updated_at,
    s.created_at,
    s.domain_status,
    s.domain_last_check,
    s.shipping_enabled,
    s.shipping_base_cost,
    s.shipping_per_km,
    s.shipping_flat_rate,
    s.shipping_free_above,
    s.payment_gateway,
    s.gateway_public_key,
    s.gateway_environment,
    s.payment_pix,
    s.payment_credit_card,
    s.payment_debit_card,
    s.payment_boleto,
    s.max_installments,
    s.logo_size,
    s.marquee_enabled,
    s.marquee_speed,
    s.marquee_text,
    s.marquee_bg_color,
    s.marquee_text_color,
    s.button_color,
    s.button_text_color,
    s.header_bg_color,
    s.footer_bg_color,
    s.footer_text_color,
    s.low_stock_threshold,
    s.store_blocked,
    s.admin_blocked,
    s.welcome_coupon_enabled,
    s.welcome_coupon_discount_type,
    s.welcome_coupon_discount_value,
    s.welcome_coupon_expires_days,
    s.welcome_coupon_min_order,
    s.page_bg_color,
    s.header_text_color,
    s.banner_mobile_format,
    s.is_verified,
    p.name as plan_name,
    (p.name = 'PREMIUM') as is_premium_plan
   FROM public.store_settings s
   LEFT JOIN public.tenant_subscriptions ts ON s.user_id = ts.user_id
   LEFT JOIN public.tenant_plans p ON ts.plan_id = p.id;

-- Grant select on the view to public/anon/authenticated
GRANT SELECT ON public.store_settings_public TO anon, authenticated;
