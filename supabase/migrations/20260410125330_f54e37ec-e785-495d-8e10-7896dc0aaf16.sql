-- Add missing tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.product_images;
ALTER PUBLICATION supabase_realtime ADD TABLE public.product_variants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.product_reviews;
ALTER PUBLICATION supabase_realtime ADD TABLE public.customers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.abandoned_carts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.referral_codes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.referrals;