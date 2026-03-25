
-- 1. Create app_role enum
CREATE TYPE public.app_role AS ENUM ('super_admin', 'tenant');

-- 2. Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- 4. RLS policies for user_roles
CREATE POLICY "Super admins can view all roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Super admins can manage roles"
  ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- 5. Product images table (multiple images per product)
CREATE TABLE public.product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  image_url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

-- Anyone can view product images (for public store)
CREATE POLICY "Anyone can view product images"
  ON public.product_images FOR SELECT TO anon
  USING (true);

CREATE POLICY "Authenticated can view product images"
  ON public.product_images FOR SELECT TO authenticated
  USING (true);

-- Product owners can manage images
CREATE POLICY "Product owners can manage images"
  ON public.product_images FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.products
      WHERE products.id = product_images.product_id
        AND products.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.products
      WHERE products.id = product_images.product_id
        AND products.user_id = auth.uid()
    )
  );

-- 6. Tenant plans table
CREATE TABLE public.tenant_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  price NUMERIC NOT NULL DEFAULT 0,
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  max_products INTEGER NOT NULL DEFAULT 50,
  max_orders_month INTEGER NOT NULL DEFAULT 100,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.tenant_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active plans"
  ON public.tenant_plans FOR SELECT TO anon
  USING (active = true);

CREATE POLICY "Authenticated can view plans"
  ON public.tenant_plans FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Super admins can manage plans"
  ON public.tenant_plans FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- 7. Tenant subscriptions table
CREATE TABLE public.tenant_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  plan_id UUID REFERENCES public.tenant_plans(id) NOT NULL,
  status TEXT NOT NULL DEFAULT 'trial',
  trial_ends_at TIMESTAMP WITH TIME ZONE,
  current_period_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  current_period_end TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '30 days'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE public.tenant_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscription"
  ON public.tenant_subscriptions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Super admins can view all subscriptions"
  ON public.tenant_subscriptions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can manage subscriptions"
  ON public.tenant_subscriptions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Users can update own subscription"
  ON public.tenant_subscriptions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- 8. Insert default plans
INSERT INTO public.tenant_plans (name, price, features, max_products, max_orders_month) VALUES
  ('Básico', 49.90, '["Loja online", "Até 50 produtos", "Até 100 pedidos/mês", "Suporte por email"]'::jsonb, 50, 100),
  ('Profissional', 89.90, '["Loja online", "Produtos ilimitados", "Pedidos ilimitados", "Cupons de desconto", "IA para catálogo", "Suporte prioritário"]'::jsonb, 9999, 99999);

-- 9. Super admin RLS: allow super admins to view ALL store_settings
CREATE POLICY "Super admins can view all store settings"
  ON public.store_settings FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

-- 10. Super admin RLS: allow super admins to view ALL products
CREATE POLICY "Super admins can view all products"
  ON public.products FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

-- 11. Super admin RLS: allow super admins to view ALL orders
CREATE POLICY "Super admins can view all orders"
  ON public.orders FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

-- 12. Super admin RLS: allow super admins to view ALL profiles
CREATE POLICY "Super admins can view all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

-- 13. Enable realtime for relevant tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.tenant_subscriptions;
