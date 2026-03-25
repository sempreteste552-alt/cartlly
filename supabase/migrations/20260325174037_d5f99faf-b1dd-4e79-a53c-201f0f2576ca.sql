
-- Customers table for store customer accounts
CREATE TABLE public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  store_user_id UUID NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  cep TEXT,
  cpf TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Customers can view/update their own data
CREATE POLICY "Customers can view own data" ON public.customers
  FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid());

CREATE POLICY "Customers can update own data" ON public.customers
  FOR UPDATE TO authenticated
  USING (auth_user_id = auth.uid());

CREATE POLICY "Customers can insert own data" ON public.customers
  FOR INSERT TO authenticated
  WITH CHECK (auth_user_id = auth.uid());

-- Store owners can view their customers
CREATE POLICY "Store owners can view customers" ON public.customers
  FOR SELECT TO authenticated
  USING (store_user_id = auth.uid());

-- Super admins can view all customers
CREATE POLICY "Super admins can view all customers" ON public.customers
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

-- Add marquee and logo fields to store_settings
ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS marquee_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS marquee_text TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS marquee_speed INTEGER NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS marquee_bg_color TEXT NOT NULL DEFAULT '#000000',
  ADD COLUMN IF NOT EXISTS marquee_text_color TEXT NOT NULL DEFAULT '#ffffff',
  ADD COLUMN IF NOT EXISTS logo_size INTEGER NOT NULL DEFAULT 32;
