
-- Create store_settings table (one per user)
CREATE TABLE public.store_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  store_name TEXT NOT NULL DEFAULT 'Minha Loja',
  logo_url TEXT,
  primary_color TEXT NOT NULL DEFAULT '#6d28d9',
  secondary_color TEXT NOT NULL DEFAULT '#f5f3ff',
  accent_color TEXT NOT NULL DEFAULT '#8b5cf6',
  payment_pix BOOLEAN NOT NULL DEFAULT false,
  payment_boleto BOOLEAN NOT NULL DEFAULT false,
  payment_credit_card BOOLEAN NOT NULL DEFAULT false,
  payment_debit_card BOOLEAN NOT NULL DEFAULT false,
  custom_domain TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own settings"
ON public.store_settings FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own settings"
ON public.store_settings FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings"
ON public.store_settings FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE TRIGGER update_store_settings_updated_at
  BEFORE UPDATE ON public.store_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for store logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('store-assets', 'store-assets', true);

CREATE POLICY "Store assets are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'store-assets');

CREATE POLICY "Authenticated users can upload store assets"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'store-assets');

CREATE POLICY "Users can update store assets"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'store-assets');

CREATE POLICY "Users can delete store assets"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'store-assets');
