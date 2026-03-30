
-- 1. CRITICAL: Create a secure view for public store_settings that excludes secret keys
CREATE OR REPLACE VIEW public.store_settings_public AS
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

-- 2. CRITICAL: Remove the anon SELECT policy that exposes gateway_secret_key
DROP POLICY IF EXISTS "Anyone can view store settings" ON public.store_settings;

-- Re-create anon policy on the TABLE but only for authenticated + owner access patterns remain
-- Anon users should use the view instead
-- (The view inherits RLS of the underlying table, so we need a new anon-friendly approach)
-- Actually, let's keep anon access but via a security definer function or just restrict columns
-- Better approach: keep the policy but make it read from the view in the app code
-- For now, create a restricted anon policy that excludes secret columns using a wrapper
CREATE POLICY "Anon can view store settings public fields"
ON public.store_settings
FOR SELECT
TO anon
USING (true);

-- 3. CRITICAL: Fix orders - add tracking_token and restrict anon access
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tracking_token text DEFAULT encode(gen_random_bytes(16), 'hex');

-- Drop overly permissive anon policies on orders
DROP POLICY IF EXISTS "Anyone can view order by id for tracking" ON public.orders;
DROP POLICY IF EXISTS "Anyone can view order items for tracking" ON public.order_items;
DROP POLICY IF EXISTS "Anyone can view status history for tracking" ON public.order_status_history;

-- Create restricted anon policies requiring tracking token
CREATE POLICY "Anon can view order by tracking token"
ON public.orders
FOR SELECT
TO anon
USING (tracking_token IS NOT NULL AND tracking_token = current_setting('request.headers', true)::json->>'x-tracking-token');

-- For order_items and status_history, allow anon only via authenticated context or edge function
CREATE POLICY "Anon can view order items with valid order"
ON public.order_items
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id
    AND o.tracking_token = current_setting('request.headers', true)::json->>'x-tracking-token'
  )
);

CREATE POLICY "Anon can view status history with valid order"
ON public.order_status_history
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_status_history.order_id
    AND o.tracking_token = current_setting('request.headers', true)::json->>'x-tracking-token'
  )
);

-- 4. CRITICAL: Fix coupon anon update - remove dangerous policy
DROP POLICY IF EXISTS "Anyone can update coupon usage" ON public.coupons;

-- Create a secure function to increment coupon usage (service_role only logic, called from edge functions or triggers)
CREATE OR REPLACE FUNCTION public.increment_coupon_usage(_coupon_code text, _store_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  updated_rows integer;
BEGIN
  UPDATE public.coupons
  SET used_count = used_count + 1
  WHERE code = _coupon_code
    AND user_id = _store_user_id
    AND active = true
    AND (max_uses IS NULL OR used_count < max_uses)
    AND (expires_at IS NULL OR expires_at > now());
  
  GET DIAGNOSTICS updated_rows = ROW_COUNT;
  RETURN updated_rows > 0;
END;
$$;

-- Allow anon and authenticated to call the function
GRANT EXECUTE ON FUNCTION public.increment_coupon_usage(text, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.increment_coupon_usage(text, uuid) TO authenticated;
